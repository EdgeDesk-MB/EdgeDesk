import { describe, expect, it } from "vitest";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { aggregateMistakes, mistakeTagLabel } from "./mistakes";

/** Settled snapshot fixture - lock £20, realise what the test says. */
function snap(
  over: Partial<EvSnapshotRow> & Pick<EvSnapshotRow, "id" | "settledAt">
): EvSnapshotRow {
  return {
    offerId: over.id,
    version: 1,
    lockedAt: (over.settledAt ?? 0) - 86_400_000,
    expectedProfit: 20,
    basis: "estimated",
    inputsJson: null,
    realizedProfit: 12,
    capturePct: 0.6,
    commissionDrag: null,
    mistakeTag: null,
    ...over,
  };
}

const JUL_10 = new Date(2026, 6, 10, 12, 0).getTime();
const JUL_20 = new Date(2026, 6, 20, 12, 0).getTime();
const JUN_15 = new Date(2026, 5, 15, 12, 0).getTime();

describe("aggregateMistakes", () => {
  it("sums £ lost (expected − realised) per tag per month", () => {
    const rows = aggregateMistakes([
      // July: two laid_late leaks of £8 each, one odds_moved of £5
      snap({ id: 1, settledAt: JUL_10, mistakeTag: "laid_late" }), // 20 − 12 = 8
      snap({ id: 2, settledAt: JUL_20, mistakeTag: "laid_late" }), // 8
      snap({
        id: 3,
        settledAt: JUL_20,
        mistakeTag: "odds_moved",
        expectedProfit: 15,
        realizedProfit: 10,
      }), // 5
      // June: one bookie_voided £20 wipeout
      snap({
        id: 4,
        settledAt: JUN_15,
        mistakeTag: "bookie_voided",
        realizedProfit: 0,
        capturePct: 0,
      }), // 20
    ]);

    expect(rows).toEqual([
      { month: "2026-07", tag: "laid_late", lostGbp: 16, count: 2 },
      { month: "2026-07", tag: "odds_moved", lostGbp: 5, count: 1 },
      { month: "2026-06", tag: "bookie_voided", lostGbp: 20, count: 1 },
    ]);
  });

  it("ignores untagged, unsettled, and non-loss snapshots", () => {
    const rows = aggregateMistakes([
      snap({ id: 1, settledAt: JUL_10 }), // untagged
      snap({ id: 2, settledAt: null, mistakeTag: "laid_late" }), // unsettled
      snap({
        id: 3,
        settledAt: JUL_10,
        mistakeTag: "laid_late",
        realizedProfit: 25,
        capturePct: 1.25,
      }), // over-captured: no loss to attribute
    ]);
    expect(rows).toEqual([]);
  });
});

describe("mistakeTagLabel", () => {
  it("maps tags to sentence-case copy", () => {
    expect(mistakeTagLabel("laid_late")).toBe("Laid late");
    expect(mistakeTagLabel("wrong_market")).toBe("Wrong market");
    expect(mistakeTagLabel("odds_moved")).toBe("Odds moved");
    expect(mistakeTagLabel("bookie_voided")).toBe("Bookie voided");
    expect(mistakeTagLabel("other")).toBe("Other");
  });
});
