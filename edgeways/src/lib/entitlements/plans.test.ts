import { describe, expect, it } from "vitest";
import { FEATURE_LABELS, FEATURES, type FeatureFlag } from "./features";
import {
  can,
  canWithPreview,
  ENTITLEMENTS,
  requiredPlan,
  type PlanId,
} from "./plans";

/**
 * Literal expectation table, transcribed from the N0 brief matrix
 * (implementation-briefs.md N0 / product-roadmap.md §7.5). Written out by hand
 * so the test fails if the matrix in plans.ts drifts from the brief.
 */
const MATRIX: Record<FeatureFlag, { free: boolean; core: boolean; edge: boolean }> = {
  calculators: { free: true, core: true, edge: true },
  demo_data: { free: true, core: true, edge: true },
  offers_pipeline: { free: false, core: true, edge: true },
  do_next: { free: false, core: true, edge: true },
  acca_desk: { free: false, core: true, edge: true },
  bet_builder_desk: { free: false, core: true, edge: true },
  systems_desk: { free: false, core: true, edge: true },
  offer_edge: { free: false, core: false, edge: true },
  racing_live_feeds: { free: false, core: false, edge: true },
  push_alerts: { free: false, core: false, edge: true },
  exchange_lay: { free: false, core: false, edge: true },
};

const PLANS: PlanId[] = ["free", "core", "edge"];

describe("N0 entitlement matrix", () => {
  it("covers every feature id in the expectation table", () => {
    expect([...FEATURES].sort()).toEqual(
      (Object.keys(MATRIX) as FeatureFlag[]).sort()
    );
  });

  it("can() matches the brief matrix for every plan x feature", () => {
    for (const plan of PLANS) {
      for (const feature of FEATURES) {
        expect(can(plan, feature), `${plan} / ${feature}`).toBe(
          MATRIX[feature][plan]
        );
      }
    }
  });

  it("every feature is entitled to at least one plan and has a label", () => {
    for (const feature of FEATURES) {
      expect(FEATURE_LABELS[feature].length).toBeGreaterThan(0);
      expect(PLANS.some((plan) => can(plan, feature)), feature).toBe(true);
    }
  });

  it("higher tiers are supersets of lower tiers", () => {
    for (const feature of FEATURES) {
      if (can("free", feature)) expect(can("core", feature)).toBe(true);
      if (can("core", feature)) expect(can("edge", feature)).toBe(true);
    }
  });
});

describe("canWithPreview", () => {
  it("allows everything when settings are missing or unlocked", () => {
    for (const feature of FEATURES) {
      expect(canWithPreview(null, feature)).toBe(true);
      expect(canWithPreview(undefined, feature)).toBe(true);
      expect(canWithPreview({}, feature)).toBe(true);
      expect(canWithPreview({ planPreview: "unlocked" }, feature)).toBe(true);
    }
  });

  it("matches can() for each real plan preview", () => {
    for (const plan of PLANS) {
      for (const feature of FEATURES) {
        expect(canWithPreview({ planPreview: plan }, feature)).toBe(
          can(plan, feature)
        );
      }
    }
  });
});

describe("requiredPlan", () => {
  it("reports the lowest entitled plan", () => {
    expect(requiredPlan("calculators")).toBe("free");
    expect(requiredPlan("acca_desk")).toBe("core");
    expect(requiredPlan("offer_edge")).toBe("edge");
    expect(requiredPlan("push_alerts")).toBe("edge");
  });
});

describe("ENTITLEMENTS shape", () => {
  it("has no duplicate flags per plan", () => {
    for (const plan of PLANS) {
      const flags = ENTITLEMENTS[plan];
      expect(new Set(flags).size, plan).toBe(flags.length);
    }
  });
});
