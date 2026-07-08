import { describe, expect, it } from "vitest";
import {
  estimatePlaceRefundTriggerProb,
  placeRefundRunnerEv,
  resolveOfferConfidence,
} from "./place-refund-ev";

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
  it("marks proxy odds as estimate", () => {
    expect(resolveOfferConfidence("proxy", "estimated")).toBe("estimate");
  });

  it("marks live both as live", () => {
    expect(resolveOfferConfidence("live", "live")).toBe("live");
  });
});

describe("estimatePlaceRefundTriggerProb", () => {
  it("ranks 2nd favourite higher than rank 5", () => {
    const r2 = estimatePlaceRefundTriggerProb(2, 10, 5);
    const r5 = estimatePlaceRefundTriggerProb(5, 10, 15);
    expect(r2).toBeGreaterThan(r5);
  });
});
