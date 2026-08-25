import { describe, expect, it } from "vitest";
import { onboardingPersonProperties } from "@/lib/analytics/onboarding-profile";

describe("onboarding person properties", () => {
  it("maps answers without free-text fields", () => {
    expect(
      onboardingPersonProperties({
        experience: "finder",
        whyHere: ["calculators", "do_next"],
        attribution: "reddit",
      })
    ).toEqual({
      onboarding_experience: "finder",
      onboarding_why_here: ["calculators", "do_next"],
      onboarding_attribution: "reddit",
    });
  });
});
