const ONBOARDING_KEY = "edgeways:onboarding-complete";
const AGE_KEY = "edgeways:age-confirmed-at";

export function onboardingStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${ONBOARDING_KEY}:${id}` : ONBOARDING_KEY;
}

export function ageConfirmedStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${AGE_KEY}:${id}` : AGE_KEY;
}

/** Device-local 18+ mark so a hosted settings 500 cannot trap the gate. */
export function readAgeConfirmedAt(userId?: string | null): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ageConfirmedStorageKey(userId));
  const n = raw == null || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export function markAgeConfirmedAt(
  at: number,
  userId?: string | null
): number | null {
  if (typeof window === "undefined") return null;
  const value = Number.isFinite(at) && at > 0 ? Math.trunc(at) : Date.now();
  localStorage.setItem(ageConfirmedStorageKey(userId), String(value));
  return value;
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
