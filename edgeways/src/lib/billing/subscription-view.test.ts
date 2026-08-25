import { describe, expect, it } from "vitest";
import {
  billingStatusBadgeVariant,
  billingStatusLabel,
  isCancelling,
  planDisplayName,
  showSubscribeActions,
  subscriptionAccountFromUser,
  subscriptionDateLabel,
  subscriptionDetail,
} from "./subscription-view";

describe("subscriptionAccountFromUser", () => {
  it("defaults a missing row to Free", () => {
    expect(subscriptionAccountFromUser(undefined)).toEqual({
      plan: "free",
      billingStatus: "none",
      trialEndsAt: null,
      cancelAt: null,
      founding: false,
      canManage: false,
    });
  });

  it("lets a paid row open the portal", () => {
    const account = subscriptionAccountFromUser({
      plan: "edge",
      billingStatus: "trialing",
      trialEndsAt: 1_777_000_000_000,
      cancelAt: null,
      founding: false,
      stripeCustomerId: "cus_test",
    });
    expect(account.canManage).toBe(true);
    expect(showSubscribeActions(account)).toBe(false);
  });

  it("hides Manage billing until Stripe has a customer", () => {
    const account = subscriptionAccountFromUser({
      plan: "edge",
      billingStatus: "trialing",
      trialEndsAt: 1_777_000_000_000,
      cancelAt: null,
      founding: false,
      stripeCustomerId: null,
    });
    expect(account.canManage).toBe(false);
    expect(showSubscribeActions(account)).toBe(false);
  });

  it("keeps Manage billing after cancel when Stripe still has the customer", () => {
    const account = subscriptionAccountFromUser({
      plan: "free",
      billingStatus: "canceled",
      trialEndsAt: null,
      cancelAt: null,
      founding: false,
      stripeCustomerId: "cus_test",
    });
    expect(account.canManage).toBe(true);
    expect(showSubscribeActions(account)).toBe(true);
  });
});

describe("subscription copy", () => {
  it("names plans in sentence-case titles", () => {
    expect(planDisplayName("edge")).toBe("Edge");
    expect(planDisplayName("core")).toBe("Core");
    expect(planDisplayName("free")).toBe("Free");
  });

  it("labels billing status for the desk", () => {
    expect(billingStatusLabel("trialing")).toBe("Trial");
    expect(billingStatusLabel("active")).toBe("Active");
    expect(billingStatusLabel("past_due")).toBe("Payment failed");
    expect(billingStatusLabel("canceled")).toBe("Cancelled");
    expect(billingStatusLabel("none")).toBe("No subscription");
    expect(billingStatusBadgeVariant("active")).toBe("success");
    expect(billingStatusBadgeVariant("trialing")).toBe("outline");
    expect(billingStatusBadgeVariant("past_due")).toBe("destructive");
    expect(billingStatusBadgeVariant("canceled")).toBe("outline");
  });

  it("dates the trial in British short form", () => {
    expect(subscriptionDateLabel(Date.UTC(2026, 7, 29, 12))).toBe("29 Aug 2026");
  });

  it("explains trial, past due, and Free", () => {
    expect(
      subscriptionDetail({
        plan: "edge",
        billingStatus: "trialing",
        trialEndsAt: Date.UTC(2026, 7, 29, 12),
        cancelAt: null,
        founding: false,
        canManage: true,
      })
    ).toBe("Trial ends 29 Aug 2026");
    expect(
      subscriptionDetail({
        plan: "edge",
        billingStatus: "trialing",
        trialEndsAt: Date.UTC(2026, 7, 29, 12),
        cancelAt: null,
        founding: true,
        canManage: true,
      })
    ).toBe("Trial ends 29 Aug 2026. Founding rate after that.");
    expect(
      subscriptionDetail({
        plan: "edge",
        billingStatus: "past_due",
        trialEndsAt: null,
        cancelAt: null,
        founding: false,
        canManage: true,
      })
    ).toBe("Update the card to keep the desk.");
    expect(
      subscriptionDetail({
        plan: "free",
        billingStatus: "none",
        trialEndsAt: null,
        cancelAt: null,
        founding: false,
        canManage: false,
      })
    ).toBe("Calculators and a manual bet log.");
    expect(
      subscriptionDetail({
        plan: "edge",
        billingStatus: "active",
        trialEndsAt: null,
        cancelAt: null,
        founding: true,
        canManage: true,
      })
    ).toBe("You are on the founding rate.");
  });

  it("highlights a scheduled cancellation while access continues", () => {
    const cancellingTrial = {
      plan: "edge",
      billingStatus: "trialing",
      trialEndsAt: Date.UTC(2026, 8, 8, 12),
      cancelAt: Date.UTC(2026, 8, 8, 12),
      founding: false,
      canManage: true,
    } as const;
    expect(isCancelling(cancellingTrial)).toBe(true);
    expect(subscriptionDetail(cancellingTrial)).toBe(
      "Trial cancelled. You keep Edge until 8 Sept 2026."
    );
    expect(
      subscriptionDetail({
        plan: "core",
        billingStatus: "active",
        trialEndsAt: null,
        cancelAt: Date.UTC(2026, 8, 8, 12),
        founding: false,
        canManage: true,
      })
    ).toBe("Cancellation scheduled. You keep Core until 8 Sept 2026.");
    expect(
      isCancelling({
        plan: "free",
        billingStatus: "canceled",
        trialEndsAt: null,
        cancelAt: null,
        founding: false,
        canManage: true,
      })
    ).toBe(false);
  });
});
