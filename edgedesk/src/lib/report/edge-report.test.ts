import { describe, expect, it } from "vitest";
import type { BetRow } from "@/lib/db/schema";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { buildEdgeReport, monthsWithSettledCampaigns } from "./edge-report";

const JUL = (day: number, hour = 12) => new Date(2026, 6, day, hour, 0).getTime();

function snap(
  over: Partial<EvSnapshotRow> & Pick<EvSnapshotRow, "id">
): EvSnapshotRow {
  return {
    offerId: over.id,
    version: 1,
    lockedAt: JUL(1),
    expectedProfit: 10,
    basis: "estimated",
    inputsJson: null,
    realizedProfit: 8,
    capturePct: 0.8,
    commissionDrag: null,
    settledAt: JUL(2),
    mistakeTag: null,
    ...over,
  };
}

function bet(over: Partial<BetRow> & Pick<BetRow, "id">): BetRow {
  return {
    eventId: null,
    label: `Bet ${over.id}`,
    market: "win",
    selection: "",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 50,
    backOdds: 4,
    layStake: 48,
    layOdds: 4.2,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "lost",
    expectedProfit: null,
    actualProfit: -2,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: JUL(1),
    settledAt: JUL(2),
    offerId: null,
    quickLogged: null,
    source: null,
    ...over,
  };
}

const FIVE_SNAPS = [
  snap({ id: 1, lockedAt: JUL(1), settledAt: JUL(3), expectedProfit: 10, realizedProfit: 8 }),
  snap({ id: 2, lockedAt: JUL(2), settledAt: JUL(5), expectedProfit: 20, realizedProfit: 22 }),
  snap({ id: 3, lockedAt: JUL(4), settledAt: JUL(8), expectedProfit: 15, realizedProfit: 9, mistakeTag: "laid_late" }),
  snap({ id: 4, lockedAt: JUL(6), settledAt: JUL(10), expectedProfit: 5, realizedProfit: 5 }),
  snap({ id: 5, lockedAt: JUL(9), settledAt: JUL(12), expectedProfit: 12, realizedProfit: 10 }),
];

describe("buildEdgeReport", () => {
  it("returns the insufficient state below five settled campaigns", () => {
    const report = buildEdgeReport({
      snapshots: FIVE_SNAPS.slice(0, 3),
      bets: [],
      month: "2026-07",
    });
    expect(report.kind).toBe("insufficient");
    if (report.kind === "insufficient") expect(report.settledCampaigns).toBe(3);
  });

  it("honours the E1 minCampaigns override in both directions", () => {
    const relaxed = buildEdgeReport({
      snapshots: FIVE_SNAPS.slice(0, 3),
      bets: [],
      month: "2026-07",
      minCampaigns: 3,
    });
    expect(relaxed.kind).toBe("ready");

    const strict = buildEdgeReport({
      snapshots: FIVE_SNAPS,
      bets: [],
      month: "2026-07",
      minCampaigns: 6,
    });
    expect(strict.kind).toBe("insufficient");
    if (strict.kind === "insufficient") expect(strict.minCampaigns).toBe(6);
  });

  it("builds month totals, capture rate and the cumulative dual series", () => {
    const report = buildEdgeReport({ snapshots: FIVE_SNAPS, bets: [], month: "2026-07" });
    expect(report.kind).toBe("ready");
    if (report.kind !== "ready") return;

    // Totals: expected 62, realised 54 → capture 54/62 ≈ 0.871
    expect(report.totals.expected).toBeCloseTo(62, 10);
    expect(report.totals.realized).toBeCloseTo(54, 10);
    expect(report.totals.captureRate).toBeCloseTo(54 / 62, 6);
    expect(report.settledCampaigns).toBe(5);

    // Cumulative timeline: expected steps at lock times, realised at settle
    // times, both carried forward at every event.
    const first = report.cumulative[0]!;
    expect(first.t).toBe(JUL(1));
    expect(first.expected).toBe(10);
    expect(first.realized).toBe(0);
    const last = report.cumulative.at(-1)!;
    expect(last.t).toBe(JUL(12));
    expect(last.expected).toBeCloseTo(62, 10);
    expect(last.realized).toBeCloseTo(54, 10);

    // Mistakes for the month surface the tagged leak: 15 − 9 = £6
    expect(report.mistakes).toEqual([
      { month: "2026-07", tag: "laid_late", lostGbp: 6, count: 1 },
    ]);
  });

  it("only counts snapshots settled in the requested month", () => {
    const withJune = [
      ...FIVE_SNAPS,
      snap({ id: 9, lockedAt: new Date(2026, 5, 20).getTime(), settledAt: new Date(2026, 5, 25).getTime(), expectedProfit: 100, realizedProfit: 100 }),
    ];
    const report = buildEdgeReport({ snapshots: withJune, bets: [], month: "2026-07" });
    if (report.kind !== "ready") throw new Error("expected ready");
    expect(report.totals.expected).toBeCloseTo(62, 10);
  });

  it("computes commission drag and conversion retention from the month's bets", () => {
    const bets = [
      // Lost qualifying with a winning lay: drag 48 × 0.02 = 0.96
      bet({ id: 1 }),
      // SNR conversion settled this month: £50 face, £38 retained
      bet({ id: 2, betType: "free_snr", backStake: 50, layStake: 0, status: "won", actualProfit: 38 }),
      // Settled in June - excluded
      bet({ id: 3, settledAt: new Date(2026, 5, 20).getTime() }),
    ];
    const report = buildEdgeReport({ snapshots: FIVE_SNAPS, bets, month: "2026-07" });
    if (report.kind !== "ready") throw new Error("expected ready");
    expect(report.commissionDrag).toBeCloseTo(0.96, 10);
    expect(report.retention).toEqual({ rate: 0.76, sampleSize: 1 });
  });
});

describe("monthsWithSettledCampaigns", () => {
  it("lists months newest first", () => {
    const months = monthsWithSettledCampaigns([
      ...FIVE_SNAPS,
      snap({ id: 9, settledAt: new Date(2026, 5, 25).getTime() }),
    ]);
    expect(months).toEqual(["2026-07", "2026-06"]);
  });
});
