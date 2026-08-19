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

export function stripePortalConfigurationId(): string | null {
  return process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}
