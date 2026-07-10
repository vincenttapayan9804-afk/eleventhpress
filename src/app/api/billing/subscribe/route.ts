import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

const PLAN_PRICES: Record<string, number> = {
  READER_MONTHLY: 19.0,
  READER_YEARLY: 180.0,
  INSTITUTIONAL: 2400.0,
};

const PLAN_DURATIONS: Record<string, number> = {
  READER_MONTHLY: 30,
  READER_YEARLY: 365,
  INSTITUTIONAL: 365,
};

/**
 * POST /api/billing/subscribe  — create or extend a subscription (mock Stripe Billing).
 * Body: { plan: READER_MONTHLY | READER_YEARLY | INSTITUTIONAL }
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { plan } = (await req.json()) as { plan: string };
  if (!PLAN_PRICES[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Cancel existing ACTIVE sub
  await db.subscription.updateMany({
    where: { userId: session.userId, status: "ACTIVE" },
    data: { status: "CANCELED" },
  });

  const duration = PLAN_DURATIONS[plan];
  const sub = await db.subscription.create({
    data: {
      userId: session.userId,
      plan,
      status: "ACTIVE",
      stripeSubId: `sub_mock_${plan}_${Date.now()}`,
      currentPeriodEnd: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    },
  });

  // Also issue an invoice
  await db.invoice.create({
    data: {
      userId: session.userId,
      type: "SUBSCRIPTION",
      amount: PLAN_PRICES[plan],
      currency: "USD",
      status: "PAID",
      paidAt: new Date(),
      stripeInvoiceId: `in_mock_sub_${Date.now()}`,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: "PAYMENT_RECEIVED",
      entityType: "SUBSCRIPTION",
      entityId: sub.id,
      metadata: JSON.stringify({ plan, amount: PLAN_PRICES[plan] }),
    },
  });

  return NextResponse.json({ subscription: sub });
}
