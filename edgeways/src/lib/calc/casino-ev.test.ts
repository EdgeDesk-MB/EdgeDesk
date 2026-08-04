import { describe, expect, it } from "vitest";
import {
  casinoOfferEv,
  houseEdgeFromRtp,
  varianceTier,
  DEFAULT_RTP,
} from "./casino-ev";

describe("houseEdgeFromRtp", () => {
  it("96% RTP → 4% house edge", () => {
    expect(houseEdgeFromRtp(0.96)).toBeCloseTo(0.04, 10);
  });

  it("clamps nonsense RTP into [0, 1]", () => {
    expect(houseEdgeFromRtp(1.2)).toBe(0);
    expect(houseEdgeFromRtp(-0.5)).toBe(1);
  });
});

describe("casinoOfferEv", () => {
  it("£20 bonus, 35× wagering, 96% RTP: turnover £700, drag £28.00, EV −£8.00", () => {
    const r = casinoOfferEv({ bonusAmount: 20, wageringMultiplier: 35, houseEdge: 0.04 });
    expect(r.totalTurnover).toBe(700);
    expect(r.wageringDrag).toBe(28);
    expect(r.ev).toBe(-8);
  });

  it("£50 bonus, 10× wagering, 98% RTP: turnover £500, drag £10.00, EV +£40.00", () => {
    const r = casinoOfferEv({ bonusAmount: 50, wageringMultiplier: 10, houseEdge: 0.02 });
    expect(r.totalTurnover).toBe(500);
    expect(r.wageringDrag).toBe(10);
    expect(r.ev).toBe(40);
  });

  it("50% contribution doubles effective turnover: £20, 20×, 96% RTP → £800, drag £32.00, EV −£12.00", () => {
    const r = casinoOfferEv({
      bonusAmount: 20,
      wageringMultiplier: 20,
      houseEdge: 0.04,
      contributionPct: 0.5,
    });
    expect(r.totalTurnover).toBe(800);
    expect(r.wageringDrag).toBe(32);
    expect(r.ev).toBe(-12);
  });

  it("no wagering (0×) is a cash bonus: EV = bonus", () => {
    const r = casinoOfferEv({ bonusAmount: 25, wageringMultiplier: 0, houseEdge: 0.04 });
    expect(r.totalTurnover).toBe(0);
    expect(r.wageringDrag).toBe(0);
    expect(r.ev).toBe(25);
  });

  it("zero or negative bonus yields zeros (guard, never NaN)", () => {
    const r = casinoOfferEv({ bonusAmount: 0, wageringMultiplier: 35, houseEdge: 0.04 });
    expect(r).toEqual({ ev: 0, wageringDrag: 0, totalTurnover: 0 });
    const neg = casinoOfferEv({ bonusAmount: -5, wageringMultiplier: 35, houseEdge: 0.04 });
    expect(neg).toEqual({ ev: 0, wageringDrag: 0, totalTurnover: 0 });
  });

  it("contribution is clamped to [0.01, 1] so a 0% entry cannot divide by zero", () => {
    const r = casinoOfferEv({
      bonusAmount: 10,
      wageringMultiplier: 1,
      houseEdge: 0.04,
      contributionPct: 0,
    });
    // clamped to 0.01 → turnover 10 × 1 / 0.01 = £1000, drag £40.00
    expect(r.totalTurnover).toBe(1000);
    expect(r.wageringDrag).toBe(40);
    expect(r.ev).toBe(-30);
  });

  it("results round to the penny: £17.50, 12×, 3.7% edge → drag £7.77", () => {
    // turnover 210, drag 210 × 0.037 = 7.77, ev 17.50 − 7.77 = 9.73
    const r = casinoOfferEv({ bonusAmount: 17.5, wageringMultiplier: 12, houseEdge: 0.037 });
    expect(r.totalTurnover).toBe(210);
    expect(r.wageringDrag).toBe(7.77);
    expect(r.ev).toBe(9.73);
  });
});

describe("varianceTier", () => {
  it("effective turnover ratio ≤ 10 is low", () => {
    expect(varianceTier({ wageringMultiplier: 10, houseEdge: 0.04 })).toBe("low");
    expect(varianceTier({ wageringMultiplier: 1, houseEdge: 0.02 })).toBe("low");
  });

  it("ratio ≤ 40 is medium", () => {
    expect(varianceTier({ wageringMultiplier: 35, houseEdge: 0.04 })).toBe("medium");
    expect(varianceTier({ wageringMultiplier: 11, houseEdge: 0.04 })).toBe("medium");
  });

  it("ratio above 40 is high", () => {
    expect(varianceTier({ wageringMultiplier: 50, houseEdge: 0.04 })).toBe("high");
  });

  it("contribution inflates the effective ratio: 25× at 50% contribution = 50 → high", () => {
    expect(
      varianceTier({ wageringMultiplier: 25, houseEdge: 0.04, contributionPct: 0.5 })
    ).toBe("high");
  });

  it("a heavy house edge (≥ 6%) bumps the tier one step", () => {
    expect(varianceTier({ wageringMultiplier: 8, houseEdge: 0.08 })).toBe("medium");
    expect(varianceTier({ wageringMultiplier: 35, houseEdge: 0.06 })).toBe("high");
    // already high stays high
    expect(varianceTier({ wageringMultiplier: 50, houseEdge: 0.1 })).toBe("high");
  });
});

describe("DEFAULT_RTP", () => {
  it("is 96% (the heuristic slot default; callers mark its basis heuristic)", () => {
    expect(DEFAULT_RTP).toBe(0.96);
  });
});
