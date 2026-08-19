const ONBOARDING_KEY = "edgeways:onboarding-complete";

export function onboardingStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${ONBOARDING_KEY}:${id}` : ONBOARDING_KEY;
}

export type OnboardingOpen = "age" | "setup" | "setup-page" | "welcome" | "none";

/** First-run and post-subscribe (`?onboard=1`) decide what to open. */
export function decideOnboardingOpen(input: {
  forceOnboard: boolean;
  ageConfirmed: boolean;
  hasDeskActivity: boolean;
  needsSetup: boolean;
  onboardingComplete: boolean;
  publicDemo?: boolean;
  forceDemoSetup?: boolean;
}): OnboardingOpen {
  if (!input.ageConfirmed && !input.onboardingComplete) return "age";
  if (input.publicDemo) {
    return input.forceDemoSetup ? "setup" : "none";
  }
  if (input.forceOnboard) return "setup";
  if (input.needsSetup && !input.onboardingComplete) return "setup-page";
  void input.hasDeskActivity;
  // Empty Home is the hosted welcome. Keep the 4-step tour in Help.
  return "none";
}

export function isOnboardingComplete(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(onboardingStorageKey(userId)) === "1";
}

export function markOnboardingComplete(userId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(onboardingStorageKey(userId), "1");
}

export function resetOnboarding(userId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(onboardingStorageKey(userId));
}
