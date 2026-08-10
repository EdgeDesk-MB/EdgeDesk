import { describe, expect, it } from "vitest";
import {
  estimatePlaceRefundTriggerProb,
  formatConfidenceLabel,
  formatPriceTrustLabel,
  placeRefundRunnerEv,
  resolveOfferConfidence,
  triggerProbFromModel,
  triggerProbWithFavouriteConstraint,
} from "./place-refund-ev";
import { offerTargetOutcome } from "./target-outcome";

describe("placeRefundRunnerEv", () => {
  it("returns positive total EV when free bet value outweighs qual loss", () => {
    const r = placeRefundRunnerEv({
      betStake: 50,
      freeBetAmount: 50,
      backOdds: 6,
      layOdds: 6.2,
      marketRank: 2,
      fieldSize: 12,
    });
    expect(r.qualLoss).toBeLessThan(0);
    expect(r.freeBetEv).toBeGreaterThan(0);
    expect(r.totalEv).toBeGreaterThan(r.qualLoss);
  });
});

describe("resolveOfferConfidence", () => {
  it("marks proxy odds with no live lay as estimate", () => {
    expect(resolveOfferConfidence("proxy", "estimated")).toBe("estimate");
  });

  it("marks live lay with proxy back as mixed (one side live)", () => {
    expect(resolveOfferConfidence("proxy", "live")).toBe("mixed");
  });

  it("marks live both as live", () => {
    expect(resolveOfferConfidence("live", "live")).toBe("live");
  });

  it("marks live back only as mixed", () => {
    expect(resolveOfferConfidence("live", "estimated")).toBe("mixed");
  });
});

describe("formatPriceTrustLabel", () => {
  it("names both sides when both are live", () => {
    expect(formatPriceTrustLabel("live", "live")).toBe("Live back & lay");
  });

  it("says only when just the lay is live", () => {
    expect(formatPriceTrustLabel("proxy", "live")).toBe("Live lay only");
    expect(formatPriceTrustLabel("snapshot", "live")).toBe("Live lay only");
  });

  it("says only when just the back is live", () => {
    expect(formatPriceTrustLabel("live", "estimated")).toBe("Live back only");
  });

  it("labels manual overrides as your prices", () => {
    expect(formatPriceTrustLabel("manual", "live")).toBe("Your prices");
  });

  it("says estimated when neither side is live", () => {
    expect(formatPriceTrustLabel("proxy", "estimated")).toBe("Estimated");
  });

  it("falls back to the tier label when sources are missing", () => {
    expect(formatPriceTrustLabel(undefined, undefined, "mixed")).toBe("One side live");
    expect(formatConfidenceLabel("estimate")).toBe("Estimated");
  });
});

describe("estimatePlaceRefundTriggerProb", () => {
  it("ranks 2nd favourite higher than rank 5", () => {
    const r2 = estimatePlaceRefundTriggerProb(2, 10, 5);
    const r5 = estimatePlaceRefundTriggerProb(5, 10, 15);
    expect(r2).toBeGreaterThan(r5);
  });
});

describe("triggerProbFromModel", () => {
  const rules = {
    type: "bet_get_free_place" as const,
    minRunners: 8,
    regions: ["GB" as const],
    qualifyingPlaces: [2, 3, 4],
    betStake: 50,
    freeBetAmount: 50,
  };

  it("sums exactly the positions the offer pays on, ignoring the win", () => {
    const target = offerTargetOutcome(rules);
    // P(1st) 0.2, P(2nd) 0.18, P(3rd) 0.15, P(4th) 0.12
    expect(triggerProbFromModel([0.2, 0.18, 0.15, 0.12], target)).toBeCloseTo(0.45, 12);
  });

  it("counts the win when the offer pays on it", () => {
    const target = offerTargetOutcome({ ...rules, qualifyingPlaces: [1, 2, 3] });
    expect(triggerProbFromModel([0.2, 0.18, 0.15, 0.12], target)).toBeCloseTo(0.53, 12);
  });
});

