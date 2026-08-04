import { describe, expect, it } from "vitest";
import { boostVerdict, betBuilderFairOdds } from "./boost-check";

describe("boostVerdict", () => {
  // Exchange 2.6/2.7 → trueProb = (1/2.6 + 1/2.7)/2 = 0.3774927…
  // Boosted 3.0 → edge = (3.0 × 0.3774927 − 1) × 100 = 13.2478%
  // £10 stake → EV = (0.3774927 × 2 − 0.6225073) × 10 = £1.3248
  it("boosted 3.0 vs exchange 2.6/2.7 at £10: +13.25% edge, +£1.32 EV → take", () => {
    const r = boostVerdict({ boostedOdds: 3.0, exchangeBack: 2.6, exchangeLay: 2.7, stake: 10 });
    if (!r) throw new Error("expected a verdict for valid inputs");
    expect(r.edgePct).toBeCloseTo(13.2478, 3);
    expect(r.evGbp).toBeCloseTo(1.32, 2);
    expect(r.fairOdds).toBeCloseTo(1 / 0.3774927, 3);
    expect(r.verdict).toBe("take");
  });

  it("boost below fair is a skip: 2.4 vs exchange 2.6/2.7 → negative edge", () => {
    const r = boostVerdict({ boostedOdds: 2.4, exchangeBack: 2.6, exchangeLay: 2.7, stake: 10 });
    if (!r) throw new Error("expected a verdict for valid inputs");
    // edge = (2.4 × 0.3774927 − 1) × 100 = −9.40%
    expect(r.edgePct).toBeCloseTo(-9.4018, 3);
    expect(r.evGbp).toBeLessThan(0);
    expect(r.verdict).toBe("skip");
  });

  it("within ±1% edge is marginal", () => {
    // trueProb 0.4 (2.5/2.5) → odds 2.51 → edge (2.51×0.4−1)×100 = 0.4%
    const r = boostVerdict({ boostedOdds: 2.51, exchangeBack: 2.5, exchangeLay: 2.5, stake: 10 });
    if (!r) throw new Error("expected a verdict for valid inputs");
    expect(r.edgePct).toBeCloseTo(0.4, 5);
    expect(r.verdict).toBe("marginal");
  });

  it("guards nonsense inputs with a null verdict payload", () => {
    expect(boostVerdict({ boostedOdds: 0, exchangeBack: 2.6, exchangeLay: 2.7, stake: 10 })).toBeNull();
    expect(boostVerdict({ boostedOdds: 3, exchangeBack: 1, exchangeLay: 0.5, stake: 10 })).toBeNull();
  });
});

describe("betBuilderFairOdds", () => {
  it("independent legs multiply: 2.0 × 1.8 = 3.6", () => {
    expect(betBuilderFairOdds([{ fairOdds: 2.0 }, { fairOdds: 1.8 }], 0)).toBeCloseTo(3.6, 10);
  });

  it("a 10% correlation haircut shortens the fair price: 3.6 → 3.24", () => {
    expect(betBuilderFairOdds([{ fairOdds: 2.0 }, { fairOdds: 1.8 }], 10)).toBeCloseTo(3.24, 10);
  });

  it("haircut never takes fair odds below 1.01", () => {
    expect(betBuilderFairOdds([{ fairOdds: 1.05 }], 90)).toBeCloseTo(1.01, 10);
  });

  it("no legs → null", () => {
    expect(betBuilderFairOdds([], 0)).toBeNull();
  });

  it("a leg at or below evens invalidates the builder", () => {
    expect(betBuilderFairOdds([{ fairOdds: 2.0 }, { fairOdds: 1.0 }], 0)).toBeNull();
    expect(betBuilderFairOdds([{ fairOdds: 2.0 }, { fairOdds: NaN }], 0)).toBeNull();
  });

  it("haircut clamps to the 0–95 band", () => {
    // 200% clamps to 95: 10 × 0.05 = 0.5 → floored to 1.01
    expect(betBuilderFairOdds([{ fairOdds: 10 }], 200)).toBeCloseTo(1.01, 10);
    // Negative clamps to 0: the naive product stands
    expect(betBuilderFairOdds([{ fairOdds: 2.0 }, { fairOdds: 1.8 }], -10)).toBeCloseTo(3.6, 10);
  });
});
