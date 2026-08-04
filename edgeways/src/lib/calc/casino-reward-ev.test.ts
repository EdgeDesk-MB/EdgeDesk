import { describe, expect, it } from "vitest";
import {
  AMERICAN_ROULETTE_EDGE,
  EUROPEAN_ROULETTE_EDGE,
  cashbackEv,
  deriveComponentEv,
  freeSpinsEv,
  goldenChipsEv,
  qualifyingWagerDrag,
  sumCampaignEv,
} from "./casino-reward-ev";

describe("freeSpinsEv", () => {
  it("20 spins, £0.40 spin value, 95% RTP, no winnings wagering: spinWinnings £7.60, EV £7.60", () => {
    const r = freeSpinsEv({ spins: 20, spinValue: 0.4, houseEdge: 0.05 });
    expect(r.spinWinnings).toBe(7.6);
    expect(r.totalTurnover).toBe(0);
    expect(r.wageringDrag).toBe(0);
    expect(r.ev).toBe(7.6);
  });

  it("50 spins, £0.10, 95% RTP, winnings wagered 20×, 100% contribution: breaks even at £0.00", () => {
    // spinWinnings = 50 × 0.10 × 0.95 = £4.75
    // stage-2 turnover = 4.75 × 20 / 1 = £95.00, drag = 95 × 0.05 = £4.75
    const r = freeSpinsEv({ spins: 50, spinValue: 0.1, houseEdge: 0.05, winningsWagerX: 20 });
    expect(r.spinWinnings).toBe(4.75);
    expect(r.totalTurnover).toBe(95);
    expect(r.wageringDrag).toBe(4.75);
    expect(r.ev).toBe(0);
  });

  it("10 spins, £1.00, 96% RTP, winnings wagered 10×, 50% contribution: EV £1.92", () => {
    // spinWinnings = 10 × 1 × 0.96 = £9.60
    // stage-2 turnover = 9.60 × 10 / 0.5 = £192.00, drag = 192 × 0.04 = £7.68
    const r = freeSpinsEv({
      spins: 10,
      spinValue: 1,
      houseEdge: 0.04,
      winningsWagerX: 10,
      contributionPct: 0.5,
    });
    expect(r.spinWinnings).toBe(9.6);
    expect(r.totalTurnover).toBe(192);
    expect(r.wageringDrag).toBe(7.68);
    expect(r.ev).toBe(1.92);
  });

  it("winningsWagerX of 0/undefined skips stage 2 entirely", () => {
    const withZero = freeSpinsEv({ spins: 5, spinValue: 2, houseEdge: 0.04, winningsWagerX: 0 });
    const withUndefined = freeSpinsEv({ spins: 5, spinValue: 2, houseEdge: 0.04 });
    expect(withZero).toEqual(withUndefined);
    expect(withZero.totalTurnover).toBe(0);
    expect(withZero.wageringDrag).toBe(0);
  });

  it("zero or negative spins/spinValue yields zeros (guard, never NaN)", () => {
    expect(freeSpinsEv({ spins: 0, spinValue: 1, houseEdge: 0.04 })).toEqual({
      spinWinnings: 0,
      totalTurnover: 0,
      wageringDrag: 0,
      ev: 0,
    });
    expect(freeSpinsEv({ spins: 10, spinValue: -1, houseEdge: 0.04 })).toEqual({
      spinWinnings: 0,
      totalTurnover: 0,
      wageringDrag: 0,
      ev: 0,
    });
  });
});

describe("goldenChipsEv", () => {
  it("10 chips at £5, European edge (2.70%): turnover £50, drag £1.35, EV £48.65", () => {
    const r = goldenChipsEv({ chipCount: 10, chipValue: 5, houseEdge: EUROPEAN_ROULETTE_EDGE });
    expect(r.totalTurnover).toBe(50);
    expect(r.wageringDrag).toBe(1.35);
    expect(r.ev).toBe(48.65);
  });

  it("5 chips at £10, American edge (5.26%): turnover £50, drag £2.63, EV £47.37", () => {
    const r = goldenChipsEv({ chipCount: 5, chipValue: 10, houseEdge: AMERICAN_ROULETTE_EDGE });
    expect(r.totalTurnover).toBe(50);
    expect(r.wageringDrag).toBe(2.63);
    expect(r.ev).toBe(47.37);
  });

  it("edge presets are the published roulette house edges", () => {
    expect(EUROPEAN_ROULETTE_EDGE).toBeCloseTo(0.027, 10);
    expect(AMERICAN_ROULETTE_EDGE).toBeCloseTo(0.0526, 10);
  });

  it("zero or negative chip count/value yields zeros (guard, never NaN)", () => {
    expect(goldenChipsEv({ chipCount: 0, chipValue: 5, houseEdge: 0.027 })).toEqual({
      totalTurnover: 0,
      wageringDrag: 0,
      ev: 0,
    });
    expect(goldenChipsEv({ chipCount: 5, chipValue: -1, houseEdge: 0.027 })).toEqual({
      totalTurnover: 0,
      wageringDrag: 0,
      ev: 0,
    });
  });
});

