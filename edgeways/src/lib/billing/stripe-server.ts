import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!client || process.env.STRIPE_SECRET_KEY !== key) {
    client = new Stripe(key);
  }
  return client;
}

export type StripeMode = "test" | "live";

/** Key prefix is the source of truth: sk_test_* vs sk_live_*. */
export function stripeMode(): StripeMode | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return key.startsWith("sk_live_") ? "live" : "test";
}

export function stripePortalConfigurationId(): string | null {
  return process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}
