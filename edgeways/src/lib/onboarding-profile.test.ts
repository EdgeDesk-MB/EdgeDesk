import { describe, expect, it } from "vitest";
import {
  monthlyTargetPace,
  parseOnboardingProfile,
  serializeOnboardingProfile,
  planTierLabel,
  planMeetsTarget,
  subscriptionSuccessTitle,
  upgradeNudgeBody,
  upgradeNudgeTitle,
  upgradePlanForFeatures,
  upgradeSuccessBody,
  upgradeSuccessTitle,
} from "@/lib/onboarding-profile";

describe("onboarding profile", () => {
  it("round-trips a complete answer set", () => {
    const profile = parseOnboardingProfile({
      experience: "finder",
      whyHere: "calculators",
      whyHereOther: null,
      attribution: "reddit",
      attributionOther: null,
      savedAt: 1_700_000_000_000,
    });
    expect(profile?.experience).toBe("finder");
    expect(profile?.whyHere).toEqual(["calculators"]);
    expect(parseOnboardingProfile(serializeOnboardingProfile(profile!))).toEqual(
      profile
    );
  });

  it("accepts several feature interests", () => {
    const profile = parseOnboardingProfile({
      experience: "finder",
      whyHere: ["calculators", "do_next", "offer_edge"],
      whyHereOther: null,
      attribution: "google",
      attributionOther: null,
      savedAt: 1,
    });
    expect(profile?.whyHere).toEqual(["calculators", "do_next", "offer_edge"]);
  });

  it("accepts a skipped attribution", () => {
    const profile = parseOnboardingProfile({
      experience: "beginner",
      whyHere: "profit_tracking",
      whyHereOther: null,
      attribution: "skipped",
      attributionOther: null,
      savedAt: 1,
    });
    expect(profile?.attribution).toBe("skipped");
    expect(profile?.whyHere).toEqual(["profit_tracking"]);
  });

  it("rejects unknown experience ids", () => {
    expect(
      parseOnboardingProfile({
        experience: "elite",
        whyHere: "calculators",
        attribution: "google",
        savedAt: 1,
      })
    ).toBeNull();
  });

  it("drops retired why-here ids", () => {
    expect(
      parseOnboardingProfile({
        experience: "finder",
        whyHere: ["spreadsheets", "calculators"],
        attribution: "google",
        savedAt: 1,
      })?.whyHere
    ).toEqual(["calculators"]);
  });
});

describe("upgrade plan for selected features", () => {
  it("stays quiet when the current plan already covers the picks", () => {
    expect(upgradePlanForFeatures(["calculators"], "free")).toBeNull();
    expect(upgradePlanForFeatures(["do_next", "acca"], "core")).toBeNull();
    expect(upgradePlanForFeatures(["offer_edge", "racing_live"], "edge")).toBeNull();
  });

  it("asks for Core when Free picks a Core feature", () => {
    expect(upgradePlanForFeatures(["profit_tracking"], "free")).toBeNull();
    expect(upgradePlanForFeatures(["calculators", "offers"], "free")).toBe("core");
    expect(upgradePlanForFeatures(["bet_builder", "systems"], "free")).toBe("core");
  });

  it("asks for Edge when any selected feature sits on Edge", () => {
    expect(upgradePlanForFeatures(["offer_edge"], "free")).toBe("edge");
    expect(upgradePlanForFeatures(["live_results"], "core")).toBe("edge");
    expect(upgradePlanForFeatures(["do_next", "push_alerts"], "core")).toBe("edge");
  });

  it("writes a factual nudge for the required tier", () => {
    expect(upgradeNudgeTitle("edge")).toBe("Available on Edge subscription");
    expect(upgradeNudgeTitle("core")).toBe("Available on Core subscription");
    expect(planTierLabel("free")).toBe("Free tier");
    expect(upgradeNudgeBody()).toBe(
      "You can continue without upgrading. Upgrade and the features you selected will be available when you land on the desk."
    );
  });

  it("confirms the landed tier after checkout", () => {
    expect(planMeetsTarget("edge", "edge")).toBe(true);
    expect(planMeetsTarget("edge", "core")).toBe(true);
    expect(planMeetsTarget("core", "edge")).toBe(false);
    expect(upgradeSuccessTitle("edge")).toBe("Successfully upgraded to Edge tier");
    expect(upgradeSuccessTitle("core")).toBe("Successfully upgraded to Core tier");
    expect(subscriptionSuccessTitle("edge")).toBe(
      "Available with your Edge subscription"
    );
    expect(subscriptionSuccessTitle("core")).toBe(
      "Available with your Core subscription"
    );
    expect(upgradeSuccessBody()).toBe(
      "The features you selected will be available when you land on the desk."
    );
  });
});

describe("monthly target pace", () => {
  it("shows about a day and a year from the monthly figure", () => {
    expect(monthlyTargetPace(300)).toEqual({ daily: 10, yearly: 3600 });
    expect(monthlyTargetPace(0)).toEqual({ daily: 0, yearly: 0 });
  });
});