describe("qualifyingWagerDrag", () => {
  it("£100 at 96% RTP (4% edge): drag £4.00, EV −£4.00", () => {
    const r = qualifyingWagerDrag({ amount: 100, houseEdge: 0.04 });
    expect(r.totalTurnover).toBe(100);
    expect(r.wageringDrag).toBe(4);
    expect(r.ev).toBe(-4);
  });

  it("EV is always ≤ 0 by construction, even at a 0% edge (never −0)", () => {
    const r = qualifyingWagerDrag({ amount: 250, houseEdge: 0 });
    expect(r.wageringDrag).toBe(0);
    expect(r.ev).toBe(0);
    expect(Object.is(r.ev, -0)).toBe(false);
  });

  it("zero or negative amount yields zeros (guard, never NaN)", () => {
    expect(qualifyingWagerDrag({ amount: 0, houseEdge: 0.04 })).toEqual({
      totalTurnover: 0,
      wageringDrag: 0,
      ev: 0,
    });
    expect(qualifyingWagerDrag({ amount: -50, houseEdge: 0.04 })).toEqual({
      totalTurnover: 0,
      wageringDrag: 0,
      ev: 0,
    });
  });
});

describe("cashbackEv", () => {
  it("£500 turnover, 4% edge, 10% cashback, no cap: expectedLoss £20, cashback £2, EV £2", () => {
    const r = cashbackEv({ expectedTurnover: 500, houseEdge: 0.04, cashbackPct: 0.1 });
    expect(r.expectedLoss).toBe(20);
    expect(r.cashbackAmount).toBe(2);
    expect(r.ev).toBe(2);
  });

  it("£2000 turnover, 4% edge, 10% cashback, £5 cap: cashback caps at £5, EV £5", () => {
    // expectedLoss = 80, uncapped cashback would be £8, capped to £5
    const r = cashbackEv({
      expectedTurnover: 2000,
      houseEdge: 0.04,
      cashbackPct: 0.1,
      cashbackCap: 5,
    });
    expect(r.expectedLoss).toBe(80);
    expect(r.cashbackAmount).toBe(5);
    expect(r.ev).toBe(5);
  });

  it("zero or negative turnover yields zeros (guard, never NaN)", () => {
    expect(cashbackEv({ expectedTurnover: 0, houseEdge: 0.04, cashbackPct: 0.1 })).toEqual({
      expectedLoss: 0,
      cashbackAmount: 0,
      ev: 0,
    });
    expect(cashbackEv({ expectedTurnover: -100, houseEdge: 0.04, cashbackPct: 0.1 })).toEqual({
      expectedLoss: 0,
      cashbackAmount: 0,
      ev: 0,
    });
  });
});

describe("sumCampaignEv", () => {
  it("Grosvenor-shape campaign: qualifying wager £100 @ 96% RTP + 20 free spins @ £0.40 @ 95% RTP → £3.60", () => {
    const qualifying = qualifyingWagerDrag({ amount: 100, houseEdge: 0.04 });
    const spins = freeSpinsEv({ spins: 20, spinValue: 0.4, houseEdge: 0.05 });
    expect(sumCampaignEv([{ expectedEv: qualifying.ev }, { expectedEv: spins.ev }])).toBe(3.6);
  });

  it("sums to the penny across mixed positive/negative components", () => {
    expect(
      sumCampaignEv([{ expectedEv: 10.55 }, { expectedEv: -4.2 }, { expectedEv: 0.15 }])
    ).toBe(6.5);
  });

  it("empty component list sums to zero", () => {
    expect(sumCampaignEv([])).toBe(0);
  });
});

describe("deriveComponentEv", () => {
  it("cash: ignores wageringMultiplier, EV = amount", () => {
    expect(
      deriveComponentEv({ componentType: "cash", amount: 15, wageringMultiplier: 35 })
    ).toBe(15);
  });

  it("bonus: matches casinoOfferEv's £20/35x/96% RTP vector, EV −£8.00", () => {
    expect(
      deriveComponentEv({
        componentType: "bonus",
        amount: 20,
        wageringMultiplier: 35,
        rtp: 0.96,
      })
    ).toBe(-8);
  });

  it("free_spins: matches freeSpinsEv's 20@£0.40@95% vector, EV £7.60", () => {
    expect(
      deriveComponentEv({ componentType: "free_spins", spins: 20, spinValue: 0.4, rtp: 0.95 })
    ).toBe(7.6);
  });

  it("free_spins: wageringMultiplier feeds winningsWagerX, matches the break-even vector", () => {
    expect(
      deriveComponentEv({
        componentType: "free_spins",
        spins: 50,
        spinValue: 0.1,
        rtp: 0.95,
        wageringMultiplier: 20,
      })
    ).toBe(0);
  });

  it("golden_chips: matches goldenChipsEv's 10@£5@European vector, EV £48.65", () => {
    expect(
      deriveComponentEv({
        componentType: "golden_chips",
        chipCount: 10,
        chipValue: 5,
        rtp: 1 - EUROPEAN_ROULETTE_EDGE,
      })
    ).toBe(48.65);
  });

  it("qualifying_wager: matches qualifyingWagerDrag's £100@96% vector, EV −£4.00", () => {
    expect(
      deriveComponentEv({ componentType: "qualifying_wager", amount: 100, rtp: 0.96 })
    ).toBe(-4);
  });

  it("cashback: matches cashbackEv's £500/4%/10% vector, EV £2.00", () => {
    expect(
      deriveComponentEv({
        componentType: "cashback",
        amount: 500,
        rtp: 0.96,
        cashbackPct: 0.1,
      })
    ).toBe(2);
  });

  it("null rtp falls back to the 96% heuristic default", () => {
    expect(deriveComponentEv({ componentType: "cash", amount: 10, rtp: null })).toBe(10);
    // Bonus at the 96% default matches the hand-worked default-RTP vector directly.
    expect(
      deriveComponentEv({ componentType: "bonus", amount: 20, wageringMultiplier: 35, rtp: null })
    ).toBe(-8);
  });
});
