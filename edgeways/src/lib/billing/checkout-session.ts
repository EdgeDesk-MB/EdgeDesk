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
}): Stripe.Checkout.SessionCreateParams {
  const trialDays = trialPeriodDaysForCheckout(input.plan);
  const metadata = {
    clerkUserId: input.clerkUserId,
    plan: input.plan,
    interval: input.interval,
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
  from?: CheckoutFrom | null
): string {
  const paid = parsePaidCheckout(
    plan,
    interval === "year" ? "year" : plan ? "month" : null
  );
  if (!paid) return liveDeskHref("/setup");
  const params = new URLSearchParams({
    plan: paid.plan,
    interval: paid.interval,
  });
  if (from === "setup") params.set("from", "setup");
  return `/subscribe?${params.toString()}`;
}
