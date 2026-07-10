import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * POST /api/billing/apc  — pay an APC invoice (mock Stripe webhook).
 * Body: { invoiceId }
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { invoiceId } = (await req.json()) as { invoiceId: string };
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { article: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.userId !== session.userId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not your invoice" }, { status: 403 });
  }
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 409 });
  }

  const updated = await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripeInvoiceId: `in_mock_${Date.now()}`,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "PAYMENT_RECEIVED",
      entityType: "INVOICE",
      entityId: invoiceId,
      articleId: invoice.articleId,
      metadata: JSON.stringify({ amount: invoice.amount, currency: invoice.currency }),
    },
  });

  // If APC invoice: move article to IN_PRODUCTION
  if (invoice.type === "APC" && invoice.articleId) {
    await db.article.update({
      where: { id: invoice.articleId },
      data: { status: "IN_PRODUCTION" },
    });
    // Notify author
    await db.notification.create({
      data: {
        userId: invoice.userId,
        type: "SUCCESS",
        title: "APC Payment Confirmed",
        message: `Your payment of USD ${invoice.amount.toFixed(2)} has been received. Article "${invoice.article?.title}" is now in production. The Production Service will generate HTML, PDF, and XML galleys and the article will be published automatically once galleys are ready.`,
        articleId: invoice.articleId,
      },
    });
  }

  return NextResponse.json({ invoice: updated });
}
