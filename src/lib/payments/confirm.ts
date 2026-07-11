/**
 * Single place a payment is ever marked confirmed — called from every
 * provider's webhook route AND from the simulation-mode "Pay" button, so
 * there's exactly one code path for "what happens when money arrives"
 * regardless of which of the 5 gateways (or simulation) sent it.
 *
 * referenceId format: "apc:<invoiceId>" | "sub:<invoiceId>" — set when the
 * checkout session is created in /api/billing/checkout.
 */
import { db } from "@/lib/db";
import { SUBSCRIPTION_PLAN_DURATIONS, type SubscriptionPlan } from "@/lib/pricing";
import type { PaymentProviderId } from "./types";

export interface ConfirmPaymentInput {
  referenceId: string;
  provider: PaymentProviderId;
  providerRef: string;
}

export async function confirmPayment({ referenceId, provider, providerRef }: ConfirmPaymentInput): Promise<void> {
  const [kind, invoiceId] = referenceId.split(":");
  if (!invoiceId || (kind !== "apc" && kind !== "sub")) {
    throw new Error(`Malformed payment referenceId: ${referenceId}`);
  }

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { article: true } });
  if (!invoice) throw new Error(`Invoice not found for referenceId ${referenceId}`);

  // Idempotency: webhooks can be redelivered, and the simulated "Pay" button
  // could be double-clicked — a second confirmation is a silent no-op.
  if (invoice.status === "PAID") return;

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date(), provider, stripeInvoiceId: providerRef },
  });

  await db.auditLog.create({
    data: {
      userId: invoice.userId,
      action: "PAYMENT_RECEIVED",
      entityType: "INVOICE",
      entityId: invoiceId,
      articleId: invoice.articleId,
      metadata: JSON.stringify({ amount: invoice.amount, currency: invoice.currency, provider, providerRef }),
    },
  });

  if (kind === "apc" && invoice.articleId) {
    await db.article.update({ where: { id: invoice.articleId }, data: { status: "IN_PRODUCTION" } });
    await db.notification.create({
      data: {
        userId: invoice.userId,
        type: "SUCCESS",
        title: "APC Payment Confirmed",
        message: `Your payment of USD ${invoice.amount.toFixed(2)} has been received. Article "${invoice.article?.title}" is now in production. The Production Service will generate HTML, PDF, and XML galleys and the article will be published automatically once galleys are ready.`,
        articleId: invoice.articleId,
      },
    });
    return;
  }

  if (kind === "sub") {
    const meta = safeParseJson(invoice.metadata) as { plan?: SubscriptionPlan };
    const plan = meta.plan;
    if (!plan || !SUBSCRIPTION_PLAN_DURATIONS[plan]) {
      throw new Error(`Subscription invoice ${invoiceId} has no valid plan in metadata`);
    }

    await db.subscription.updateMany({
      where: { userId: invoice.userId, status: "ACTIVE" },
      data: { status: "CANCELED" },
    });

    const duration = SUBSCRIPTION_PLAN_DURATIONS[plan];
    await db.subscription.create({
      data: {
        userId: invoice.userId,
        plan,
        status: "ACTIVE",
        provider,
        stripeSubId: providerRef,
        currentPeriodEnd: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
      },
    });

    await db.notification.create({
      data: {
        userId: invoice.userId,
        type: "SUCCESS",
        title: "Subscription Active",
        message: `Your ${plan.replace(/_/g, " ").toLowerCase()} subscription is now active. Payment of USD ${invoice.amount.toFixed(2)} received via ${provider}.`,
      },
    });
  }
}

function safeParseJson(s: string | null): any {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
