import { describe, expect, it } from "vitest";
import {
  accaCampaignSettledProfit,
  activeAccaDeskLayBetIds,
  accaRunSquareProvisional,
  completedAccaDeskLinkedBetIds,
  completedAccaSeriesPoints,
  isDeferredAccaDeskLaySettlement,
  sumAccaSquareProvisional,
} from "./acca-provisional";
import type { AccaLegRow, AccaRunRow } from "@/lib/db/schema";

function run(partial: Partial<AccaRunRow> & Pick<AccaRunRow, "id" | "method">): AccaRunRow {
  return {
    offerId: null,
    label: "Test",
    stake: 10,
    bookmaker: null,
    commission: 0,
    refundAmount: null,
    backBetId: 1,
    wholeLayBetId: null,
    wholeLayStake: null,
    wholeLayOdds: null,
    boostPct: null,
    noLay: 0,
    muteAlerts: 0,
    status: "active",
    createdAt: 1,
    settledAt: null,
    ...partial,
  };
}

function leg(
  partial: Partial<AccaLegRow> & Pick<AccaLegRow, "id" | "seq" | "result">
): AccaLegRow {
  return {
    runId: 1,
    label: `L${partial.seq}`,
    eventId: null,
    sport: null,
    market: null,
    selection: null,
    backOdds: 2,
    layOdds: null,
    layStake: null,
    layBetId: null,
    scheduledAt: null,
    ...partial,
  };
}

describe("acca provisional wiring helpers", () => {
  it("sums covered mid-run square floors at £0", () => {
    const bundles = [
      {
        run: run({ id: 1, method: "sequential" }),
        backBetType: "qualifying",
        legs: [
          leg({ id: 1, seq: 1, result: "won", layStake: 10, layOdds: 2, layBetId: 11 }),
          leg({ id: 2, seq: 2, result: "pending", layStake: 20, layOdds: 3, layBetId: 12 }),
          leg({ id: 3, seq: 3, result: "pending" }),
        ],
      },
    ];
    expect(accaRunSquareProvisional(bundles[0]!)?.value).toBe(0);
    expect(sumAccaSquareProvisional(bundles)).toBe(0);
    expect(activeAccaDeskLayBetIds(bundles)).toEqual(new Set([11, 12]));
    expect(
      isDeferredAccaDeskLaySettlement(
        { id: 11, label: "Acca lay · A", betType: "lay_only", status: "lost" },
        activeAccaDeskLayBetIds(bundles)
      )
    ).toBe(true);
  });

  it("covered square floor stays £0 even when a prior lay already settled on the ledger", () => {
    // Composition: deferred lay actualProfit −£10 must not sit in settled
    // while mid-run (non-final) square provisional is £0 — top bar = £0.
    const bundles = [
      {
        run: run({ id: 1, method: "sequential" }),
        backBetType: "qualifying",
        legs: [
          leg({ id: 1, seq: 1, result: "won", layStake: 10, layOdds: 2, layBetId: 11 }),
          leg({ id: 2, seq: 2, result: "pending", layStake: 20, layOdds: 3, layBetId: 12 }),
          leg({ id: 3, seq: 3, result: "pending" }),
        ],
      },
    ];
    const deferred = activeAccaDeskLayBetIds(bundles);
    const settledContribution = isDeferredAccaDeskLaySettlement(
      { id: 11, label: "Acca lay · A", betType: "lay_only", status: "lost" },
      deferred
    )
      ? 0
      : -10;
    expect(sumAccaSquareProvisional(bundles)).toBe(0);
    expect(settledContribution + sumAccaSquareProvisional(bundles)).toBe(0);
  });

  it("ignores completed runs for deferral and provisional", () => {
    const bundles = [
      {
        run: run({ id: 1, method: "sequential", status: "completed" }),
        backBetType: "qualifying",
        legs: [
          leg({ id: 1, seq: 1, result: "won", layStake: 10, layOdds: 2, layBetId: 11 }),
          leg({ id: 2, seq: 2, result: "lost", layStake: 20, layOdds: 3, layBetId: 12 }),
        ],
      },
    ];
    expect(sumAccaSquareProvisional(bundles)).toBe(0);
    expect(activeAccaDeskLayBetIds(bundles).size).toBe(0);
  });

  it("folds a completed Acca into one series point at run.settledAt", () => {
    // Final lay liability −£36 then back win +£50 at the same ms would
    // otherwise draw a vertical spike; chart should see net +£14 once.
    const settledAt = 1_700_000_000_000;
    const bundles = [
      {
        run: run({
          id: 1,
          method: "sequential",
          status: "completed",
          backBetId: 10,
          settledAt,
        }),
        backBetType: "qualifying",
        legs: [
          leg({ id: 1, seq: 1, result: "won", layStake: 10, layOdds: 2, layBetId: 11 }),
          leg({ id: 2, seq: 2, result: "won", layStake: 20, layOdds: 2.8, layBetId: 12 }),
        ],
      },
    ];
    const betsById = new Map([
      [10, { status: "won", actualProfit: 50 }],
      [11, { status: "lost", actualProfit: -10 }],
      [12, { status: "lost", actualProfit: -36 }],
    ]);
    expect(completedAccaDeskLinkedBetIds(bundles)).toEqual(new Set([10, 11, 12]));
    expect(accaCampaignSettledProfit(bundles[0]!, betsById)).toBe(4);
    expect(completedAccaSeriesPoints(bundles, betsById, () => 0)).toEqual([
      { time: settledAt, profit: 4, commission: 0 },
    ]);
  });

  it("consolidates a lost qualifying Acca for History (back + lays)", () => {
    // Back −£20 + net lays −£20.84 → History and chart both show −£40.84.
    const bundle = {
      run: run({
        id: 1,
        method: "sequential",
        status: "completed",
        backBetId: 10,
        settledAt: 1_700_000_000_000,
      }),
      backBetType: "qualifying",
      legs: [
        leg({ id: 1, seq: 1, result: "won", layStake: 10, layOdds: 3.084, layBetId: 11 }),
        leg({ id: 2, seq: 2, result: "lost", layStake: 22, layOdds: 1.9, layBetId: 12 }),
        leg({ id: 3, seq: 3, result: "pending" }),
      ],
    };
    const betsById = new Map([
      [10, { status: "lost", actualProfit: -20 }],
      [11, { status: "lost", actualProfit: -20.84 }],
      [12, { status: "won", actualProfit: 0 }],
    ]);
    expect(accaCampaignSettledProfit(bundle, betsById)).toBeCloseTo(-40.84, 10);
  });

  it("does not emit a series point while the Acca run is still active", () => {
    const bundles = [
      {
        run: run({ id: 1, method: "sequential", status: "active", backBetId: 10 }),
        backBetType: "qualifying",
        legs: [
          leg({ id: 1, seq: 1, result: "won", layStake: 10, layOdds: 2, layBetId: 11 }),
          leg({ id: 2, seq: 2, result: "pending", layStake: 20, layOdds: 3, layBetId: 12 }),
        ],
      },
    ];
    const betsById = new Map([
      [10, { status: "open", actualProfit: null }],
      [11, { status: "lost", actualProfit: -10 }],
      [12, { status: "open", actualProfit: null }],
    ]);
    expect(completedAccaSeriesPoints(bundles, betsById, () => 0)).toEqual([]);
    expect(completedAccaDeskLinkedBetIds(bundles).size).toBe(0);
  });
});
