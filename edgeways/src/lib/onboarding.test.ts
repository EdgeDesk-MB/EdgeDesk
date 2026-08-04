import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  isOnboardingComplete,
  markOnboardingComplete,
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
});
