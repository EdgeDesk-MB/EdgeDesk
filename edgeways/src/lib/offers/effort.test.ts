import { describe, expect, it } from "vitest";
import {
  medianEffortByKind,
  blendedEffortMinutes,
  effectiveEffortMinutes,
} from "./effort";
import { EFFORT_MINUTES } from "./do-next";

function sample(actionKind: string, durationMin: number, createdAt = 0) {
  return { actionKind, durationMin, createdAt };
}

describe("medianEffortByKind", () => {
  it("takes the per-kind median: [2, 4, 9] → 4", () => {
    const out = medianEffortByKind([
      sample("place_qualifying", 2),
      sample("place_qualifying", 4),
      sample("place_qualifying", 9),
    ]);
    expect(out.place_qualifying).toEqual({ minutes: 4, sampleSize: 3 });
  });

  it("even count averages the middle pair: [2, 4, 6, 10] → 5", () => {
    const out = medianEffortByKind([2, 4, 6, 10].map((m) => sample("convert_free_bet", m)));
    expect(out.convert_free_bet).toEqual({ minutes: 5, sampleSize: 4 });
  });

  it("uses only the most recent 20 samples per kind", () => {
    const old = Array.from({ length: 20 }, (_, i) => sample("place_qualifying", 100, i));
    const recent = Array.from({ length: 20 }, (_, i) => sample("place_qualifying", 5, 100 + i));
    const out = medianEffortByKind([...old, ...recent]);
    expect(out.place_qualifying).toEqual({ minutes: 5, sampleSize: 20 });
  });

  it("kinds are independent; empty input yields empty map", () => {
    expect(medianEffortByKind([])).toEqual({});
    const out = medianEffortByKind([sample("a", 3), sample("b", 7)]);
    expect(out.a?.minutes).toBe(3);
    expect(out.b?.minutes).toBe(7);
  });
});

describe("blendedEffortMinutes", () => {
  it("n=0 → prior; large n → measured (A1 blend idiom, priorWeight 3)", () => {
    expect(blendedEffortMinutes(4, 0, 8)).toBe(8);
    // (4×3 + 8×3) / 6 = 6
    expect(blendedEffortMinutes(4, 3, 8)).toBe(6);
    // (4×100 + 8×3) / 103 ≈ 4.12
    expect(blendedEffortMinutes(4, 100, 8)).toBeCloseTo(4.117, 2);
  });
});

describe("effectiveEffortMinutes", () => {
  const measured = { place_qualifying: { minutes: 4, sampleSize: 10 } };

  it("blends measured toward the default when no user override exists", () => {
    const out = effectiveEffortMinutes({}, measured);
    // prior 8 (EFFORT_MINUTES.place_qualifying), (4×10 + 8×3)/13 ≈ 4.92
    expect(out.place_qualifying).toBeCloseTo(4.92, 2);
  });

  it("an explicit E1 tuning override always wins - user intent beats measurement", () => {
    const out = effectiveEffortMinutes({ place_qualifying: 15 }, measured);
    expect(out.place_qualifying).toBe(15);
  });

  it("kinds without measurements are absent (do-next falls back to defaults)", () => {
    const out = effectiveEffortMinutes({}, measured);
    expect(out.convert_free_bet).toBeUndefined();
  });

  it("sanity: default prior comes from EFFORT_MINUTES", () => {
    expect(EFFORT_MINUTES.place_qualifying).toBe(8);
  });
});
