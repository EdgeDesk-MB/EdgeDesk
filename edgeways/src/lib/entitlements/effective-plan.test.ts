import { describe, expect, it } from "vitest";
import {
  canWithPlan,
  effectivePlan,
} from "@/lib/entitlements/effective-plan";

describe("effectivePlan", () => {
  it("honours the plan while billing is live", () => {
    expect(effectivePlan({ plan: "edge", billingStatus: "trialing" })).toBe("edge");
    expect(effectivePlan({ plan: "core", billingStatus: "active" })).toBe("core");
    expect(effectivePlan({ plan: "edge", billingStatus: "past_due" })).toBe("edge");
  });

  it("falls to Free when billing lapses", () => {
    expect(effectivePlan({ plan: "edge", billingStatus: "canceled" })).toBe("free");
    expect(effectivePlan({ plan: "core", billingStatus: "none" })).toBe("free");
    expect(effectivePlan({ plan: "free", billingStatus: "none" })).toBe("free");
  });
});

describe("canWithPlan", () => {
  it("gates by the paid plan when no preview is set", () => {
    const edge = { plan: "edge", billingStatus: "active" } as const;
    expect(canWithPlan({ ...edge, feature: "offer_edge" })).toBe(true);
    const core = { plan: "core", billingStatus: "active" } as const;
    expect(canWithPlan({ ...core, feature: "offer_edge" })).toBe(false);
    expect(canWithPlan({ ...core, feature: "acca_desk" })).toBe(true);
    const free = { plan: "free", billingStatus: "none" } as const;
    expect(canWithPlan({ ...free, feature: "calculators" })).toBe(true);
    expect(canWithPlan({ ...free, feature: "acca_desk" })).toBe(false);
  });

  it("treats unlocked preview as the paid plan, not a master key", () => {
    const core = { plan: "core", billingStatus: "active" } as const;
    expect(
      canWithPlan({ ...core, planPreview: "unlocked", feature: "offer_edge" })
    ).toBe(false);
  });

  it("lets preview step down but never up", () => {
    const edge = { plan: "edge", billingStatus: "active" } as const;
    expect(
      canWithPlan({ ...edge, planPreview: "core", feature: "offer_edge" })
    ).toBe(false);
    expect(
      canWithPlan({ ...edge, planPreview: "core", feature: "acca_desk" })
    ).toBe(true);
    const free = { plan: "free", billingStatus: "none" } as const;
    expect(
      canWithPlan({ ...free, planPreview: "edge", feature: "offer_edge" })
    ).toBe(false);
  });

  it("ignores preview once billing has lapsed", () => {
    const canceled = { plan: "edge", billingStatus: "canceled" } as const;
    expect(canWithPlan({ ...canceled, feature: "offer_edge" })).toBe(false);
    expect(canWithPlan({ ...canceled, feature: "calculators" })).toBe(true);
  });
});
