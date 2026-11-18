import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments";
import { confirmPayment } from "@/lib/payments/confirm";

/**
 * POST /api/billing/simulate-confirm
 * Body: { referenceId, provider, providerRef }
 *
 * Called only from the internal /checkout/simulate page — the "Pay" button
 * a checkout session redirects to when its provider has no real API keys
 * configured. Refuses to run if the provider actually IS in live mode, so
 * this can never be used to bypass a real charge.
 *
 * On the production site only a platform super admin may use it: otherwise,
 * while payments are still in test mode, any signed-in user could mark their
 * own invoice as paid without paying. Preview/local deployments keep the
 * open behaviour for testing.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (process.env.VERCEL_ENV === "production" && session.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Online payment isn't available yet. Please contact the editorial office to arrange payment." },
      { status: 403 }
    );
  }

  const { referenceId, provider: providerId, providerRef } = (await req.json()) as {
    referenceId: string;
    provider: string;
    providerRef: string;
  };

  let provider;
  try {
    provider = getPaymentProvider(providerId);
  } catch {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (provider.isLiveMode()) {
    return NextResponse.json(
      { error: "This provider has real API keys configured — simulated confirmation is disabled." },
      { status: 403 }
    );
  }

  const [, invoiceId] = referenceId.split(":");
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.userId !== session.userId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not your invoice" }, { status: 403 });
  }

  try {
    await confirmPayment({ referenceId, provider: provider.id, providerRef });
  } catch (e: any) {
    console.error("simulate-confirm failed", e);
    return NextResponse.json({ error: "Payment confirmation failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
