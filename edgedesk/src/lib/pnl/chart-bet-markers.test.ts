import { describe, expect, it } from "vitest";
import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  buildChartAnnotations,
  buildChartBetMarkers,
  buildSettledPnlSeries,
  chartBetMarkerClassName,
  computePnlChartLayout,
  isChartAnnotationEntry,
  markerToneForStatus,
  markerToneFromBet,
  projectBetMarkers,
  spreadOverlappingAnnotations,
} from "./chart-bet-markers";
import { buildHistoryContext } from "@/lib/history-display";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id" | "status">): BetRow {
  return {
    id: partial.id,
    label: partial.label ?? `Bet ${partial.id}`,
    status: partial.status,
    actualProfit: partial.actualProfit ?? null,
    settledAt: partial.settledAt ?? null,
    createdAt: partial.createdAt ?? partial.settledAt ?? 1_000,
    eventId: partial.eventId ?? null,
    market: "match_odds",
    selection: "Home",
    betType: "back",
    backStake: 10,
    backOdds: 2,
    layStake: null,
    layOdds: null,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    notes: null,
    bookmaker: "Test",
    exchange: null,
    expectedProfit: null,
    triggerText: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    offerId: null,
    ...partial,
  } as BetRow;
}

function historyRow(
  partial: Partial<HistoryRow> & Pick<HistoryRow, "dedupe" | "kind" | "title">
): HistoryRow {
  return {
    id: partial.id ?? 1,
    eventId: partial.eventId ?? null,
    betId: partial.betId ?? null,
    minute: partial.minute ?? null,
    detail: partial.detail ?? null,
    amount: partial.amount ?? null,
    createdAt: partial.createdAt ?? 1_000,
    ...partial,
  } as HistoryRow;
}

describe("buildChartBetMarkers", () => {
  it("builds cumulative markers in settlement order", () => {
    const markers = buildChartBetMarkers([
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: 2_000 }),
      bet({ id: 2, status: "lost", actualProfit: -3, settledAt: 3_000 }),
      bet({ id: 3, status: "void", actualProfit: 0, settledAt: 4_000 }),
    ]);

    expect(markers).toHaveLength(2);
    expect(markers[0]?.id).toBe(2);
    expect(markers[0]?.settledAtSec).toBe(2);
    expect(markers[0]?.cumulativeValue).toBe(5);
    expect(markers[1]?.id).toBe(3);
    expect(markers[1]?.settledAtSec).toBe(3);
    expect(markers[1]?.cumulativeValue).toBe(2);
    expect(markers[0]?.tone).toBe("loss");
    expect(chartBetMarkerClassName("win")).toBe("chart-bet-marker chart-bet-marker--win");
    expect(markerToneFromBet(bet({ id: 9, status: "lost", actualProfit: 12 }))).toBe("win");
    expect(markerToneForStatus("void")).toBe("neutral");
  });
});

describe("buildSettledPnlSeries", () => {
  it("builds cumulative settled values", () => {
    const series = buildSettledPnlSeries([
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: 2_000 }),
      bet({ id: 2, status: "lost", actualProfit: -3, settledAt: 3_000 }),
    ]);
    expect(series).toEqual([
      { timeMs: 2_000, value: 5 },
      { timeMs: 3_000, value: 2 },
    ]);
  });
});

describe("isChartAnnotationEntry", () => {
  const bets = [bet({ id: 1, status: "open", eventId: 9 })];
  const ctx = buildHistoryContext([], bets, {});

  it("includes goals on events with user bets", () => {
    expect(
      isChartAnnotationEntry(
        historyRow({ dedupe: "g:1", kind: "goal", title: "Goal", eventId: 9 }),
        ctx
      )
    ).toBe(true);
  });

  it("excludes full-time results", () => {
    expect(
      isChartAnnotationEntry(
        historyRow({ dedupe: "ft:1", kind: "full_time", title: "Full time", eventId: 9 }),
        ctx
      )
    ).toBe(false);
  });
});

describe("buildChartAnnotations", () => {
  it("maps feed rows to chart positions", () => {
    const bets = [
      bet({
        id: 1,
        status: "won",
        actualProfit: 5,
        settledAt: 3_000,
        createdAt: 1_000,
        eventId: 9,
      }),
    ];
    const ctx = buildHistoryContext([], bets, {});
    const rows = [
      historyRow({
        dedupe: "bet-placed:1",
        kind: "bet_placed",
        title: "Bet placed",
        betId: 1,
        createdAt: 1_000,
      }),
      historyRow({
        dedupe: "2up:9:home",
        kind: "two_up",
        title: "2UP triggered",
        eventId: 9,
        createdAt: 2_000,
      }),
      historyRow({
        dedupe: "bet:1:3000",
        kind: "settlement",
        title: "Bet won",
        betId: 1,
        amount: 5,
        createdAt: 3_000,
      }),
    ];

    const annotations = buildChartAnnotations(rows, ctx);
    expect(annotations).toHaveLength(3);
    expect(annotations[0]?.entry.kind).toBe("bet_placed");
    expect(annotations[1]?.entry.kind).toBe("two_up");
    expect(annotations[2]?.value).toBe(0);
  });
});

describe("projectBetMarkers", () => {
  it("filters markers outside the visible time window", () => {
    const nowSec = 1_000;
    const livePoints = [
      { time: nowSec - 100, value: 0 },
      { time: nowSec, value: 10 },
    ];
    const layout = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs: 300,
      showBadge: false,
      livePoints,
      liveValue: 10,
      nowSec,
    });
    expect(layout).not.toBeNull();

    const bets = [
      bet({
        id: 1,
        status: "won",
        actualProfit: 5,
        settledAt: (nowSec - 150) * 1000,
      }),
      bet({
        id: 2,
        status: "won",
        actualProfit: 5,
        settledAt: (nowSec - 50) * 1000,
      }),
    ];

    const projected = projectBetMarkers(buildChartBetMarkers(bets), layout!);
    expect(projected).toHaveLength(1);
    expect(projected[0]?.marker.id).toBe(2);
    expect(projected[0]?.marker.settledAtSec).toBe(nowSec - 150);
  });
});

describe("spreadOverlappingAnnotations", () => {
  it("offsets markers that share the same x", () => {
    const base = {
      annotation: {
        key: "a",
        entry: historyRow({ dedupe: "a", kind: "goal", title: "Goal" }),
        timeSec: 1,
        value: 0,
        href: "/tracker",
        title: "Goal",
      },
      x: 100,
      y: 50,
    };
    const spread = spreadOverlappingAnnotations([
      base,
      { ...base, annotation: { ...base.annotation, key: "b" } },
    ]);
    expect(spread[0]?.y).not.toBe(spread[1]?.y);
  });
});
