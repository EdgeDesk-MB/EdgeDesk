import { describe, expect, it } from "vitest";
import { raceFairOdds } from "./fair-odds";

function runner(horseId: string, bookieDecimal: number | null, nonRunner = false) {
  return { horseId, bookieDecimal, nonRunner };
}

describe("raceFairOdds", () => {
  it("returns null for an empty field", () => {
    expect(raceFairOdds([])).toBeNull();
  });

  it("returns null when all runners are non-runners", () => {
    const result = raceFairOdds([
      runner("a", 2.0, true),
      runner("b", 3.0, true),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when fewer than 80% of eligible runners have prices", () => {
    // 5 eligible, only 3 priced → 60% < 80%
    const result = raceFairOdds([
      runner("a", 2.0),
      runner("b", 3.0),
      runner("c", 4.0),
      runner("d", null),
      runner("e", null),
    ]);
    expect(result).toBeNull();
  });

  it("computes fair odds when ≥80% of eligible runners have prices", () => {
    // 4 eligible, all priced → 100%
    const result = raceFairOdds([
      runner("a", 2.0),
      runner("b", 3.0),
      runner("c", 4.0),
      runner("d", 6.0),
    ]);
    expect(result).not.toBeNull();
    expect(result!.size).toBe(4);
  });

  it("excludes non-runners from the computation", () => {
    // 2 eligible + 1 NR → only 2 in the market
    const result = raceFairOdds([
      runner("a", 2.0),
      runner("b", 3.0),
      runner("nr", 1.5, true),
    ]);
    expect(result).not.toBeNull();
    expect(result!.has("nr")).toBe(false);
    expect(result!.has("a")).toBe(true);
  });

  it("overPct is positive when bookie price is above fair", () => {
    // 2 runners at 2.2 each → implied sum = 0.909 (under-round)
    // noVig normalises to 50/50 → fair = 2.0 < 2.2 → overPct > 0 (bookies being generous)
    const result = raceFairOdds([
      runner("a", 2.2),
      runner("b", 2.2),
    ]);
    expect(result).not.toBeNull();
    for (const [, v] of result!) {
      expect(v.fair).toBeCloseTo(2.0, 3);
      expect(v.overPct).toBeGreaterThan(0); // bookie > fair
    }
  });

  it("overPct is zero for a perfectly fair (zero-margin) market", () => {
    // Two runners at exactly the break-even price (2.0 each = 50%+50% = 100%)
    // noVig removes overround → fair odds = 2.0 exactly
    const result = raceFairOdds([
      runner("a", 2.0),
      runner("b", 2.0),
    ]);
    expect(result).not.toBeNull();
    for (const [, v] of result!) {
      expect(v.overPct).toBeCloseTo(0, 3);
    }
  });
});
