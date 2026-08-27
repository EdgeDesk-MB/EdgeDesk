import { describe, expect, it } from "vitest";
import { DEFAULT_BOOTSTRAP_ADMIN_EMAIL } from "@/lib/admin/emails";
import {
  adminBillingStatusLabel,
  COMPLIMENTARY_OPERATOR_ENTITLEMENT,
  needsComplimentaryOperatorGrant,
  overlayOperatorSubscriptionAccount,
  shouldBlockComplimentaryOperatorCheckout,
} from "./operator-complimentary";
import type { SubscriptionAccount } from "./subscription-view";

const freeAccount: SubscriptionAccount = {
  plan: "free",
  billingStatus: "none",
  trialEndsAt: null,
  cancelAt: null,
  founding: false,
  canManage: false,
};

describe("needsComplimentaryOperatorGrant", () => {
  it("grants the bootstrap admin when the row is still Free", () => {
    expect(
      needsComplimentaryOperatorGrant({
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
        role: "user",
        plan: "free",
        billingStatus: "none",
        stripeCustomerId: null,
      })
    ).toBe(true);
  });

  it("does not overwrite a Stripe-backed trial", () => {
    expect(
      needsComplimentaryOperatorGrant({
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
        role: "user",
        plan: "edge",
        billingStatus: "trialing",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
      })
    ).toBe(false);
  });

  it("leaves ordinary customers on Free", () => {
    expect(
      needsComplimentaryOperatorGrant({
        email: "punter@example.com",
        role: "user",
        plan: "free",
        billingStatus: "none",
        stripeCustomerId: null,
      })
    ).toBe(false);
  });
});

describe("overlayOperatorSubscriptionAccount", () => {
  it("promotes a Free operator row to Edge", () => {
    expect(
      overlayOperatorSubscriptionAccount(
        { email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL, role: "user" },
        freeAccount
      )
    ).toEqual({ ...freeAccount, plan: "edge", billingStatus: "active" });
  });

  it("keeps a live Stripe trial as-is", () => {
    const trial: SubscriptionAccount = {
      plan: "edge",
      billingStatus: "trialing",
      trialEndsAt: 1,
      cancelAt: null,
      founding: false,
      canManage: true,
    };
    expect(
      overlayOperatorSubscriptionAccount(
        { email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL, role: "user" },
        trial
      )
    ).toEqual(trial);
  });
});

describe("shouldBlockComplimentaryOperatorCheckout", () => {
  it("blocks paid checkout when the operator has no Stripe customer", () => {
    expect(
      shouldBlockComplimentaryOperatorCheckout({
        operator: true,
        stripeCustomerId: null,
        listedStripeCustomerId: null,
      })
    ).toBe(true);
  });

  it("allows checkout when Stripe already knows the customer", () => {
    expect(
      shouldBlockComplimentaryOperatorCheckout({
        operator: true,
        stripeCustomerId: null,
        listedStripeCustomerId: "cus_live",
      })
    ).toBe(false);
  });
});

describe("adminBillingStatusLabel", () => {
  it("marks a live Edge row with no Stripe customer as complimentary", () => {
    expect(
      adminBillingStatusLabel({
        plan: "edge",
        billingStatus: "active",
        stripeCustomerId: null,
      })
    ).toBe("Complimentary");
  });

  it("keeps Stripe-backed trial copy", () => {
    expect(
      adminBillingStatusLabel({
        plan: "edge",
        billingStatus: "trialing",
        stripeCustomerId: "cus_test",
      })
    ).toBe("trialing");
  });
});

describe("COMPLIMENTARY_OPERATOR_ENTITLEMENT", () => {
  it("is Edge active with no Stripe ids", () => {
    expect(COMPLIMENTARY_OPERATOR_ENTITLEMENT).toMatchObject({
      plan: "edge",
      billingStatus: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
  });
});
