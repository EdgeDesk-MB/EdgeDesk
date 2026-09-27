import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  REFERRAL_SETTLE_WINDOW_MS,
  crossedIntoProfit,
  hasRecentReferralSettleAction,
  isReferralPromptDismissed,
  isReferralSettleRoute,
  isReferralSubscriber,
  markReferralPromptDismissed,
  noteReferralSettleAction,
  referralPromptStorageKey,
  resetReferralSettleActionForTests,
  shouldArmReferralAsk,
} from "@/lib/referrals/prompt";

describe("referral prompt dismiss latch", () => {
  const local = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => local.set(key, value),
      removeItem: (key: string) => local.delete(key),
      clear: () => local.clear(),
    });
  });

  it("keys the dismiss flag by Clerk user", () => {
    expect(referralPromptStorageKey("user_owner")).toBe(
      "edgeways:referral-prompt-dismissed:user_owner"
    );
    markReferralPromptDismissed("user_owner");
    expect(isReferralPromptDismissed("user_owner")).toBe(true);
    expect(isReferralPromptDismissed("user_other")).toBe(false);
  });

  it("starts undismissed", () => {
    expect(isReferralPromptDismissed()).toBe(false);
  });
});

describe("isReferralSubscriber", () => {
  it("accepts a live Core or Edge subscription, including trial", () => {
    expect(
      isReferralSubscriber({ plan: "core", billingStatus: "active" })
    ).toBe(true);
    expect(
      isReferralSubscriber({ plan: "edge", billingStatus: "trialing" })
    ).toBe(true);
    expect(
      isReferralSubscriber({ plan: "core", billingStatus: "past_due" })
    ).toBe(true);
  });

  it("rejects free, cancelled, or missing billing", () => {
    expect(
      isReferralSubscriber({ plan: "free", billingStatus: "active" })
    ).toBe(false);
    expect(
      isReferralSubscriber({ plan: "core", billingStatus: "canceled" })
    ).toBe(false);
    expect(
      isReferralSubscriber({ plan: "edge", billingStatus: "none" })
    ).toBe(false);
    expect(isReferralSubscriber(null)).toBe(false);
  });
});

describe("isReferralSettleRoute", () => {
  it("counts settle and completion mutations", () => {
    expect(isReferralSettleRoute("PATCH", "/api/bets/12")).toBe(true);
    expect(isReferralSettleRoute("POST", "/api/bets")).toBe(true);
    expect(isReferralSettleRoute("POST", "/api/events/4/result")).toBe(true);
    expect(isReferralSettleRoute("PATCH", "/api/acca/legs/9")).toBe(true);
    expect(isReferralSettleRoute("PATCH", "/api/bet-builder/3")).toBe(true);
    expect(isReferralSettleRoute("PATCH", "/api/boosts/2")).toBe(true);
    expect(isReferralSettleRoute("PATCH", "/api/casino/7?x=1")).toBe(true);
    expect(isReferralSettleRoute("POST", "/api/racing/sync-results")).toBe(true);
  });

  it("ignores reads, imports, restores, demo data and settings", () => {
    expect(isReferralSettleRoute("GET", "/api/bets")).toBe(false);
    expect(isReferralSettleRoute("POST", "/api/import/bets")).toBe(false);
    expect(isReferralSettleRoute("POST", "/api/import/platform")).toBe(false);
    expect(isReferralSettleRoute("POST", "/api/data/restore")).toBe(false);
    expect(isReferralSettleRoute("POST", "/api/data/demo")).toBe(false);
    expect(isReferralSettleRoute("PATCH", "/api/settings")).toBe(false);
    expect(isReferralSettleRoute("POST", "/api/betsy")).toBe(false);
  });
});

describe("recent settle action", () => {
  beforeEach(() => resetReferralSettleActionForTests());

  it("holds for the settle window only", () => {
    expect(hasRecentReferralSettleAction(1_000)).toBe(false);
    noteReferralSettleAction("PATCH", "/api/bets/1", 1_000);
    expect(hasRecentReferralSettleAction(1_000 + REFERRAL_SETTLE_WINDOW_MS)).toBe(
      true
    );
    expect(
      hasRecentReferralSettleAction(1_001 + REFERRAL_SETTLE_WINDOW_MS)
    ).toBe(false);
  });

  it("is not set by an import", () => {
    noteReferralSettleAction("POST", "/api/import/bets", 1_000);
    expect(hasRecentReferralSettleAction(1_000)).toBe(false);
  });
});

describe("crossedIntoProfit", () => {
  it("fires when realised P&L goes from £0 or less to above £0", () => {
    expect(crossedIntoProfit(0, 4.2)).toBe(true);
    expect(crossedIntoProfit(-0.62, 11.31)).toBe(true);
  });

  it("does not fire on first load, staying positive, or a pence-dust move", () => {
    expect(crossedIntoProfit(null, 4.2)).toBe(false);
    expect(crossedIntoProfit(12, 18)).toBe(false);
    expect(crossedIntoProfit(-3, -1)).toBe(false);
    expect(crossedIntoProfit(-0.5, 0.004)).toBe(false);
    expect(crossedIntoProfit(0.004, 5)).toBe(true);
  });
});

describe("shouldArmReferralAsk", () => {
  const ready = {
    before: -0.5,
    after: 7.25,
    recentSettle: true,
    signedIn: true,
    publicDemo: false,
    subscribed: true,
    alreadyAsked: false,
  };

  it("arms on the first in-app settle that crosses into profit", () => {
    expect(shouldArmReferralAsk(ready)).toBe(true);
  });

  it("stays closed for profit already on the desk at load (seed or import)", () => {
    expect(shouldArmReferralAsk({ ...ready, before: null })).toBe(false);
    expect(shouldArmReferralAsk({ ...ready, before: 2_400 })).toBe(false);
  });

  it("stays closed when no settle was made in this tab", () => {
    expect(shouldArmReferralAsk({ ...ready, recentSettle: false })).toBe(false);
  });

  it("stays closed once asked, without a subscription, signed out or in the demo", () => {
    expect(shouldArmReferralAsk({ ...ready, alreadyAsked: true })).toBe(false);
    expect(shouldArmReferralAsk({ ...ready, subscribed: false })).toBe(false);
    expect(shouldArmReferralAsk({ ...ready, signedIn: false })).toBe(false);
    expect(shouldArmReferralAsk({ ...ready, publicDemo: true })).toBe(false);
  });
});
