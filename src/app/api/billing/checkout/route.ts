import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments";
import { APP_BASE_URL } from "@/lib/site";
import { SUBSCRIPTION_PLAN_PRICES, DISTRIBUTION_PACKAGE_ARTICLE_USD, DISTRIBUTION_PACKAGE_BOOK_USD, type SubscriptionPlan } from "@/lib/pricing";
import { PRIVILEGED_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

// `plan` isn't restricted to keyof SUBSCRIPTION_PLAN_PRICES here — the
// handler below already does that lookup and 400s on a miss, so this only
// needs to guarantee it's a plausible identifier string, not re-encode the
// pricing table's key list as a second source of truth.
const CheckoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("APC"), invoiceId: z.string().min(1), provider: z.string().min(1).max(50) }),
  z.object({ kind: z.literal("SUBSCRIPTION"), plan: z.string().min(1).max(50), provider: z.string().min(1).max(50) }),
  z.object({
    kind: z.literal("DISTRIBUTION_PACKAGE"),
    target: z.enum(["ARTICLE", "BOOK"]),
    targetId: z.string().min(1),
    provider: z.string().min(1).max(50),
  }),
]);

/**
 * POST /api/billing/checkout
 * Body:
 *   { kind: "APC", invoiceId: string, provider: PaymentProviderId }
 *   { kind: "SUBSCRIPTION", plan: SubscriptionPlan, provider: PaymentProviderId }
 *   { kind: "DISTRIBUTION_PACKAGE", target: "ARTICLE" | "BOOK", targetId: string, provider: PaymentProviderId }
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

  const parsed = await parseBody(req, CheckoutSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

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
    const amount = SUBSCRIPTION_PLAN_PRICES[body.plan as SubscriptionPlan];
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

  if (body.kind === "DISTRIBUTION_PACKAGE") {
    const isArticle = body.target === "ARTICLE";
    const canManage = (ownerId: string | null) => PRIVILEGED_ROLES.has(session.role) || (!!ownerId && ownerId === session.userId);

    let invoiceData: { userId: string; type: string; amount: number; articleId?: string; bookId?: string };
    let description: string;

    if (isArticle) {
      const article = await db.article.findUnique({ where: { id: body.targetId } });
      if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
      if (!canManage(article.correspondingAuthorId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (article.distributionPackagePaidAt) return NextResponse.json({ error: "Distribution Package already unlocked for this article" }, { status: 409 });
      invoiceData = { userId: session.userId, type: "DISTRIBUTION_PACKAGE", amount: DISTRIBUTION_PACKAGE_ARTICLE_USD, articleId: article.id };
      description = `Distribution Package (arXiv/SSRN) — "${article.title}"`;
    } else {
      const book = await db.book.findUnique({ where: { id: body.targetId } });
      if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
      if (!canManage(book.correspondingAuthorId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (book.distributionPackagePaidAt) return NextResponse.json({ error: "Distribution Package already unlocked for this book" }, { status: 409 });
      invoiceData = { userId: session.userId, type: "DISTRIBUTION_PACKAGE", amount: DISTRIBUTION_PACKAGE_BOOK_USD, bookId: book.id };
      description = `Distribution Package (Draft2Digital/IngramSpark) — "${book.title}"`;
    }

    const invoice = await db.invoice.create({ data: { ...invoiceData, currency: "USD", status: "OPEN" } });

    const result = await provider.createCheckout({
      referenceId: `dist:${invoice.id}`,
      description,
      amountUsd: invoiceData.amount,
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
