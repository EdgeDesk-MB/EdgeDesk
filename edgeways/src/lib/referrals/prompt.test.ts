import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasReferralSuccessMoment,
  isReferralPromptDismissed,
  isReferralPromptHidden,
  isReferralPromptSnoozed,
  isReferralSubscriber,
  markReferralPromptDismissed,
  referralPromptStorageKey,
  shouldOpenReferralPrompt,
  snoozeReferralPrompt,
} from "@/lib/referrals/prompt";

describe("referral prompt", () => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    session.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => local.set(key, value),
      removeItem: (key: string) => local.delete(key),
      clear: () => local.clear(),
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
      removeItem: (key: string) => session.delete(key),
      clear: () => session.clear(),
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
    expect(isReferralPromptHidden()).toBe(false);
  });

  it("snoozes for the session without a lasting dismiss", () => {
    snoozeReferralPrompt("user_owner");
    expect(isReferralPromptSnoozed("user_owner")).toBe(true);
    expect(isReferralPromptDismissed("user_owner")).toBe(false);
    expect(isReferralPromptHidden("user_owner")).toBe(true);
    expect(local.size).toBe(0);
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

describe("hasReferralSuccessMoment", () => {
  it("qualifies on a settled bet with profit", () => {
    expect(
      hasReferralSuccessMoment({
        bets: [{ status: "won", actualProfit: 4.2 }],
        casinoSettlements: [],
      })
    ).toBe(true);
  });

  it("qualifies on a completed casino offer with profit", () => {
    expect(
      hasReferralSuccessMoment({
        bets: [{ status: "lost", actualProfit: -8 }],
        casinoSettlements: [{ amount: 11.31 }],
      })
    ).toBe(true);
  });

  it("qualifies on early payout or half-win with profit", () => {
    expect(
      hasReferralSuccessMoment({
        bets: [{ status: "early_payout", actualProfit: 1.2 }],
        casinoSettlements: [],
      })
    ).toBe(true);
    expect(
      hasReferralSuccessMoment({
        bets: [{ status: "half_win", actualProfit: 0.4 }],
        casinoSettlements: [],
      })
    ).toBe(true);
  });

  it("ignores open, void, break-even, and losing completions", () => {
    expect(
      hasReferralSuccessMoment({
        bets: [
          { status: "open", actualProfit: 12 },
          { status: "void", actualProfit: 3 },
          { status: "won", actualProfit: 0 },
          { status: "lost", actualProfit: -2.5 },
          { status: "push", actualProfit: 0 },
        ],
        casinoSettlements: [{ amount: 0 }, { amount: -4 }],
      })
    ).toBe(false);
  });
});

describe("shouldOpenReferralPrompt", () => {
  const ready = {
    pathname: "/desk",
    signedIn: true,
    publicDemo: false,
    suppressed: false,
    hidden: false,
    subscribed: true,
    hasSuccessMoment: true,
  };

  it("opens on the homepage after a subscribed success moment", () => {
    expect(shouldOpenReferralPrompt(ready)).toBe(true);
    expect(shouldOpenReferralPrompt({ ...ready, pathname: "/desk/" })).toBe(
      true
    );
  });

  it("stays closed on other routes", () => {
    expect(shouldOpenReferralPrompt({ ...ready, pathname: "/settings" })).toBe(
      false
    );
    expect(shouldOpenReferralPrompt({ ...ready, pathname: "/offers" })).toBe(
      false
    );
  });

  it("stays closed without a subscription or a profitable completion", () => {
    expect(shouldOpenReferralPrompt({ ...ready, subscribed: false })).toBe(
      false
    );
    expect(
      shouldOpenReferralPrompt({ ...ready, hasSuccessMoment: false })
    ).toBe(false);
  });

  it("stays closed in public demo, while other dialogs are up, or when hidden", () => {
    expect(shouldOpenReferralPrompt({ ...ready, publicDemo: true })).toBe(
      false
    );
    expect(shouldOpenReferralPrompt({ ...ready, signedIn: false })).toBe(false);
    expect(shouldOpenReferralPrompt({ ...ready, suppressed: true })).toBe(
      false
    );
    expect(shouldOpenReferralPrompt({ ...ready, hidden: true })).toBe(false);
  });
});
