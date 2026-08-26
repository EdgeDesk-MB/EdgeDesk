/**
 * Checkout Session params (EDGE-4). Trial is applied here, not on the Price.
 * Do not pass payment_method_types. Do not enable automatic_tax until registered.
 */
import type Stripe from "stripe";
import type { PlanId } from "@/lib/entitlements/plans";
import type { BillingInterval } from "@/lib/billing/public-offer";
import {
  publicStripePriceId,
  trialPeriodDaysForCheckout,
  type PaidPlanId,
} from "@/lib/billing/stripe-prices";
import { liveDeskHref } from "@/lib/demo/public-demo";

export type CheckoutFrom = "setup";

export function parsePaidCheckout(
  plan: string | null | undefined,
  interval: string | null | undefined
): { plan: PaidPlanId; interval: BillingInterval } | null {
  if (plan !== "core" && plan !== "edge") return null;
  if (interval !== "month" && interval !== "year") return null;
  return { plan, interval };
}

export function parseCheckoutFrom(
  value: string | null | undefined
): CheckoutFrom | null {
  return value === "setup" ? "setup" : null;
}

export function checkoutPriceId(
  plan: PaidPlanId,
  interval: BillingInterval
): string | null {
  return publicStripePriceId(plan, interval);
}

export function buildSubscriptionCheckoutParams(input: {
  priceId: string;
  plan: PaidPlanId;
  interval: BillingInterval;
  clerkUserId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string | null;
  founding?: boolean;
  /** EDGE-104: false when the person has already consumed their one trial. */
  trialEligible?: boolean;
}): Stripe.Checkout.SessionCreateParams {
  const trialDays =
    input.trialEligible === false ? 0 : trialPeriodDaysForCheckout(input.plan);
  const metadata = {
    clerkUserId: input.clerkUserId,
    plan: input.plan,
    interval: input.interval,
    ...(input.founding ? { founding: "true" } : {}),
  };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.clerkUserId,
    metadata,
    subscription_data: {
      metadata,
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    allow_promotion_codes: true,
    // VAT later. Managed Payments is on by default and demands a tax code.
    managed_payments: { enabled: false },
    // Needs Terms + Privacy URLs in Stripe Dashboard → Public details.
    consent_collection: { terms_of_service: "required" },
  };

  if (input.customerId) {
    params.customer = input.customerId;
  } else if (input.customerEmail) {
    params.customer_email = input.customerEmail;
  }

  return params;
}

export function subscribeCancelHref(from?: CheckoutFrom | null): string {
  return from === "setup" ? "/setup" : "/#pricing";
}

/**
 * EDGE-82: a live subscription means checkout must not run — a second
 * subscription would stack and the old sub's cancel webhook would later wipe
 * the new entitlement. Live = active / trialing / past_due (a scheduled
 * cancel is still live until the period ends).
 */
export function billingStatusIsLive(
  status: string | null | undefined
): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** Stripe-side mirror of billingStatusIsLive for the webhook-lag fallback. */
export function stripeSubscriptionIsLive(
  status: string | null | undefined
): boolean {
  return billingStatusIsLive(status);
}

/**
 * EDGE-104: one trial per person. A subscription that ever had a trial
 * window counts, whatever its final status - canceled trials included.
 */
export function subscriptionConsumedTrial(sub: {
  trial_start?: number | null;
  trial_end?: number | null;
}): boolean {
  return sub.trial_start != null || sub.trial_end != null;
}

/**
 * Prior-trial signal from both sides: the local app_users row (set by the
 * webhook) and the Stripe customer's subscription history (covers webhook
 * gaps and a fresh Clerk account reusing a trialled email).
 */
export function priorTrialConsumed(
  appUserTrialEndsAt: number | null | undefined,
  subs: readonly { trial_start?: number | null; trial_end?: number | null }[]
): boolean {
  if (appUserTrialEndsAt != null) return true;
  return subs.some(subscriptionConsumedTrial);
}

export function subscribeSuccessHref(
  plan: PaidPlanId,
  interval: BillingInterval,
  sessionId = "{CHECKOUT_SESSION_ID}",
  from?: CheckoutFrom | null
): string {
  // Stripe substitutes {CHECKOUT_SESSION_ID} only if the braces stay literal.
  const href = `/subscribe/success?session_id=${sessionId}&plan=${plan}&interval=${interval}`;
  return from === "setup" ? `${href}&from=setup` : href;
}

export function signUpRedirectForPlan(
  plan: PlanId | string | null | undefined,
  interval: string | null | undefined,
  from?: CheckoutFrom | null,
  ref?: string | null
): string {
  const paid = parsePaidCheckout(
    plan,
    interval === "year" ? "year" : plan ? "month" : null
  );
  const refParam = ref?.trim() || null;
  if (!paid) {
    const setup = liveDeskHref("/setup");
    if (!refParam) return setup;
    const joiner = setup.includes("?") ? "&" : "?";
    return `${setup}${joiner}ref=${encodeURIComponent(refParam)}`;
  }
  const params = new URLSearchParams({
    plan: paid.plan,
    interval: paid.interval,
  });
  if (from === "setup") params.set("from", "setup");
  if (refParam) params.set("ref", refParam);
  return `/subscribe?${params.toString()}`;
}
