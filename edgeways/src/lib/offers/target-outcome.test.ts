import { describe, expect, it } from "vitest";
import {
  describeTargetOutcome,
  maxTargetPosition,
  offerTargetOutcome,
  targetIncludesWin,
} from "./target-outcome";
import type { BetGetFreePlaceRules } from "./racing-offer-rules";

const rules: BetGetFreePlaceRules = {
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3, 4],
  betStake: 50,
  freeBetAmount: 50,
};

describe("offerTargetOutcome", () => {
  it("takes the qualifying places straight from the offer rules", () => {
    expect(offerTargetOutcome(rules)).toEqual({
      kind: "finish_positions",
      positions: [2, 3, 4],
    });
  });

  it("sorts, de-duplicates and drops nonsense positions", () => {
    const messy = { ...rules, qualifyingPlaces: [4, 2, 2, 0, 3, -1] };
    expect(offerTargetOutcome(messy).positions).toEqual([2, 3, 4]);
  });
});

describe("describeTargetOutcome", () => {
  it("reads as plain English", () => {
    expect(describeTargetOutcome(offerTargetOutcome(rules))).toBe("finishes 2nd, 3rd or 4th");
  });

  it("handles a single position", () => {
    const single = offerTargetOutcome({ ...rules, qualifyingPlaces: [2] });
    expect(describeTargetOutcome(single)).toBe("finishes 2nd");
  });

  it("describes 2nd to the SP favourite", () => {
    const target = offerTargetOutcome({
      ...rules,
      qualifyingPlaces: [2],
      winnerMustBeSpFavourite: true,
    });
    expect(target.winnerMustBeSpFavourite).toBe(true);
    expect(describeTargetOutcome(target)).toBe("finishes 2nd to the SP favourite");
  });

  it("handles teen ordinals", () => {
    const teens = offerTargetOutcome({ ...rules, qualifyingPlaces: [11, 12, 13] });
    expect(describeTargetOutcome(teens)).toBe("finishes 11th, 12th or 13th");
  });

  it("describes an empty target rather than throwing", () => {
    expect(describeTargetOutcome({ kind: "finish_positions", positions: [] })).toBe(
      "no qualifying result"
    );
  });
});

describe("targetIncludesWin", () => {
  it("is false for a place-refund consolation", () => {
    expect(targetIncludesWin(offerTargetOutcome(rules))).toBe(false);
  });

  it("is true when the offer pays on the win too", () => {
    expect(targetIncludesWin(offerTargetOutcome({ ...rules, qualifyingPlaces: [1, 2] }))).toBe(
      true
    );
  });
});

describe("maxTargetPosition", () => {
  it("returns the deepest position the offer cares about", () => {
    expect(maxTargetPosition(offerTargetOutcome(rules))).toBe(4);
    expect(maxTargetPosition({ kind: "finish_positions", positions: [] })).toBe(0);
  });
});
