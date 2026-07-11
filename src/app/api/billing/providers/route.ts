import { NextResponse } from "next/server";
import { listPaymentProviders } from "@/lib/payments";

/** GET /api/billing/providers — which gateways are configured, and whether each is live or simulated. */
export async function GET() {
  return NextResponse.json({ providers: listPaymentProviders() });
}
