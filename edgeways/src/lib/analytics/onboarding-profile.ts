import type {
  OnboardingExperienceId,
  OnboardingHeardId,
  OnboardingWhyId,
} from "@/lib/onboarding-profile";

export type OnboardingAnalyticsPayload = {
  experience: OnboardingExperienceId;
  whyHere: OnboardingWhyId[];
  attribution: OnboardingHeardId | "skipped";
};

/** Person + event properties for first-run answers. No free-text "other". */
export function onboardingPersonProperties(payload: OnboardingAnalyticsPayload) {
  return {
    onboarding_experience: payload.experience,
    onboarding_why_here: payload.whyHere,
    onboarding_attribution: payload.attribution,
  };
}

export function captureOnboardingAnalytics(payload: OnboardingAnalyticsPayload) {
  const properties = onboardingPersonProperties(payload);
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.setPersonProperties(properties);
      posthog.capture("onboarding_profile", properties);
    })
    .catch(() => {
      /* analytics optional */
    });
}
