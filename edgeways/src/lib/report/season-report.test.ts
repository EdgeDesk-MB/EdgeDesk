import { describe, expect, it } from "vitest";
import type { BetRow } from "@/lib/db/schema";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { buildSeasonReport, seasonYears } from "./season-report";

const D = (m: number, day: number) => new Date(2026, m - 1, day, 12, 0).getTime();

function snap(over: Partial<EvSnapshotRow> & Pick<EvSnapshotRow, "id">): EvSnapshotRow {
  return {
    offerId: over.id,
    version: 1,
    lockedAt: D(6, 1),
    expectedProfit: 10,
    basis: "estimated",
    inputsJson: null,
    realizedProfit: 8,
    capturePct: 0.8,
    commissionDrag: null,
    settledAt: D(6, 2),
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
    createdAt: D(6, 1),
    settledAt: D(6, 2),
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: null,
    ...over,
  };
}

describe("buildSeasonReport", () => {
  const bets = [
    // May: pre-capture history - profit only, no locks
    bet({ id: 1, settledAt: D(5, 10), status: "won", actualProfit: 12 }),
    // June: qualifier loss + SNR conversion (retention 38/50 = 0.76)
    bet({ id: 2, settledAt: D(6, 2) }),
    bet({ id: 3, settledAt: D(6, 5), betType: "free_snr", backStake: 50, layStake: 0, status: "won", actualProfit: 38, bookmaker: "Coral" }),
    // 2025 bet must be excluded from the 2026 season
    bet({ id: 4, settledAt: new Date(2025, 11, 20).getTime(), status: "won", actualProfit: 99 }),
  ];
  const snapshots = [
    snap({ id: 1, lockedAt: D(6, 1), settledAt: D(6, 2), expectedProfit: 20, realizedProfit: 18 }),
    snap({ id: 2, lockedAt: D(6, 3), settledAt: D(6, 5), expectedProfit: 10, realizedProfit: 9 }),
  ];

  it("builds per-month rows with pre-capture months annotated (null EV)", () => {
    const report = buildSeasonReport({ snapshots, bets, year: 2026 });
    expect(report.months.map((m) => m.month)).toEqual(["2026-05", "2026-06"]);

    const may = report.months[0]!;
    expect(may.expected).toBeNull();
    expect(may.captureRate).toBeNull();
    expect(may.profit).toBe(12);

    const jun = report.months[1]!;
    // Expected 30, realised 27 → capture 0.9; profit -2 + 38 = 36
    expect(jun.expected).toBe(30);
    expect(jun.realized).toBe(27);
    expect(jun.captureRate).toBeCloseTo(0.9, 10);
    expect(jun.profit).toBe(36);
    expect(jun.retention).toEqual({ rate: 0.76, sampleSize: 1 });
    // Lost qualifying with a winning lay: 48 × 0.02 = 0.96 commission
    expect(jun.commissionDrag).toBeCloseTo(0.96, 10);
  });

  it("year totals, capture window and best/worst bookie", () => {
    const report = buildSeasonReport({ snapshots, bets, year: 2026 });
    expect(report.totals.profit).toBe(48); // 12 - 2 + 38 (2025 excluded)
    expect(report.totals.expected).toBe(30);
    expect(report.totals.captureRate).toBeCloseTo(0.9, 10);
    expect(report.captureFrom).toBe("2026-06");
    expect(report.bestBookie).toMatchObject({ bookmaker: "Coral", profit: 38 });
    expect(report.worstBookie).toMatchObject({ bookmaker: "Bet365", profit: 10 });
  });

  it("seasonYears lists newest first across bets and snapshots", () => {
    expect(seasonYears(snapshots, bets)).toEqual([2026, 2025]);
  });
});
