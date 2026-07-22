import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { withRlsContext } from "@/lib/db-rls";

/**
 * GET /api/billing/status — current user's invoices + active subscription.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const [invoices, subscription] = await Promise.all([
    withRlsContext(session, (tx) =>
      tx.invoice.findMany({
        where: { userId: session.userId },
        include: { article: { select: { title: true, doi: true } } },
        orderBy: { createdAt: "desc" },
      })
    ),
    db.subscription.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      type: i.type,
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      stripeInvoiceId: i.stripeInvoiceId,
      paidAt: i.paidAt,
      createdAt: i.createdAt,
      article: i.article,
    })),
    subscription: subscription
      ? {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
  });
}
