import { describe, expect, it } from "vitest";
import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  anchorSeriesAtZero,
  buildAdjustmentMarkers,
  buildCasinoMarkers,
  buildChartAnnotations,
  buildChartBetMarkers,
  buildHomeChartMarkers,
  buildSettledPnlSeries,
  chartBetMarkerClassName,
  chartWindowAnchorValue,
  computePnlChartLayout,
  computePnlValueRange,
  isChartAnnotationEntry,
  markerToneForStatus,
  markerToneFromBet,
  firstLinePointTimeInWindow,
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
    note: partial.note ?? null,
    amount: partial.amount ?? null,
    createdAt: partial.createdAt ?? 1_000,
    ...partial,
  } as HistoryRow;
}

describe("buildChartBetMarkers", () => {
  it("anchors each marker on the prior plateau (first on £0 origin)", () => {
    const markers = buildChartBetMarkers([
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: 2_000 }),
      bet({ id: 2, status: "lost", actualProfit: -3, settledAt: 3_000 }),
      bet({ id: 3, status: "void", actualProfit: 0, settledAt: 4_000 }),
    ]);

    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({
      id: 1,
      kind: "bet",
      settledAtSec: 1, // 2s - 1s origin
      cumulativeValue: 0,
      betProfit: 5,
      tone: "win",
    });
    expect(markers[1]).toMatchObject({
      id: 2,
      settledAtSec: 2, // prior tip
      cumulativeValue: 5,
      betProfit: -3,
      tone: "loss",
    });
    expect(markers[2]).toMatchObject({
      id: 3,
      settledAtSec: 3,
      cumulativeValue: 2,
    });
    expect(chartBetMarkerClassName("win")).toBe("chart-bet-marker chart-bet-marker--win");
    expect(markerToneFromBet(bet({ id: 9, status: "lost", actualProfit: 12 }))).toBe("win");
    expect(markerToneForStatus("void")).toBe("neutral");
  });

  it("includes a single settled bet on the £0 origin", () => {
    const markers = buildChartBetMarkers([
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: 2_000 }),
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.settledAtSec).toBe(1);
    expect(markers[0]?.cumulativeValue).toBe(0);
  });

  it("folds Acca desk back + lays into one net campaign marker", () => {
    const markers = buildChartBetMarkers([
      bet({
        id: 1,
        status: "won",
        actualProfit: 50,
        settledAt: 5_000,
        label: "Acca · Offer",
        betType: "qualifying",
        notes: "Acca desk run - hedged on the exchange",
      }),
      bet({
        id: 2,
        status: "lost",
        actualProfit: -16.2,
        settledAt: 3_000,
        label: "Acca lay · Middlesbrough",
        betType: "lay_only",
        notes: 'Acca desk: leg 1 of "Offer"',
      }),
      bet({
        id: 3,
        status: "won",
        actualProfit: 4,
        settledAt: 4_000,
        label: "Ordinary qualify",
        betType: "qualifying",
      }),
    ]);
    expect(markers.map((m) => m.id).sort((a, b) => a - b)).toEqual([1, 3]);
    const acca = markers.find((m) => m.id === 1);
    expect(acca?.betProfit).toBeCloseTo(33.8, 10);
    expect(acca?.tone).toBe("win");
    expect(acca?.label).toBe("Acca · Offer");
  });
});

describe("buildHomeChartMarkers Acca campaign marker", () => {
  it("marks Acca as one net step and keeps BB desk lays off the ledger", () => {
    const markers = buildHomeChartMarkers({
      bets: [
        bet({
          id: 1,
          status: "won",
          actualProfit: 12,
          settledAt: 2_000,
          label: "Qualifier",
          betType: "qualifying",
        }),
        bet({
          id: 2,
          status: "lost",
          actualProfit: -16.2,
          settledAt: 3_000,
          label: "Acca lay · Middlesbrough",
          betType: "lay_only",
          notes: 'Acca desk: leg 1 of "Weekend"',
        }),
        bet({
          id: 3,
          status: "lost",
          actualProfit: -8,
          settledAt: 4_000,
          label: "BB lay · Combo",
          betType: "lay_only",
        }),
        bet({
          id: 4,
          status: "lost",
          actualProfit: -20,
          settledAt: 5_000,
          label: "Acca · Weekend",
          betType: "qualifying",
          notes: "Acca desk run - hedged on the exchange",
        }),
      ],
    });
    expect(markers.map((m) => m.id).sort((a, b) => a - b)).toEqual([1, 4]);
    const acca = markers.find((m) => m.id === 4);
    expect(acca?.betProfit).toBeCloseTo(-36.2, 10);
    expect(acca?.tone).toBe("loss");
  });
});

