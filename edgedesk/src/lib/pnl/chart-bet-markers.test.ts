import { describe, expect, it } from "vitest";
import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  buildAdjustmentMarkers,
  buildChartAnnotations,
  buildChartBetMarkers,
  buildSettledPnlSeries,
  chartBetMarkerClassName,
  computePnlChartLayout,
  isChartAnnotationEntry,
  markerToneForStatus,
  markerToneFromBet,
  projectBetMarkers,
  seriesValueAt,
  spreadOverlappingAnnotations,
} from "./chart-bet-markers";
import { buildHistoryContext } from "@/lib/history-display";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id" | "status">): BetRow {
  return {
    label: partial.label ?? `Bet ${partial.id}`,
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

describe("buildAdjustmentMarkers", () => {
  it("tones by sign and anchors at the adjustment time", () => {
    const markers = buildAdjustmentMarkers([
      { id: 7, time: 5_000, amount: 5.5, detail: "Tote · +£5.50" },
      { id: 8, time: 6_000, amount: -3, detail: "Bet365 · -£3.00" },
      { id: 9, time: 7_000, amount: 0, detail: "noop" },
    ]);

    expect(markers).toHaveLength(2); // zero-amount rows are skipped
    expect(markers[0]).toMatchObject({
      id: 7,
      kind: "adjustment",
      settledAtSec: 5,
      betProfit: 5.5,
      tone: "win",
      label: "Tote · +£5.50",
    });
    expect(markers[1]?.tone).toBe("loss");
  });

  it("projects at the foot of its own step - the movement follows the marker", () => {
    const nowSec = 1_000;
    // Line: bet +10 at t=700, adjustment +5.5 at t=750 → (700,10) (750,15.5)
    const linePoints = [
      { time: 700, value: 10 },
      { time: 750, value: 15.5 },
    ];
    const layout = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs: 600,
      showBadge: false,
      livePoints: linePoints,
      liveValue: 15.5,
      nowSec,
    });
    expect(layout).not.toBeNull();

    const markers = buildAdjustmentMarkers([
      { id: 7, time: 750_000, amount: 5.5, detail: "Tote · +£5.50" },
    ]);
    const projected = projectBetMarkers(markers, layout!, linePoints);
    expect(projected).toHaveLength(1);
    // Foot of the step: line value strictly before t=750 is 10, not 15.5.
    expect(projected[0]?.y).toBeCloseTo(layout!.toY(10), 6);
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

describe("computePnlChartLayout", () => {
  it("builds a layout on narrow windows even with fewer than 2 points in view", () => {
    const nowSec = 1_000;
    // Both line points are outside a 300s (5m) window - only liveValue anchors it.
    const livePoints = [
      { time: nowSec - 5_000, value: 0 },
      { time: nowSec - 4_000, value: 10 },
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

    // A bet that settled inside the narrow window still projects.
    const bets = [
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: (nowSec - 200) * 1000 }),
      bet({ id: 2, status: "won", actualProfit: 5, settledAt: (nowSec - 100) * 1000 }),
    ];
    const projected = projectBetMarkers(buildChartBetMarkers(bets), layout!);
    expect(projected).toHaveLength(1);
    expect(projected[0]?.marker.id).toBe(2);
  });

  it("reuses fallbackRange (not the currentValue/referenceValue guess) when the window is sparse", () => {
    const nowSec = 1_000;
    const livePoints = [
      { time: nowSec - 5_000, value: 0 },
      { time: nowSec - 4_000, value: 165 },
    ];
    const wideRange = { min: 0, max: 180 };

    const withFallback = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs: 300,
      showBadge: false,
      livePoints,
      liveValue: 165,
      nowSec,
      fallbackRange: wideRange,
    });
    expect(withFallback?.hasSufficientData).toBe(false);
    expect(withFallback?.minVal).toBe(0);
    expect(withFallback?.maxVal).toBe(180);

    const withoutFallback = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs: 300,
      showBadge: false,
      livePoints,
      liveValue: 165,
      nowSec,
    });
    // No fallback supplied - falls back to the narrower currentValue/referenceValue guess.
    expect(withoutFallback?.maxVal).not.toBe(180);
  });
});

describe("seriesValueAt", () => {
  const points = [
    { time: 700, value: 10 },
    { time: 750, value: 30 },
    { time: 800, value: 25 },
  ];

  it("returns the last value at or before the time", () => {
    expect(seriesValueAt(points, 760)).toBe(30);
    expect(seriesValueAt(points, 750)).toBe(30);
    expect(seriesValueAt(points, 900)).toBe(25);
  });

  it("strictly-before excludes a point at the exact time", () => {
    expect(seriesValueAt(points, 750, { before: true })).toBe(10);
  });

  it("returns null before the first point", () => {
    expect(seriesValueAt(points, 699)).toBeNull();
    expect(seriesValueAt([], 800)).toBeNull();
  });
});

describe("projectBetMarkers with balance adjustments in the line", () => {
  it("anchors markers to the rendered series, not the bets-only cumulative", () => {
    const nowSec = 1_000;
    // Bets: +10 at t=700, −5 at t=800, +2 at t=900 (bets-only cumulative 10, 5, 7).
    // A +£20 P&L balance adjustment at t=750 shifts the rendered line:
    // (700,10) (750,30) (800,25) (900,27).
    const linePoints = [
      { time: 700, value: 10 },
      { time: 750, value: 30 },
      { time: 800, value: 25 },
      { time: 900, value: 27 },
    ];
    const layout = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs: 600,
      showBadge: false,
      livePoints: linePoints,
      liveValue: 27,
      nowSec,
    });
    expect(layout).not.toBeNull();

    const bets = [
      bet({ id: 1, status: "won", actualProfit: 10, settledAt: 700_000 }),
      bet({ id: 2, status: "lost", actualProfit: -5, settledAt: 800_000 }),
      bet({ id: 3, status: "won", actualProfit: 2, settledAt: 900_000 }),
    ];
    const markers = buildChartBetMarkers(bets);

    // Without the line, marker 3 sits at the stale bets-only value (5).
    const stale = projectBetMarkers(markers, layout!);
    const staleM3 = stale.find((p) => p.marker.id === 3);
    expect(staleM3?.y).toBeCloseTo(layout!.toY(5), 6);

    // With the line, markers land ON the rendered series (adjustment included).
    const aligned = projectBetMarkers(markers, layout!, linePoints);
    const m2 = aligned.find((p) => p.marker.id === 2);
    const m3 = aligned.find((p) => p.marker.id === 3);
    expect(m2?.y).toBeCloseTo(layout!.toY(10), 6); // line at t=700 is 10
    expect(m3?.y).toBeCloseTo(layout!.toY(25), 6); // line at t=800 is 25, not 5
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
