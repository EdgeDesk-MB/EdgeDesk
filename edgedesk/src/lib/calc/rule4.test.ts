import { describe, expect, it } from "vitest";
import { rule4Adjust, rule4EffectiveOdds } from "./rule4";

describe("rule4", () => {
  it("10p in the £ reduces 5.0 odds to 4.6", () => {
    expect(rule4EffectiveOdds(5, 10)).toBeCloseTo(4.6, 4);
  });

  it("adjusts winnings on a £10 stake", () => {
    const r = rule4Adjust(10, 5, 10);
    expect(r.originalWinnings).toBeCloseTo(40, 4);
    expect(r.adjustedWinnings).toBeCloseTo(36, 4);
    expect(r.effectiveOdds).toBeCloseTo(4.6, 4);
  });

  it("zero deduction leaves odds unchanged", () => {
    expect(rule4EffectiveOdds(3.5, 0)).toBe(3.5);
  });
});