describe("chartWindowAnchorValue", () => {
  const nowSec = 10_000;

  it("returns 0 for All (anchorAtZero)", () => {
    const points = [
      { time: nowSec - 5_000, value: 0 },
      { time: nowSec - 1_000, value: 400 },
    ];
    expect(
      chartWindowAnchorValue(points, 86_400, { nowSec, showBadge: false, anchorAtZero: true })
    ).toBe(0);
  });

  it("returns the P&L at the window left edge for narrow windows", () => {
    const points = [
      { time: nowSec - 5_000, value: 0 },
      { time: nowSec - 3_000, value: 400 },
      { time: nowSec - 500, value: 460 },
    ];
    // ~41 min window so the left edge lands after the £400 step.
    const anchor = chartWindowAnchorValue(points, 2_500, { nowSec, showBadge: false });
    expect(anchor).toBe(400);
  });
});

describe("computePnlValueRange window anchor", () => {
  it("includes £0 for All but not when anchored to window start", () => {
    const visible = [
      { time: 1, value: 400 },
      { time: 2, value: 460 },
    ];
    const allRange = computePnlValueRange(visible, 460, 0);
    expect(allRange.min).toBeLessThan(0);

    const windowRange = computePnlValueRange(visible, 460, 400);
    expect(windowRange.min).toBeGreaterThan(0);
    expect(windowRange.min).toBeLessThan(400);
  });
});

describe("anchorSeriesAtZero", () => {
  it("prepends £0 before a profit-leading first point", () => {
    const anchored = anchorSeriesAtZero([{ time: 100, value: 12 }], 200);
    expect(anchored[0]).toEqual({ time: 99, value: 0 });
    expect(anchored[1]).toEqual({ time: 100, value: 12 });
  });

  it("prepends £0 before a loss-leading first point", () => {
    const anchored = anchorSeriesAtZero([{ time: 100, value: -1.5 }], 200);
    expect(anchored[0]).toEqual({ time: 99, value: 0 });
    expect(anchored[1]).toEqual({ time: 100, value: -1.5 });
  });

  it("leaves an already-zero start alone", () => {
    const points = [{ time: 100, value: 0 }, { time: 110, value: 5 }];
    expect(anchorSeriesAtZero(points, 200)).toEqual(points);
  });
});

describe("buildAdjustmentMarkers", () => {
  it("tones by sign and sits on the prior plateau", () => {
    const markers = buildAdjustmentMarkers([
      { id: 7, time: 5_000, amount: 5.5, detail: "Tote · +£5.50" },
      { id: 8, time: 6_000, amount: -3, detail: "Bet365 · -£3.00" },
      { id: 9, time: 7_000, amount: 0, detail: "noop" },
    ]);

    expect(markers).toHaveLength(2); // zero-amount rows are skipped
    expect(markers[0]).toMatchObject({
      id: 7,
      kind: "adjustment",
      settledAtSec: 4, // origin before first tip
      betProfit: 5.5,
      tone: "win",
      label: "Tote · +£5.50",
    });
    expect(markers[1]).toMatchObject({
      id: 8,
      settledAtSec: 5, // prior tip
      tone: "loss",
    });
  });

  it("projects on the prior plateau - the movement follows the marker", () => {
    const nowSec = 1_000;
    // Line: bet +10 at t=700, adjustment +5.5 at t=750 → origin + tips
    const linePoints = anchorSeriesAtZero(
      [
        { time: 700, value: 10 },
        { time: 750, value: 15.5 },
      ],
      nowSec
    );
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

    const markers = buildHomeChartMarkers({
      bets: [bet({ id: 1, status: "won", actualProfit: 10, settledAt: 700_000 })],
      adjustments: [{ id: 7, time: 750_000, amount: 5.5, detail: "Tote · +£5.50" }],
    });
    const adj = markers.find((m) => m.kind === "adjustment");
    expect(adj?.settledAtSec).toBe(700);
    const projected = projectBetMarkers(markers, layout!, linePoints);
    const adjProj = projected.find((p) => p.marker.kind === "adjustment");
    // On the prior tip (10), not floating under the post-step tip (15.5).
    expect(adjProj?.y).toBeCloseTo(layout!.toY(10), 6);
  });
});

