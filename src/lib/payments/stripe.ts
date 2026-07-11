/**
 * Stripe provider — real Checkout Sessions via the official `stripe` SDK.
 *
 * Every purchase (APC or subscription) is a one-time Checkout Session in
 * "payment" mode, not Stripe's native subscription objects — recurrence is
 * modeled in our own DB (Subscription.currentPeriodEnd), so there's no need
 * to pre-create Stripe Product/Price objects before this can charge.
 *
 * Requires STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET to verify webhooks).
 * Falls back to simulation mode when unset.
 */
import Stripe from "stripe";
import { simulatedCheckout } from "./simulate";
import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookEvent } from "./types";

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

let client: Stripe | null = null;
function getClient(): Stripe {
  if (!client) client = new Stripe(SECRET_KEY);
  return client;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe",

  isLiveMode() {
    return !!SECRET_KEY;
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isLiveMode()) return simulatedCheckout("stripe", input);

    const session = await getClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: input.customerEmail,
      client_reference_id: input.referenceId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(input.amountUsd * 100),
            product_data: { name: input.description },
          },
          quantity: 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });

    return {
      redirectUrl: session.url!,
      providerRef: session.id,
      mode: "live",
    };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const sig = headers.get("stripe-signature") || "";
    const event = getClient().webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);

    if (event.type !== "checkout.session.completed") {
      return { paid: false, referenceId: null, providerRef: null };
    }
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      paid: session.payment_status === "paid",
      referenceId: session.client_reference_id,
      providerRef: session.id,
    };
  },
};
