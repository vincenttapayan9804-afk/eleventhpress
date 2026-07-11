/**
 * PayPal provider — real Orders v2 REST API (no SDK needed, it's plain JSON
 * over HTTPS with OAuth2 client-credentials auth).
 *
 * Requires PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET (+ PAYPAL_WEBHOOK_ID to
 * verify webhooks) and, optionally, PAYPAL_ENV=live to switch off the
 * sandbox host. Falls back to simulation mode when unset.
 *
 * Verify field/endpoint shapes against PayPal's current REST API docs
 * before relying on this in production — written from the stable v2 Orders
 * + webhook-signature-verification API, not fetched live.
 */
import { simulatedCheckout } from "./simulate";
import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookEvent } from "./types";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";
const API_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal OAuth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  label: "PayPal",

  isLiveMode() {
    return !!CLIENT_ID && !!CLIENT_SECRET;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isLiveMode()) return simulatedCheckout("paypal", input);

    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.referenceId,
            description: input.description,
            amount: { currency_code: "USD", value: input.amountUsd.toFixed(2) },
          },
        ],
        application_context: {
          return_url: input.successUrl,
          cancel_url: input.cancelUrl,
          user_action: "PAY_NOW",
        },
      }),
    });
    if (!res.ok) throw new Error(`PayPal order creation failed: ${res.status} ${await res.text()}`);
    const order = await res.json();
    const approveLink = (order.links || []).find((l: any) => l.rel === "approve")?.href;
    if (!approveLink) throw new Error("PayPal order response had no approve link");

    return { redirectUrl: approveLink, providerRef: order.id, mode: "live" };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const token = await getAccessToken();
    const event = JSON.parse(rawBody);

    const verifyRes = await fetch(`${API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_time: headers.get("paypal-transmission-time"),
        cert_url: headers.get("paypal-cert-url"),
        auth_algo: headers.get("paypal-auth-algo"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        webhook_id: WEBHOOK_ID,
        webhook_event: event,
      }),
    });
    const verification = await verifyRes.json();
    if (verification.verification_status !== "SUCCESS") {
      throw new Error("PayPal webhook signature verification failed");
    }

    if (event.event_type !== "CHECKOUT.ORDER.APPROVED" && event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      return { paid: false, referenceId: null, providerRef: null };
    }
    const purchaseUnit = event.resource?.purchase_units?.[0];
    return {
      paid: true,
      referenceId: purchaseUnit?.reference_id ?? null,
      providerRef: event.resource?.id ?? null,
    };
  },
};
