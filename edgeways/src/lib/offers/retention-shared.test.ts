import { describe, expect, it } from "vitest";
import { blendedRetention } from "./retention-shared";

describe("blendedRetention", () => {
  it("returns prior when n=0", () => {
    expect(blendedRetention(0, 0)).toBeCloseTo(0.8);
    expect(blendedRetention(0.6, 0)).toBeCloseTo(0.8);
  });

  it("blends at n=5 (half weight)", () => {
    // measured=0.7, n=5, prior=0.8, priorWeight=5 → (0.7*5 + 0.8*5)/(5+5) = 0.75
    expect(blendedRetention(0.7, 5)).toBeCloseTo(0.75);
  });

  it("converges toward measured at large n", () => {
    // (0.6*100 + 0.8*5)/105 ≈ 0.609 — much closer to measured (0.6) than prior (0.8)
    const rate = blendedRetention(0.6, 100);
    expect(rate).toBeCloseTo(0.609, 2);
    expect(rate).toBeLessThan(0.65);
  });

  it("respects custom prior and priorWeight", () => {
    // measured=1.0, n=10, prior=0.5, priorWeight=10 → (10 + 5)/20 = 0.75
    expect(blendedRetention(1.0, 10, 0.5, 10)).toBeCloseTo(0.75);
  });

  it("returns the prior instead of NaN when n=0 and priorWeight=0 (E1 tuning)", () => {
    expect(blendedRetention(0, 0, 0.8, 0)).toBe(0.8);
    // With data, priorWeight=0 means pure measured rate
    expect(blendedRetention(0.6, 4, 0.8, 0)).toBeCloseTo(0.6);
  });
});