describe("buildCasinoMarkers", () => {
  it("tones by realised P&L and labels with casino · title", () => {
    const markers = buildCasinoMarkers([
      {
        id: 11,
        time: 5_000,
        amount: 12.5,
        title: "£10 casino bonus",
        casino: "Ladbrokes",
      },
      {
        id: 12,
        time: 6_000,
        amount: -4,
        title: "Spins clear",
        casino: null,
      },
      {
        id: 13,
        time: 7_000,
        amount: 0,
        title: "Breakeven clear",
        casino: "Coral",
      },
    ]);

    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({
      id: 11,
      kind: "casino",
      label: "Ladbrokes · £10 casino bonus",
      settledAtSec: 4,
      betProfit: 12.5,
      tone: "win",
    });
    expect(markers[1]).toMatchObject({
      id: 12,
      kind: "casino",
      label: "Spins clear",
      settledAtSec: 5,
      tone: "loss",
    });
    expect(markers[2]).toMatchObject({
      id: 13,
      kind: "casino",
      label: "Coral · Breakeven clear",
      tone: "neutral",
    });
  });
});

describe("buildHomeChartMarkers", () => {
  it("places casino on the shared prior plateau so the chart moves after the marker", () => {
    const nowSec = 1_000;
    // Bet +10 @700, casino +8 @750, bet −3 @800
    const linePoints = anchorSeriesAtZero(
      [
        { time: 700, value: 10 },
        { time: 750, value: 18 },
        { time: 800, value: 15 },
      ],
      nowSec
    );
    const layout = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs: 600,
      showBadge: false,
      livePoints: linePoints,
      liveValue: 15,
      nowSec,
    });
    expect(layout).not.toBeNull();

    const markers = buildHomeChartMarkers({
      bets: [
        bet({ id: 1, status: "won", actualProfit: 10, settledAt: 700_000 }),
        bet({ id: 2, status: "lost", actualProfit: -3, settledAt: 800_000 }),
      ],
      casinoSettlements: [
        {
          id: 21,
          time: 750_000,
          amount: 8,
          title: "£10 casino bonus",
          casino: "PricedUp",
        },
      ],
    });

    const casino = markers.find((m) => m.kind === "casino");
    const bet2 = markers.find((m) => m.id === 2 && m.kind === "bet");
    expect(casino?.settledAtSec).toBe(700); // prior bet tip
    expect(bet2?.settledAtSec).toBe(750); // prior casino tip

    const projected = projectBetMarkers(markers, layout!, linePoints);
    expect(projected.find((p) => p.marker.kind === "casino")?.y).toBeCloseTo(
      layout!.toY(10),
      6
    );
    expect(projected.find((p) => p.marker.id === 2)?.y).toBeCloseTo(layout!.toY(18), 6);
  });
});

