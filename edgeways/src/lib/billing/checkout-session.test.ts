import { describe, expect, it } from "vitest";
import {
  buildSubscriptionCheckoutParams,
  parseCheckoutFrom,
  parsePaidCheckout,
  signUpRedirectForPlan,
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
    expect(subscribeSuccessHref("edge", "month")).toBe(
      "/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=edge&interval=month"
    );
    expect(subscribeSuccessHref("edge", "month", undefined, "setup")).toBe(
      "/subscribe/success?session_id={CHECKOUT_SESSION_ID}&plan=edge&interval=month&from=setup"
    );
    expect(parseCheckoutFrom("setup")).toBe("setup");
    expect(parseCheckoutFrom("desk")).toBeNull();
  });
});
