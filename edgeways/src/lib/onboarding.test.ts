import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  decideOnboardingOpen,
  isOnboardingComplete,
  markOnboardingComplete,
  onboardingStorageKey,
  resetOnboarding,
} from "@/lib/onboarding";

describe("onboarding", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  it("starts incomplete", () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it("marks complete", () => {
    markOnboardingComplete();
    expect(isOnboardingComplete()).toBe(true);
  });

  it("resets onboarding", () => {
    markOnboardingComplete();
    resetOnboarding();
    expect(isOnboardingComplete()).toBe(false);
  });

  it("keys the complete flag by Clerk user so logins do not share it", () => {
    markOnboardingComplete("user_owner");
    expect(isOnboardingComplete("user_owner")).toBe(true);
    expect(isOnboardingComplete("user_other")).toBe(false);
    expect(onboardingStorageKey("user_owner")).toBe(
      "edgeways:onboarding-complete:user_owner"
    );
    resetOnboarding("user_owner");
    expect(isOnboardingComplete("user_owner")).toBe(false);
  });

  it("opens setup after subscribe even when the desk already has activity", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: true,
        ageConfirmed: true,
        hasDeskActivity: true,
        needsSetup: false,
        onboardingComplete: true,
      })
    ).toBe("setup");
  });

  it("keeps the age gate ahead of post-subscribe setup", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: true,
        ageConfirmed: false,
        hasDeskActivity: false,
        needsSetup: true,
        onboardingComplete: false,
      })
    ).toBe("age");
  });

  it("does not re-open the age gate after hosted set-up", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: false,
        ageConfirmed: false,
        hasDeskActivity: true,
        needsSetup: false,
        onboardingComplete: true,
      })
    ).toBe("none");
  });

  it("does not bounce a finished set-up back to the setup page", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: false,
        ageConfirmed: true,
        hasDeskActivity: false,
        needsSetup: true,
        onboardingComplete: true,
      })
    ).toBe("none");
  });

  it("sends an empty signed-in desk to the full-page setup", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: false,
        ageConfirmed: true,
        hasDeskActivity: false,
        needsSetup: true,
        onboardingComplete: false,
      })
    ).toBe("setup-page");
  });

  it("skips welcome and setup auto-open on the public demo", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: false,
        ageConfirmed: true,
        hasDeskActivity: true,
        needsSetup: false,
        onboardingComplete: false,
        publicDemo: true,
      })
    ).toBe("none");
  });

  it("opens the modal wizard on public demo when setup is forced", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: false,
        ageConfirmed: true,
        hasDeskActivity: true,
        needsSetup: false,
        onboardingComplete: false,
        publicDemo: true,
        forceDemoSetup: true,
      })
    ).toBe("setup");
  });

  it("does not auto-open the product tour on an empty desk", () => {
    expect(
      decideOnboardingOpen({
        forceOnboard: false,
        ageConfirmed: true,
        hasDeskActivity: false,
        needsSetup: false,
        onboardingComplete: false,
      })
    ).toBe("none");
  });
});
