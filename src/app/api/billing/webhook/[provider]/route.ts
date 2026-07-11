import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { confirmPayment } from "@/lib/payments/confirm";

/**
 * POST /api/billing/webhook/[provider]
 * Real webhook receiver for Stripe/PayPal/PayMongo/Xendit/Lemon Squeezy.
 * Each provider's parseWebhook() verifies the request is genuinely signed
 * by that gateway before confirmPayment() ever runs — this route never
 * trusts the request body on its own.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;

  let provider;
  try {
    provider = getPaymentProvider(providerId);
  } catch {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = await provider.parseWebhook(rawBody, req.headers);
  } catch (e: any) {
    console.error(`[billing/webhook/${providerId}] signature verification failed:`, e.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!event.paid || !event.referenceId || !event.providerRef) {
    // Not a payment-confirmation event (or missing data) — acknowledge so
    // the gateway doesn't retry, but there's nothing to record.
    return NextResponse.json({ received: true, actioned: false });
  }

  try {
    await confirmPayment({ referenceId: event.referenceId, provider: provider.id, providerRef: event.providerRef });
  } catch (e: any) {
    console.error(`[billing/webhook/${providerId}] confirmPayment failed:`, e.message);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }

  return NextResponse.json({ received: true, actioned: true });
}
