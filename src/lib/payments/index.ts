import { stripeProvider } from "./stripe";
import { paypalProvider } from "./paypal";
import { paymongoProvider } from "./paymongo";
import { xenditProvider } from "./xendit";
import { lemonSqueezyProvider } from "./lemonsqueezy";
import type { PaymentProvider, PaymentProviderId } from "./types";

export const PAYMENT_PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  stripe: stripeProvider,
  paypal: paypalProvider,
  paymongo: paymongoProvider,
  xendit: xenditProvider,
  lemonsqueezy: lemonSqueezyProvider,
};

export function getPaymentProvider(id: string): PaymentProvider {
  const provider = PAYMENT_PROVIDERS[id as PaymentProviderId];
  if (!provider) throw new Error(`Unknown payment provider: ${id}`);
  return provider;
}

/** For the checkout UI's provider picker — includes live/simulation status so the UI can be honest about it. */
export function listPaymentProviders(): { id: PaymentProviderId; label: string; liveMode: boolean }[] {
  return Object.values(PAYMENT_PROVIDERS).map((p) => ({ id: p.id, label: p.label, liveMode: p.isLiveMode() }));
}

export type { PaymentProvider, PaymentProviderId, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";
