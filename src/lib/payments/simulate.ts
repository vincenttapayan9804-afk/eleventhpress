import { APP_BASE_URL } from "@/lib/site";
import type { CheckoutInput, CheckoutResult, PaymentProviderId } from "./types";

/**
 * Shared simulation-mode checkout, used by every provider when its real API
 * keys aren't configured. Redirects to an internal page that looks like a
 * hosted checkout and, on confirm, hits the same confirmPayment() path a
 * real webhook would — so the rest of the app never has to know whether a
 * given payment was real or simulated.
 */
export function simulatedCheckout(provider: PaymentProviderId, input: CheckoutInput): CheckoutResult {
  const providerRef = `sim_${provider}_${Date.now()}`;
  const qs = new URLSearchParams({
    provider,
    ref: input.referenceId,
    providerRef,
    amount: input.amountUsd.toFixed(2),
    desc: input.description,
  });
  return {
    redirectUrl: `${APP_BASE_URL}/checkout/simulate?${qs.toString()}`,
    providerRef,
    mode: "simulation",
  };
}
