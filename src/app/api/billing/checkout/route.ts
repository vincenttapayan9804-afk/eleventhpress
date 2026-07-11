import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments";
import { APP_BASE_URL } from "@/lib/site";
import { SUBSCRIPTION_PLAN_PRICES, type SubscriptionPlan } from "@/lib/pricing";

/**
 * POST /api/billing/checkout
 * Body:
 *   { kind: "APC", invoiceId: string, provider: PaymentProviderId }
 *   { kind: "SUBSCRIPTION", plan: SubscriptionPlan, provider: PaymentProviderId }
 *
 * Creates a checkout session with the chosen gateway (or a simulated one,
 * if that gateway has no API keys configured) and returns a redirectUrl for
 * the browser to follow. Payment isn't recorded here — that only happens
 * once the gateway's webhook (or, in simulation mode, the simulated
 * checkout page) confirms it via confirmPayment().
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as
    | { kind: "APC"; invoiceId: string; provider: string }
    | { kind: "SUBSCRIPTION"; plan: SubscriptionPlan; provider: string };

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let provider;
  try {
    provider = getPaymentProvider(body.provider);
  } catch {
    return NextResponse.json({ error: "Unknown payment provider" }, { status: 400 });
  }

  const successUrl = `${APP_BASE_URL}/?checkout=success`;
  const cancelUrl = `${APP_BASE_URL}/?checkout=canceled`;

  if (body.kind === "APC") {
    const invoice = await db.invoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.userId !== session.userId) {
      return NextResponse.json({ error: "Not your invoice" }, { status: 403 });
    }
    if (invoice.status === "PAID") {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 409 });
    }

    const result = await provider.createCheckout({
      referenceId: `apc:${invoice.id}`,
      description: "Article Processing Charge — Eleventh Press International Publishing",
      amountUsd: invoice.amount,
      customerEmail: user.email,
      successUrl,
      cancelUrl,
    });

    await db.invoice.update({
      where: { id: invoice.id },
      data: { provider: provider.id, stripeInvoiceId: result.providerRef },
    });

    return NextResponse.json({ redirectUrl: result.redirectUrl, mode: result.mode });
  }

  if (body.kind === "SUBSCRIPTION") {
    const amount = SUBSCRIPTION_PLAN_PRICES[body.plan];
    if (!amount) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const invoice = await db.invoice.create({
      data: {
        userId: session.userId,
        type: "SUBSCRIPTION",
        amount,
        currency: "USD",
        status: "OPEN",
        metadata: JSON.stringify({ plan: body.plan }),
      },
    });

    const result = await provider.createCheckout({
      referenceId: `sub:${invoice.id}`,
      description: `Reader subscription — ${body.plan.replace(/_/g, " ").toLowerCase()}`,
      amountUsd: amount,
      customerEmail: user.email,
      successUrl,
      cancelUrl,
    });

    await db.invoice.update({
      where: { id: invoice.id },
      data: { provider: provider.id, stripeInvoiceId: result.providerRef },
    });

    return NextResponse.json({ redirectUrl: result.redirectUrl, mode: result.mode });
  }

  return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
}
