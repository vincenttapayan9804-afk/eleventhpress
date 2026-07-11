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
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