describe("buildSettledPnlSeries", () => {
  it("accumulates settled non-void profits in time order", () => {
    const series = buildSettledPnlSeries([
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: 2_000 }),
      bet({ id: 2, status: "void", actualProfit: 0, settledAt: 2_500 }),
      bet({ id: 3, status: "lost", actualProfit: -2, settledAt: 3_000 }),
      bet({ id: 4, status: "open", actualProfit: null, settledAt: null }),
    ]);
    expect(series).toEqual([
      { timeMs: 2_000, value: 5 },
      { timeMs: 3_000, value: 3 },
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

  it("includes casino settlements without a bet link", () => {
    expect(
      isChartAnnotationEntry(
        historyRow({ dedupe: "casino:1", kind: "casino_settlement", title: "Casino" }),
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
    const livePoints = anchorSeriesAtZero(
      [
        { time: nowSec - 100, value: 5 },
        { time: nowSec, value: 10 },
      ],
      nowSec
    );
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
        settledAt: (nowSec - 500) * 1000, // outside 300s window
      }),
      bet({
        id: 2,
        status: "won",
        actualProfit: 5,
        settledAt: (nowSec - 50) * 1000,
      }),
    ];

    const projected = projectBetMarkers(buildChartBetMarkers(bets), layout!);
    // Bet 2 sits on bet 1's tip at nowSec-500 — outside the window — so nothing projects
    // when that prior plateau is out of view. Keep a tip inside the window instead.
    expect(projected).toHaveLength(0);

    const inWindow = buildChartBetMarkers([
      bet({
        id: 1,
        status: "won",
        actualProfit: 5,
        settledAt: (nowSec - 100) * 1000,
      }),
      bet({
        id: 2,
        status: "won",
        actualProfit: 5,
        settledAt: (nowSec - 50) * 1000,
      }),
    ]);
    const projectedIn = projectBetMarkers(inWindow, layout!, livePoints);
    expect(projectedIn.some((p) => p.marker.id === 2)).toBe(true);
    expect(projectedIn.find((p) => p.marker.id === 2)?.marker.settledAtSec).toBe(
      nowSec - 100
    );
  });
});

describe("computePnlChartLayout", () => {
  it("builds a layout on narrow windows even with fewer than 2 points in view", () => {
    const nowSec = 1_000;
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

    const bets = [
      bet({ id: 1, status: "won", actualProfit: 5, settledAt: (nowSec - 200) * 1000 }),
      bet({ id: 2, status: "won", actualProfit: 5, settledAt: (nowSec - 100) * 1000 }),
    ];
    const projected = projectBetMarkers(buildChartBetMarkers(bets), layout!);
    // Bet 2 sits on bet 1's tip at nowSec-200 — inside the 300s window.
    expect(projected.some((p) => p.marker.id === 2)).toBe(true);
    expect(projected.find((p) => p.marker.id === 2)?.marker.settledAtSec).toBe(
      nowSec - 200
    );
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

describe("projectBetMarkers window gap", () => {
  it("skips markers left of Liveline's first in-window point", () => {
    const nowSec = 10_000;
    const windowSecs = 3_600;
    const buffer = 0.015;
    const rightEdge = nowSec + windowSecs * buffer;
    const leftEdge = rightEdge - windowSecs;
    const firstDrawn = nowSec - 1_800;
    const linePoints = [
      { time: nowSec - 5_000, value: 400 },
      { time: firstDrawn, value: 441 },
      { time: nowSec - 300, value: 455 },
    ];
    const layout = computePnlChartLayout({
      width: 400,
      height: 200,
      pad: { top: 12, bottom: 28, left: 16, right: 72 },
      windowSecs,
      showBadge: false,
      livePoints: linePoints,
      liveValue: 455,
      nowSec,
      referenceValue: 441,
    });
    expect(layout).not.toBeNull();

    const gapMarker = {
      id: 1,
      kind: "bet" as const,
      label: "In gap",
      status: "lost" as const,
      settledAtSec: leftEdge + 60,
      betProfit: -1,
      cumulativeValue: 441,
      tone: "loss" as const,
    };
    expect(gapMarker.settledAtSec).toBeLessThan(firstDrawn - 1);
    expect(projectBetMarkers([gapMarker], layout!, linePoints)).toHaveLength(0);

    const onLineMarker = {
      ...gapMarker,
      id: 2,
      settledAtSec: firstDrawn,
    };
    expect(projectBetMarkers([onLineMarker], layout!, linePoints)).toHaveLength(1);
  });
});

describe("projectBetMarkers with balance adjustments in the line", () => {
  it("anchors each marker on the prior plateau of the rendered series", () => {
    const nowSec = 1_000;
    const linePoints = anchorSeriesAtZero(
      [
        { time: 700, value: 10 },
        { time: 750, value: 30 },
        { time: 800, value: 25 },
        { time: 900, value: 27 },
      ],
      nowSec
    );
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

    const markers = buildHomeChartMarkers({
      bets: [
        bet({ id: 1, status: "won", actualProfit: 10, settledAt: 700_000 }),
        bet({ id: 2, status: "lost", actualProfit: -5, settledAt: 800_000 }),
        bet({ id: 3, status: "won", actualProfit: 2, settledAt: 900_000 }),
      ],
      adjustments: [{ id: 7, time: 750_000, amount: 20, detail: "Tote · +£20.00" }],
    });

    const aligned = projectBetMarkers(markers, layout!, linePoints);
    const mBet2 = aligned.find((p) => p.marker.id === 2 && p.marker.kind === "bet");
    const mBet3 = aligned.find((p) => p.marker.id === 3 && p.marker.kind === "bet");
    const mAdj = aligned.find((p) => p.marker.kind === "adjustment");
    // Bet2 sits on the adjustment tip (30); bet3 on bet2 tip (25); adj on bet1 tip (10).
    expect(mAdj?.y).toBeCloseTo(layout!.toY(10), 6);
    expect(mBet2?.y).toBeCloseTo(layout!.toY(30), 6);
    expect(mBet3?.y).toBeCloseTo(layout!.toY(25), 6);
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