describe("triggerProbWithFavouriteConstraint", () => {
  const placeRules = {
    type: "bet_get_free_place" as const,
    minRunners: 6,
    regions: ["GB" as const],
    qualifyingPlaces: [2],
    betStake: 10,
    freeBetAmount: 10,
    winnerMustBeSpFavourite: true as const,
  };

  // Worked example (Harville): fav p=0.40, selection p=0.20, rest share 0.40.
  // P(fav wins and selection 2nd) = 0.40 * 0.20/(1-0.40) = 0.40 * 1/3 ≈ 0.1333.
  const field = [
    { horseId: "fav", winProb: 0.4 },
    { horseId: "sel", winProb: 0.2 },
    { horseId: "a", winProb: 0.15 },
    { horseId: "b", winProb: 0.1 },
    { horseId: "c", winProb: 0.08 },
    { horseId: "d", winProb: 0.07 },
  ];

  it("gives the favourite zero trigger prob on 2nd-to-SP-favourite", () => {
    const target = offerTargetOutcome(placeRules);
    expect(
      triggerProbWithFavouriteConstraint({
        selectionHorseId: "fav",
        selectionPositionProbs: [0.4, 0.2, 0.15, 0.1],
        field,
        target,
      })
    ).toBe(0);
  });

  it("uses Harville P(fav wins and selection 2nd) for a non-favourite", () => {
    const target = offerTargetOutcome(placeRules);
    const expected = 0.4 * (0.2 / (1 - 0.4));
    expect(
      triggerProbWithFavouriteConstraint({
        selectionHorseId: "sel",
        selectionPositionProbs: [0.2, 0.22, 0.18, 0.12],
        field,
        target,
      })
    ).toBeCloseTo(expected, 10);
  });

  it("falls back to plain place sum when the offer has no SP-favourite clause", () => {
    const { winnerMustBeSpFavourite: _drop, ...plain } = placeRules;
    const target = offerTargetOutcome(plain);
    // Place-only [2]: sum is just P(2nd) = 0.2, and the favourite is allowed.
    expect(
      triggerProbWithFavouriteConstraint({
        selectionHorseId: "fav",
        selectionPositionProbs: [0.4, 0.2, 0.15, 0.1],
        field,
        target,
      })
    ).toBeCloseTo(0.2, 12);
  });
});

describe("placeRefundRunnerEv trigger basis", () => {
  const base = {
    betStake: 50,
    freeBetAmount: 50,
    backOdds: 6,
    layOdds: 6.2,
    marketRank: 2,
    fieldSize: 12,
  };

  it("uses the rank heuristic and says so when no model probability is given", () => {
    const r = placeRefundRunnerEv(base);
    expect(r.triggerBasis).toBe("heuristic");
    expect(r.triggerProb).toBeCloseTo(estimatePlaceRefundTriggerProb(2, 12, 6), 12);
  });

  it("prefers a supplied model probability and marks the basis", () => {
    const r = placeRefundRunnerEv({ ...base, triggerProb: 0.41 });
    expect(r.triggerBasis).toBe("model");
    expect(r.triggerProb).toBeCloseTo(0.41, 12);
    // 0.41 * £50 * 0.8 default retention
    expect(r.freeBetEv).toBeCloseTo(16.4, 10);
  });

  it("clamps an out-of-range model probability", () => {
    expect(placeRefundRunnerEv({ ...base, triggerProb: 1.4 }).triggerProb).toBe(1);
    expect(placeRefundRunnerEv({ ...base, triggerProb: -0.2 }).triggerProb).toBe(0);
  });

  it("applies measured retention instead of the 0.8 prior when supplied", () => {
    const r = placeRefundRunnerEv({ ...base, triggerProb: 0.4, retention: 0.7 });
    expect(r.freeBetEv).toBeCloseTo(0.4 * 50 * 0.7, 10);
  });
});
