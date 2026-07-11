/**
 * Lemon Squeezy provider — JSON:API-shaped REST API with Bearer auth.
 * Checkouts are created against a pre-existing Store + Variant (Lemon
 * Squeezy's "product" is configured in their dashboard, not created
 * per-charge), so this needs LEMONSQUEEZY_STORE_ID and
 * LEMONSQUEEZY_VARIANT_ID in addition to the API key.
 *
 * Requires LEMONSQUEEZY_API_KEY + LEMONSQUEEZY_STORE_ID +
 * LEMONSQUEEZY_VARIANT_ID (+ LEMONSQUEEZY_WEBHOOK_SECRET to verify
 * webhooks). Falls back to simulation mode when unset.
 *
 * Verify field/endpoint shapes against Lemon Squeezy's current API docs
 * before relying on this in production — written from their stable
 * Checkouts + webhook-signing API, not fetched live.
 */
import crypto from "crypto";
import { simulatedCheckout } from "./simulate";
import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookEvent } from "./types";

const API_KEY = process.env.LEMONSQUEEZY_API_KEY || "";
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "";
const VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID || "";
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";
const API_BASE = "https://api.lemonsqueezy.com/v1";

export const lemonSqueezyProvider: PaymentProvider = {
  id: "lemonsqueezy",
  label: "Lemon Squeezy",

  isLiveMode() {
    return !!API_KEY && !!STORE_ID && !!VARIANT_ID;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isLiveMode()) return simulatedCheckout("lemonsqueezy", input);

    const res = await fetch(`${API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            custom_price: Math.round(input.amountUsd * 100),
            product_options: { redirect_url: input.successUrl, description: input.description },
            checkout_data: {
              email: input.customerEmail,
              custom: { reference_id: input.referenceId },
            },
          },
          relationships: {
            store: { data: { type: "stores", id: STORE_ID } },
            variant: { data: { type: "variants", id: VARIANT_ID } },
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Lemon Squeezy checkout creation failed: ${res.status} ${await res.text()}`);
    const checkout = await res.json();

    return {
      redirectUrl: checkout.data.attributes.url,
      providerRef: checkout.data.id,
      mode: "live",
    };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const signature = headers.get("x-signature") || "";
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new Error("Lemon Squeezy webhook signature verification failed");
    }

    const event = JSON.parse(rawBody);
    if (event.meta?.event_name !== "order_created") {
      return { paid: false, referenceId: null, providerRef: null };
    }
    return {
      paid: event.data?.attributes?.status === "paid",
      referenceId: event.meta?.custom_data?.reference_id ?? null,
      providerRef: event.data?.id ?? null,
    };
  },
};
