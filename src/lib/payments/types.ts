/**
 * Shared contract every payment provider implements. Mirrors the
 * isLiveMode()/simulation-fallback pattern already used in src/lib/crossref.ts
 * and src/lib/llm.ts: each provider checks its own env vars and reports
 * whether it can talk to the real gateway, falling back to a simulated
 * checkout that still exercises the full invoice/subscription lifecycle
 * when no credentials are configured.
 */

export type PaymentProviderId = "stripe" | "paypal" | "paymongo" | "xendit" | "lemonsqueezy";

export interface CheckoutInput {
  /** Internal reference echoed back on the webhook so we know what to mark paid. */
  referenceId: string;
  description: string;
  amountUsd: number;
  customerEmail: string;
  /** Where the provider should send the browser after checkout. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** URL to redirect the browser to — either the real hosted checkout page, or our internal simulated one. */
  redirectUrl: string;
  /** The provider's session/order id, stored on the Invoice/Subscription row. */
  providerRef: string;
  mode: "live" | "simulation";
}

export interface WebhookEvent {
  /** True once signature verification + event parsing succeeded and the payment is confirmed paid. */
  paid: boolean;
  referenceId: string | null;
  providerRef: string | null;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  isLiveMode(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Verifies the raw webhook request and extracts the payment confirmation. Throws on invalid signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent>;
}
