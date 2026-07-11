/**
 * PayMongo provider — Philippines-focused gateway, plain REST API with
 * Basic auth (secret key as username, blank password), Stripe-like shape.
 *
 * Requires PAYMONGO_SECRET_KEY (+ PAYMONGO_WEBHOOK_SECRET to verify
 * webhooks). Falls back to simulation mode when unset.
 *
 * Verify field/endpoint shapes against PayMongo's current API docs before
 * relying on this in production — written from their stable Checkout
 * Sessions + webhook-signing API, not fetched live.
 */
import crypto from "crypto";
import { simulatedCheckout } from "./simulate";
import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookEvent } from "./types";

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || "";
const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET || "";
const API_BASE = "https://api.paymongo.com/v1";

function authHeader(): string {
  return `Basic ${Buffer.from(`${SECRET_KEY}:`).toString("base64")}`;
}

export const paymongoProvider: PaymentProvider = {
  id: "paymongo",
  label: "PayMongo",

  isLiveMode() {
    return !!SECRET_KEY;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isLiveMode()) return simulatedCheckout("paymongo", input);

    const res = await fetch(`${API_BASE}/checkout_sessions`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          attributes: {
            reference_number: input.referenceId,
            send_email_receipt: false,
            show_line_items: true,
            line_items: [
              {
                currency: "USD",
                amount: Math.round(input.amountUsd * 100),
                name: input.description,
                quantity: 1,
              },
            ],
            payment_method_types: ["card", "gcash", "paymaya"],
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`PayMongo checkout session creation failed: ${res.status} ${await res.text()}`);
    const session = await res.json();

    return {
      redirectUrl: session.data.attributes.checkout_url,
      providerRef: session.data.id,
      mode: "live",
    };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const sigHeader = headers.get("paymongo-signature") || "";
    // Format: t=<timestamp>,te=<test_signature>,li=<live_signature>
    const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=") as [string, string]));
    const signedPayload = `${parts.t}.${rawBody}`;
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");
    const provided = parts.li || parts.te;
    if (!provided || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
      throw new Error("PayMongo webhook signature verification failed");
    }

    const event = JSON.parse(rawBody);
    const type = event.data?.attributes?.type;
    if (type !== "checkout_session.payment.paid") {
      return { paid: false, referenceId: null, providerRef: null };
    }
    const checkoutSession = event.data.attributes.data;
    return {
      paid: true,
      referenceId: checkoutSession?.attributes?.reference_number ?? null,
      providerRef: checkoutSession?.id ?? null,
    };
  },
};
