import { describe, expect, it } from "vitest";
import {
  canDesk,
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

describe("canDesk", () => {
  it("falls back to preview behaviour without a billing row (demo)", () => {
    expect(canDesk(null, "offer_edge")).toBe(true);
    expect(canDesk({ planPreview: "unlocked" }, "offer_edge")).toBe(true);
    expect(canDesk({ planPreview: "free" }, "acca_desk")).toBe(false);
    expect(canDesk({ billing: null, planPreview: "unlocked" }, "offer_edge")).toBe(
      true
    );
  });

  it("gates by the real plan once billing is present", () => {
    const free = {
      billing: { plan: "free", billingStatus: "none" },
      planPreview: "unlocked",
    } as const;
    expect(canDesk(free, "calculators")).toBe(true);
    expect(canDesk(free, "offers_pipeline")).toBe(false);
    expect(canDesk(free, "acca_desk")).toBe(false);
    expect(canDesk(free, "offer_edge")).toBe(false);

    const core = {
      billing: { plan: "core", billingStatus: "active" },
      planPreview: "unlocked",
    } as const;
    expect(canDesk(core, "acca_desk")).toBe(true);
    expect(canDesk(core, "offer_edge")).toBe(false);

    const edge = {
      billing: { plan: "edge", billingStatus: "trialing" },
      planPreview: "unlocked",
    } as const;
    expect(canDesk(edge, "offer_edge")).toBe(true);
  });

  it("lets a paying user preview down but never up", () => {
    const edgeDown = {
      billing: { plan: "edge", billingStatus: "active" },
      planPreview: "core",
    } as const;
    expect(canDesk(edgeDown, "offer_edge")).toBe(false);
    expect(canDesk(edgeDown, "acca_desk")).toBe(true);

    const freeUp = {
      billing: { plan: "free", billingStatus: "none" },
      planPreview: "edge",
    } as const;
    expect(canDesk(freeUp, "offer_edge")).toBe(false);
  });
});
