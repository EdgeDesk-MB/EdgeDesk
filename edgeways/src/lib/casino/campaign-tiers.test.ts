import { describe, expect, it } from "vitest";
import {
  groupCampaignTiers,
  shouldShowCampaignTiers,
  tierExpectedEv,
} from "./campaign-tiers";

describe("groupCampaignTiers", () => {
  it("pairs each qualifying wager with following rewards (stake ladder)", () => {
    const steps = [
      { componentType: "qualifying_wager", expectedEv: -0.35 },
      { componentType: "free_spins", expectedEv: 0.46 },
      { componentType: "qualifying_wager", expectedEv: -0.55 },
      { componentType: "free_spins", expectedEv: 0.95 },
      { componentType: "qualifying_wager", expectedEv: -1.1 },
      { componentType: "free_spins", expectedEv: 1.89 },
      { componentType: "qualifying_wager", expectedEv: -2 },
      { componentType: "free_spins", expectedEv: 4.8 },
    ];
    const tiers = groupCampaignTiers(steps);
    expect(tiers).toHaveLength(4);
    expect(tiers.map((t) => t.components.map((c) => c.componentType))).toEqual([
      ["qualifying_wager", "free_spins"],
      ["qualifying_wager", "free_spins"],
      ["qualifying_wager", "free_spins"],
      ["qualifying_wager", "free_spins"],
    ]);
    expect(shouldShowCampaignTiers(tiers)).toBe(true);
    expect(tierExpectedEv(tiers[0]!.components)).toBeCloseTo(0.11, 5);
  });

  it("keeps a single qualify+reward campaign as one tier (no chrome)", () => {
    const tiers = groupCampaignTiers([
      { componentType: "qualifying_wager", expectedEv: -4 },
      { componentType: "bonus", expectedEv: 7.6 },
    ]);
    expect(tiers).toHaveLength(1);
    expect(shouldShowCampaignTiers(tiers)).toBe(false);
  });

  it("allows multiple qualifying wagers before a reward", () => {
    const tiers = groupCampaignTiers([
      { componentType: "qualifying_wager", expectedEv: -1 },
      { componentType: "qualifying_wager", expectedEv: -2 },
      { componentType: "free_spins", expectedEv: 5 },
    ]);
    expect(tiers).toHaveLength(2);
    expect(tiers[0]!.components).toHaveLength(1);
    expect(tiers[1]!.components.map((c) => c.componentType)).toEqual([
      "qualifying_wager",
      "free_spins",
    ]);
  });

  it("buckets leading rewards without a qualifying wager", () => {
    const tiers = groupCampaignTiers([
      { componentType: "free_spins", expectedEv: 1 },
      { componentType: "bonus", expectedEv: 2 },
    ]);
    expect(tiers).toHaveLength(1);
    expect(shouldShowCampaignTiers(tiers)).toBe(false);
  });
});
