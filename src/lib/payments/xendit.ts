/**
 * Xendit provider — Southeast Asia-focused gateway, plain REST API with
 * Basic auth (secret key as username, blank password).
 *
 * Requires XENDIT_SECRET_KEY (+ XENDIT_CALLBACK_TOKEN to verify webhooks —
 * Xendit uses a shared-secret header comparison, not HMAC). Falls back to
 * simulation mode when unset.
 *
 * Verify field/endpoint shapes against Xendit's current API docs before
 * relying on this in production — written from their stable Invoices +
 * callback-verification-token API, not fetched live.
 */
import { simulatedCheckout } from "./simulate";
import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookEvent } from "./types";

const SECRET_KEY = process.env.XENDIT_SECRET_KEY || "";
const CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || "";
const API_BASE = "https://api.xendit.co";

function authHeader(): string {
  return `Basic ${Buffer.from(`${SECRET_KEY}:`).toString("base64")}`;
}

export const xenditProvider: PaymentProvider = {
  id: "xendit",
  label: "Xendit",

  isLiveMode() {
    return !!SECRET_KEY;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isLiveMode()) return simulatedCheckout("xendit", input);

    const res = await fetch(`${API_BASE}/v2/invoices`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: input.referenceId,
        amount: input.amountUsd,
        currency: "USD",
        payer_email: input.customerEmail,
        description: input.description,
        success_redirect_url: input.successUrl,
        failure_redirect_url: input.cancelUrl,
      }),
    });
    if (!res.ok) throw new Error(`Xendit invoice creation failed: ${res.status} ${await res.text()}`);
    const invoice = await res.json();

    return { redirectUrl: invoice.invoice_url, providerRef: invoice.id, mode: "live" };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const token = headers.get("x-callback-token") || "";
    if (token !== CALLBACK_TOKEN) {
      throw new Error("Xendit webhook callback token mismatch");
    }

    const event = JSON.parse(rawBody);
    if (event.status !== "PAID") {
      return { paid: false, referenceId: null, providerRef: null };
    }
    return {
      paid: true,
      referenceId: event.external_id ?? null,
      providerRef: event.id ?? null,
    };
  },
};
