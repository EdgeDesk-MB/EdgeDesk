import { describe, expect, it } from "vitest";
import {
  billingStatusIsLive,
  buildSubscriptionCheckoutParams,
  parseCheckoutFrom,
  parsePaidCheckout,
  priorTrialConsumed,
  referralCheckoutCouponId,
  signUpRedirectForPlan,
  stripeSubscriptionIsLive,
  subscriptionConsumedTrial,
  subscribeCancelHref,
  subscribeSuccessHref,
} from "@/lib/billing/checkout-session";

describe("checkout session", () => {
  it("rejects Free and unknown plans", () => {
    expect(parsePaidCheckout("free", "month")).toBeNull();
    expect(parsePaidCheckout("edge", "week")).toBeNull();
    expect(parsePaidCheckout("edge", "month")).toEqual({
      plan: "edge",
      interval: "month",
    });
  });

  it("puts the 14-day trial on Edge only", () => {
    const edge = buildSubscriptionCheckoutParams({
      priceId: "price_edge",
      plan: "edge",
      interval: "month",
      clerkUserId: "user_1",
      successUrl: "https://edgeways.app/subscribe/success?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://edgeways.app/#pricing",
      customerEmail: "sam@example.com",
    });
    expect(edge.mode).toBe("subscription");
    expect(edge.subscription_data?.trial_period_days).toBe(14);
    expect(edge.payment_method_types).toBeUndefined();
    expect(edge.automatic_tax).toBeUndefined();
    expect(edge.managed_payments).toEqual({ enabled: false });
    expect(edge.consent_collection).toEqual({ terms_of_service: "required" });
    expect(edge.allow_promotion_codes).toBe(true);
    expect(edge.discounts).toBeUndefined();
    expect(edge.line_items).toEqual([{ price: "price_edge", quantity: 1 }]);
    expect(edge.metadata).toEqual({
      clerkUserId: "user_1",
      plan: "edge",
      interval: "month",
    });

    const core = buildSubscriptionCheckoutParams({
      priceId: "price_core",
      plan: "core",
      interval: "year",
      clerkUserId: "user_1",
      successUrl: "https://edgeways.app/subscribe/success",
      cancelUrl: "https://edgeways.app/#pricing",
      customerId: "cus_123",
    });
    expect(core.subscription_data?.trial_period_days).toBeUndefined();
    expect(core.customer).toBe("cus_123");
    expect(core.customer_email).toBeUndefined();
  });

  it("marks invite founding on Edge monthly metadata", () => {
    const session = buildSubscriptionCheckoutParams({
      priceId: "price_founding",
      plan: "edge",
      interval: "month",
      clerkUserId: "user_1",
      successUrl: "https://edgeways.app/subscribe/success",
      cancelUrl: "https://edgeways.app/#pricing",
      founding: true,
    });
    expect(session.metadata).toEqual({
      clerkUserId: "user_1",
      plan: "edge",
      interval: "month",
      founding: "true",
    });
    expect(session.subscription_data?.metadata).toEqual(session.metadata);
    expect(session.line_items).toEqual([{ price: "price_founding", quantity: 1 }]);
    expect(session.allow_promotion_codes).toBeUndefined();
    expect(session.discounts).toBeUndefined();
  });

  it("auto-applies the referral coupon from a share-link claim", () => {
    const session = buildSubscriptionCheckoutParams({
      priceId: "price_edge",
      plan: "edge",
      interval: "month",
      clerkUserId: "user_1",
      successUrl: "https://edgeways.app/subscribe/success",
      cancelUrl: "https://edgeways.app/#pricing",
      referred: true,
      referralCouponId: "edge_referral_50_once",
    });
    expect(session.discounts).toEqual([{ coupon: "edge_referral_50_once" }]);
    expect(session.allow_promotion_codes).toBeUndefined();
  });

  it("does not stack the referral coupon on Founding checkout", () => {
    const session = buildSubscriptionCheckoutParams({
      priceId: "price_founding",
      plan: "edge",
      interval: "month",
      clerkUserId: "user_1",
      successUrl: "https://edgeways.app/subscribe/success",
      cancelUrl: "https://edgeways.app/#pricing",
      founding: true,
      referred: true,
      referralCouponId: "edge_referral_50_once",
    });
    expect(session.discounts).toBeUndefined();
    expect(session.allow_promotion_codes).toBeUndefined();
    expect(session.metadata?.founding).toBe("true");
  });

  it("does not auto-apply without a coupon id", () => {
    expect(
      referralCheckoutCouponId({
        referred: true,
        couponId: "  ",
      })
    ).toBeNull();
  });

  it("sends paid sign-ups to subscribe, Free to live setup", () => {
    expect(signUpRedirectForPlan("edge", "year")).toBe(
      "/subscribe?plan=edge&interval=year"
    );
    expect(signUpRedirectForPlan("core", null)).toBe(
      "/subscribe?plan=core&interval=month"
    );
    expect(signUpRedirectForPlan("edge", "month", "setup")).toBe(
      "/subscribe?plan=edge&interval=month&from=setup"
    );
    expect(signUpRedirectForPlan("free", "month")).toBe("/setup?live=1");
    expect(signUpRedirectForPlan("free", "month", null, "K7Q2-9XTM")).toBe(
      "/setup?live=1&ref=K7Q2-9XTM"
    );
    expect(signUpRedirectForPlan("edge", "month", null, "K7Q2-9XTM")).toBe(
      "/subscribe?plan=edge&interval=month&ref=K7Q2-9XTM"
    );
    expect(subscribeSuccessHref("edge", "month")).toBe(
      "/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=edge&interval=month"
    );
    expect(subscribeSuccessHref("edge", "month", undefined, "setup")).toBe(
      "/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=edge&interval=month&from=setup"
    );
    expect(parseCheckoutFrom("setup")).toBe("setup");
    expect(parseCheckoutFrom("desk")).toBeNull();
    expect(subscribeCancelHref()).toBe("/#pricing");
    expect(subscribeCancelHref("setup")).toBe("/setup");
  });

  it("EDGE-104: drops the trial when the person already had one", () => {
    const second = buildSubscriptionCheckoutParams({
      priceId: "price_edge",
      plan: "edge",
      interval: "month",
      clerkUserId: "user_1",
      successUrl: "https://edgeways.app/subscribe/success",
      cancelUrl: "https://edgeways.app/#pricing",
      customerId: "cus_123",
      trialEligible: false,
    });
    expect(second.subscription_data?.trial_period_days).toBeUndefined();
  });

  it("EDGE-104: detects a consumed trial from local row or Stripe history", () => {
    expect(priorTrialConsumed(1_777_000_000_000, [])).toBe(true);
    expect(priorTrialConsumed(null, [{ trial_end: 1_777_000_000 }])).toBe(true);
    expect(priorTrialConsumed(null, [{ trial_start: 1_777_000_000 }])).toBe(true);
    // A canceled trial still counts - it was consumed.
    expect(
      subscriptionConsumedTrial({ trial_start: 1, trial_end: 2 })
    ).toBe(true);
    // A plain paid sub with no trial window leaves the trial available.
    expect(
      priorTrialConsumed(null, [{ trial_start: null, trial_end: null }])
    ).toBe(false);
    expect(priorTrialConsumed(null, [])).toBe(false);
    expect(priorTrialConsumed(undefined, [])).toBe(false);
  });

  it("EDGE-82: treats active/trialing/past_due as live subscriptions", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(billingStatusIsLive(status)).toBe(true);
      expect(stripeSubscriptionIsLive(status)).toBe(true);
    }
  });

  it("EDGE-82: canceled, lapsed and incomplete subs may re-checkout", () => {
    for (const status of ["canceled", "none", "incomplete", "incomplete_expired", "unpaid", null, undefined]) {
      expect(billingStatusIsLive(status)).toBe(false);
      expect(stripeSubscriptionIsLive(status)).toBe(false);
    }
  });
});
