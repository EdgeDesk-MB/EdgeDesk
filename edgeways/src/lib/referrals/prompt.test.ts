import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isReferralPromptDismissed,
  isReferralPromptHidden,
  isReferralPromptSnoozed,
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

describe("shouldOpenReferralPrompt", () => {
  const ready = {
    pathname: "/desk",
    signedIn: true,
    publicDemo: false,
    suppressed: false,
    hidden: false,
  };

  it("opens on the homepage for a signed-in live desk", () => {
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
