import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  accaRunLabelFromBack,
  isAccaDeskBack,
  isAccaDeskLay,
  isAccaLayForRun,
} from "@/lib/bets/acca-desk-bets";
import { isBetBuilderDeskLay } from "@/lib/bets/bet-builder-desk-bets";
import { roundPence } from "@/lib/calc/money";
import {
  historyEntryHref,
  historyEntrySubtitle,
  historyEntryTitle,
  historyOccurredAt,
  isDeskCampaignLayHistoryEntry,
  type HistoryContext,
} from "@/lib/history-display";

/** Acca / BB desk campaign legs — keep chart markers aligned with folded series. */
function isDeskCampaignChartBet(
  bet: Pick<BetRow, "label" | "notes" | "betType">
): boolean {
  return isAccaDeskLay(bet) || isAccaDeskBack(bet) || isBetBuilderDeskLay(bet);
}

export interface LivePnlPoint {
  time: number;
  value: number;
}

export interface PnlChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const PNL_CHART_PADDING_PANEL: PnlChartPadding = {
  top: 12,
  bottom: 28,
  left: 16,
  right: 72,
};

export const PNL_CHART_PADDING_DEFAULT: PnlChartPadding = {
  top: 12,
  bottom: 28,
  left: 12,
  right: 80,
};

/** Mirrors Liveline's internal window-change animation (`WINDOW_TRANSITION_MS`, not exported by the lib). */
export const PNL_CHART_WINDOW_TRANSITION_MS = 750;
/** Bet markers stay hidden for the full transition, then fade in over half that time. */
export const PNL_CHART_MARKER_FADE_IN_MS = PNL_CHART_WINDOW_TRANSITION_MS / 2;

/**
 * Liveline interpolates `window` over {@link PNL_CHART_WINDOW_TRANSITION_MS}.
 * If we clip the series to the new span immediately, a shrink leaves empty
 * chart on the left, so the period looks cut rather than zoomed.
 */
export function shouldLingerChartPlotCover(
  previousViewportSecs: number,
  nextViewportSecs: number,
  reduceMotion: boolean
): boolean {
  if (reduceMotion) return false;
  return nextViewportSecs < previousViewportSecs;
}

/** Series span to feed Liveline: the wider of the viewport and an in-flight shrink cover. */
export function chartPlotCoverSecs(
  viewportSecs: number,
  lingerCoverSecs: number | null
): number {
  if (lingerCoverSecs == null) return viewportSecs;
  return Math.max(viewportSecs, lingerCoverSecs);
}

const WINDOW_BUFFER_BADGE = 0.05;
const WINDOW_BUFFER_NO_BADGE = 0.015;

/** Left edge of Liveline's visible time window (seconds). */
export function chartWindowLeftEdge(
  windowSecs: number,
  nowSec: number,
  showBadge: boolean
): number {
  const buffer = showBadge ? WINDOW_BUFFER_BADGE : WINDOW_BUFFER_NO_BADGE;
  const rightEdge = nowSec + windowSecs * buffer;
  return rightEdge - windowSecs;
}

/**
 * Value Liveline should treat as the chart floor reference.
 * "All" anchors at £0; narrower windows anchor at the P&L at the window's
 * left edge so the first in-range point sits on the same baseline as £0 in All.
 */
export function chartWindowAnchorValue(
  points: LivePnlPoint[],
  windowSecs: number,
  opts?: { nowSec?: number; showBadge?: boolean; anchorAtZero?: boolean }
): number {
  if (opts?.anchorAtZero || windowSecs <= 0) return 0;
  const nowSec = opts?.nowSec ?? Date.now() / 1000;
  const leftEdge = chartWindowLeftEdge(windowSecs, nowSec, opts?.showBadge ?? false);
  const atEdge = seriesValueAt(points, leftEdge);
  if (atEdge != null) return atEdge;
  for (const p of points) {
    if (p.time >= leftEdge - 2) return p.value;
  }
  return points[0]?.value ?? 0;
}

export type ChartBetMarkerTone = "win" | "loss" | "neutral";

export interface ChartBetMarker {
  id: number;
  /** Settled bet (default), P&L-affecting balance adjustment, or casino settlement. */
  kind?: "bet" | "adjustment" | "casino";
  label: string;
  status: BetRow["status"];
  /** Prior-plateau time (where the icon sits on the line). */
  settledAtSec: number;
  /** Ledger event time. Window membership uses this, not the prior plateau. */
  eventTimeSec?: number;
  betProfit: number;
  cumulativeValue: number;
  tone: ChartBetMarkerTone;
}

export interface PnlAdjustment {
  id: number;
  /** Epoch ms of the adjustment (history createdAt). */
  time: number;
  amount: number;
  detail: string | null;
}

/** Completed casino campaign as a chart marker source (from AppState.casinoSettlements). */
export interface ChartCasinoSettlement {
  id: number;
  /** Epoch ms of completion. */
  time: number;
  amount: number;
  title: string;
  casino: string | null;
}

export interface ProjectedBetMarker {
  marker: ChartBetMarker;
  x: number;
  y: number;
}

/** Feed events that mark a money-position change on the chart (excludes results / kick-off). */
export const CHART_ANNOTATION_KINDS = new Set<HistoryRow["kind"]>([
  "bet_placed",
  "settlement",
  "casino_settlement",
  "goal",
  "two_up",
  "free_bet_promo",
]);

export interface ChartAnnotation {
  key: string;
  entry: HistoryRow;
  timeSec: number;
  /** Settled cumulative P&L at this moment (y-axis). */
  value: number;
  href: string;
  title: string;
  subtitle?: string;
  amount?: number | null;
}

export interface PnlChartLayout {
  chartW: number;
  chartH: number;
  pad: PnlChartPadding;
  leftEdge: number;
  rightEdge: number;
  minVal: number;
  maxVal: number;
  valRange: number;
  /** False when the window has fewer than 2 in-range points and `minVal`/`maxVal` came from `fallbackRange` (or a low-confidence single-value guess). */
  hasSufficientData: boolean;
  toX: (timeSec: number) => number;
  toY: (value: number) => number;
}

export interface ProjectedChartAnnotation {
  annotation: ChartAnnotation;
  x: number;
  y: number;
}

/** Mirrors Liveline `computeRange` (12% margin, includes reference line). */
export function computePnlValueRange(
  visible: LivePnlPoint[],
  currentValue: number,
  referenceValue = 0,
  exaggerate = false
): { min: number; max: number } {
  let targetMin = Infinity;
  let targetMax = -Infinity;
  for (const p of visible) {
    if (p.value < targetMin) targetMin = p.value;
    if (p.value > targetMax) targetMax = p.value;
  }
  if (currentValue < targetMin) targetMin = currentValue;
  if (currentValue > targetMax) targetMax = currentValue;
  if (referenceValue < targetMin) targetMin = referenceValue;
  if (referenceValue > targetMax) targetMax = referenceValue;

  const rawRange = targetMax - targetMin;
  const marginFactor = exaggerate ? 0.01 : 0.12;
  const minRange = rawRange * (exaggerate ? 0.02 : 0.1) || (exaggerate ? 0.04 : 0.4);
  if (rawRange < minRange) {
    const mid = (targetMin + targetMax) / 2;
    targetMin = mid - minRange / 2;
    targetMax = mid + minRange / 2;
  } else {
    const margin = rawRange * marginFactor;
    targetMin -= margin;
    targetMax += margin;
  }
  return { min: targetMin, max: targetMax };
}

export function markerToneForStatus(status: BetRow["status"]): ChartBetMarkerTone {
  switch (status) {
    case "won":
    case "early_payout":
    case "half_win":
      return "win";
    case "lost":
    case "half_lose":
      return "loss";
    default:
      return "neutral";
  }
}

/** Prefer realised P&L for ring colour — status alone can disagree with amount. */
export function markerToneFromBet(bet: BetRow): ChartBetMarkerTone {
  const profit = bet.actualProfit;
  if (profit != null && bet.status !== "void" && bet.status !== "push") {
    if (profit > 0.004) return "win";
    if (profit < -0.004) return "loss";
  }
  return markerToneForStatus(bet.status);
}

export function chartBetMarkerClassName(tone: ChartBetMarkerTone): string {
  return `chart-bet-marker chart-bet-marker--${tone}`;
}

export function settlementStatusLabel(status: BetRow["status"]): string {
  const labels: Partial<Record<BetRow["status"], string>> = {
    won: "Won",
    lost: "Lost",
    void: "Void",
    early_payout: "Early payout",
    half_win: "Half win",
    half_lose: "Half lose",
    push: "Push",
  };
  return labels[status] ?? status;
}

/**
 * Chart / marker convention (bets, casino, adjustments share this):
 *
 * 1. The series point for an event is the POST-step cumulative at that time.
 * 2. The marker for that event sits on the PRIOR plateau (previous event's
 *    series point, or the £0 origin for the first event).
 * 3. Reading left → right: marker is in place on the line, then the chart
 *    moves to the new value. Markers must sit ON the plotted line, not at a
 *    pre-step Y under the post-step tip.
 */

type LedgerMarkerSource = {
  id: number;
  kind: "bet" | "casino" | "adjustment";
  /** Epoch ms of the ledger event. */
  time: number;
  amount: number;
  label: string;
  status: BetRow["status"];
  tone: ChartBetMarkerTone;
};

/**
 * Build markers for a mixed P&L ledger. Each marker is anchored at the prior
 * plateau so it stays on the rendered line; the series tip for that event
 * follows to the right.
 */
export function buildPnlChartMarkers(events: LedgerMarkerSource[]): ChartBetMarker[] {
  const sorted = [...events].sort((a, b) => a.time - b.time || a.id - b.id);
  if (sorted.length === 0) return [];

  let running = 0;
  const plateaus: { timeSec: number; value: number }[] = [];
  for (const ev of sorted) {
    // Plateau after this event = series tip (marker for the *next* event sits here).
    if (ev.kind === "bet" && ev.status === "void") {
      // Void does not move P&L but still occupies a series/time slot.
    } else {
      running += ev.amount;
    }
    plateaus.push({
      timeSec: ev.time / 1000,
      value: Math.round(running * 100) / 100,
    });
  }

  const markers: ChartBetMarker[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    if (i === 0) {
      // First event: sit on the £0 origin just before its tip (matches
      // anchorSeriesAtZero). Chart then moves to the first tip.
      markers.push({
        id: ev.id,
        kind: ev.kind,
        label: ev.label,
        status: ev.status,
        settledAtSec: ev.time / 1000 - 1,
        eventTimeSec: ev.time / 1000,
        betProfit: ev.amount,
        cumulativeValue: 0,
        tone: ev.tone,
      });
      continue;
    }
    const prior = plateaus[i - 1]!;
    markers.push({
      id: ev.id,
      kind: ev.kind,
      label: ev.label,
      status: ev.status,
      settledAtSec: prior.timeSec,
      eventTimeSec: ev.time / 1000,
      betProfit: ev.amount,
      cumulativeValue: prior.value,
      tone: ev.tone,
    });
  }
  return markers;
}

/**
 * One Home-chart marker per completed Acca campaign (net of back + lays),
 * matching the folded series step in `state.ts`.
 */
export function buildAccaCampaignMarkerSources(bets: BetRow[]): LedgerMarkerSource[] {
  const lays = bets.filter(isAccaDeskLay);
  const sources: LedgerMarkerSource[] = [];

  for (const back of bets) {
    if (!isAccaDeskBack(back) || back.status === "open" || back.settledAt == null) continue;
    const runLabel = accaRunLabelFromBack(back);
    if (!runLabel) continue;

    const linked = lays.filter((lay) => isAccaLayForRun(lay, runLabel, back.offerId));
    let profit = 0;
    let time = back.settledAt;
    if (back.status !== "void" && back.actualProfit != null) profit += back.actualProfit;

    for (const lay of linked) {
      if (lay.status === "open" || lay.status === "void" || lay.actualProfit == null) continue;
      profit += lay.actualProfit;
      if (lay.settledAt != null && lay.settledAt > time) time = lay.settledAt;
    }

    const amount = roundPence(profit);
    sources.push({
      id: back.id,
      kind: "bet",
      time,
      amount,
      label: back.label,
      status:
        amount > 0.004 ? "won" : amount < -0.004 ? "lost" : back.status === "void" ? "void" : "push",
      tone: toneFromSignedAmount(amount),
    });
  }

  return sources;
}

/** Settled bets as chart markers (prior-plateau convention). */
export function buildChartBetMarkers(bets: BetRow[]): ChartBetMarker[] {
  return buildPnlChartMarkers([
    ...bets
      .filter((b) => b.status !== "open" && b.settledAt != null)
      .filter((b) => !isDeskCampaignChartBet(b))
      .map((b) => ({
        id: b.id,
        kind: "bet" as const,
        time: b.settledAt ?? b.createdAt,
        amount: b.status !== "void" && b.actualProfit != null ? b.actualProfit : 0,
        label: b.label,
        status: b.status,
        tone: markerToneFromBet(b),
      })),
    ...buildAccaCampaignMarkerSources(bets),
  ]);
}

/**
 * Ensure the plotted series starts at £0 before the first non-zero ledger
 * tip — profit or loss — so the first marker has a plateau to sit on.
 */
export function anchorSeriesAtZero(
  points: LivePnlPoint[],
  nowSec: number
): LivePnlPoint[] {
  if (points.length === 0) return [{ time: nowSec, value: 0 }];
  const first = points[0]!;
  if (Math.abs(first.value) <= 0.004) return points;
  return [{ time: first.time - 1, value: 0 }, ...points];
}

/**
 * Value of the rendered line at a moment - last point at (or strictly before)
 * `timeSec`. Null when the series hasn't started yet.
 */
export function seriesValueAt(
  points: LivePnlPoint[],
  timeSec: number,
  opts?: { before?: boolean }
): number | null {
  let value: number | null = null;
  for (const p of points) {
    if (opts?.before ? p.time < timeSec : p.time <= timeSec) value = p.value;
    else break;
  }
  return value;
}

/**
 * `linePoints` is the series actually drawn (balance adjustments and the
 * gross/retained basis included) - markers are anchored to it so they sit ON
 * the line. The bets-only `cumulativeValue` is the fallback.
 */
function toneFromSignedAmount(amount: number): ChartBetMarkerTone {
  if (amount > 0.004) return "win";
  if (amount < -0.004) return "loss";
  return "neutral";
}

/** P&L-affecting balance adjustments (prior-plateau convention). */
export function buildAdjustmentMarkers(adjustments: PnlAdjustment[]): ChartBetMarker[] {
  return buildPnlChartMarkers(
    adjustments
      .filter((adj) => adj.amount !== 0)
      .map((adj) => ({
        id: adj.id,
        kind: "adjustment" as const,
        time: adj.time,
        amount: adj.amount,
        label: adj.detail?.trim() || "Balance correction",
        status: (adj.amount > 0 ? "won" : "lost") as BetRow["status"],
        tone: toneFromSignedAmount(adj.amount),
      }))
  );
}

/** Completed casino campaigns (prior-plateau convention — same as bets). */
export function buildCasinoMarkers(
  settlements: ChartCasinoSettlement[]
): ChartBetMarker[] {
  return buildPnlChartMarkers(
    settlements.map((c) => ({
      id: c.id,
      kind: "casino" as const,
      time: c.time,
      amount: c.amount,
      label: c.casino?.trim() ? `${c.casino.trim()} · ${c.title}` : c.title,
      status: (c.amount > 0.004
        ? "won"
        : c.amount < -0.004
          ? "lost"
          : "push") as BetRow["status"],
      tone: toneFromSignedAmount(c.amount),
    }))
  );
}

/**
 * Mixed ledger markers for the home chart. Bets, casino and adjustments must
 * be built together so each marker sits on the true prior plateau of the
 * rendered series (not a bets-only or casino-only subsequence).
 */
export function buildHomeChartMarkers(opts: {
  bets: BetRow[];
  adjustments?: PnlAdjustment[];
  casinoSettlements?: ChartCasinoSettlement[];
}): ChartBetMarker[] {
  const events: LedgerMarkerSource[] = [];

  for (const b of opts.bets) {
    if (b.status === "open" || b.settledAt == null) continue;
    // Acca / BB desk: campaign hedges (+ Acca back) fold into one series step.
    if (isDeskCampaignChartBet(b)) continue;
    events.push({
      id: b.id,
      kind: "bet",
      time: b.settledAt ?? b.createdAt,
      amount: b.status !== "void" && b.actualProfit != null ? b.actualProfit : 0,
      label: b.label,
      status: b.status,
      tone: markerToneFromBet(b),
    });
  }

  events.push(...buildAccaCampaignMarkerSources(opts.bets));

  for (const adj of opts.adjustments ?? []) {
    if (adj.amount === 0) continue;
    events.push({
      id: adj.id,
      kind: "adjustment",
      time: adj.time,
      amount: adj.amount,
      label: adj.detail?.trim() || "Balance correction",
      status: adj.amount > 0 ? "won" : "lost",
      tone: toneFromSignedAmount(adj.amount),
    });
  }

  for (const c of opts.casinoSettlements ?? []) {
    events.push({
      id: c.id,
      kind: "casino",
      time: c.time,
      amount: c.amount,
      label: c.casino?.trim() ? `${c.casino.trim()} · ${c.title}` : c.title,
      status: c.amount > 0.004 ? "won" : c.amount < -0.004 ? "lost" : "push",
      tone: toneFromSignedAmount(c.amount),
    });
  }

  return buildPnlChartMarkers(events);
}

/** Hold samples across a window so Liveline cannot spline two distant tips into an arc. */
const WINDOW_LINE_SAMPLES = 240;

/**
 * Rebuild a 24h / week / month series as a sampled staircase: hold the last
 * P&L, then step only at a real tip (or the live total). Liveline's monotone
 * spline arcs between sparse points and its hover lerp does the same, so the
 * hold must be dense.
 *
 * Pass `fillToLeftEdge: false` for All (the full ledger is already dense).
 */
export function ensureWindowLinePoints(
  points: LivePnlPoint[],
  windowSecs: number,
  opts?: {
    nowSec?: number;
    showBadge?: boolean;
    fillToLeftEdge?: boolean;
    liveValue?: number;
  }
): LivePnlPoint[] {
  if (points.length === 0 || windowSecs <= 0) return points;
  if (opts?.fillToLeftEdge === false) return points;
  const nowSec = opts?.nowSec ?? Date.now() / 1000;
  const leftEdge = chartWindowLeftEdge(windowSecs, nowSec, opts?.showBadge ?? false);
  const rightEdge = leftEdge + windowSecs;
  const carry = seriesValueAt(points, leftEdge) ?? points[0]?.value ?? 0;
  const live = opts?.liveValue ?? points.at(-1)?.value ?? carry;
  const tips: LivePnlPoint[] = [];
  for (const p of [...points].sort((a, b) => a.time - b.time)) {
    if (p.time <= leftEdge || p.time > Math.min(rightEdge, nowSec + 0.5)) continue;
    const last = tips.at(-1);
    if (last && Math.abs(last.time - p.time) < 0.05) {
      tips[tips.length - 1] = p;
    } else {
      tips.push(p);
    }
  }

  const leftTime = leftEdge + Math.min(120, Math.max(2, windowSecs * 0.005));
  const sampleEvery = Math.max(30, windowSecs / WINDOW_LINE_SAMPLES);
  const stepped: LivePnlPoint[] = [];
  const push = (time: number, value: number) => {
    const last = stepped.at(-1);
    if (!last) {
      stepped.push({ time, value });
      return;
    }
    if (time < last.time + 0.02) {
      last.time = Math.max(last.time, time);
      last.value = value;
      return;
    }
    if (Math.abs(last.time - time) < 0.05 && last.value === value) return;
    stepped.push({ time, value });
  };

  push(leftTime, carry);
  let cursorT = leftTime;
  let cursorV = carry;
  const events = tips.filter((p) => p.time > leftTime + 0.5);
  if (nowSec > (events.at(-1)?.time ?? leftTime) + 0.5) {
    events.push({ time: nowSec, value: live });
  }

  for (const ev of events) {
    while (cursorT + sampleEvery < ev.time - 1) {
      cursorT += sampleEvery;
      push(cursorT, cursorV);
    }
    if (ev.time > cursorT + 0.5) {
      push(Math.max(cursorT + 0.25, ev.time - 1), cursorV);
    }
    push(ev.time, ev.value);
    cursorT = ev.time;
    cursorV = ev.value;
  }

  return stepped.length >= 2
    ? stepped
    : [
        { time: leftTime, value: carry },
        { time: nowSec, value: live },
      ];
}

/** True when the plotted series has a vertex at this moment (not just a carried plateau). */
export function seriesVertexNear(
  points: LivePnlPoint[],
  timeSec: number,
  slopSec = 2
): boolean {
  for (const p of points) {
    if (Math.abs(p.time - timeSec) <= slopSec) return true;
  }
  return false;
}

/**
 * True when the ledger (not the densified plot line) has a real tip inside
 * the visible window. A 24h carry-forward with no settlements must not light
 * up All-history markers.
 */
export function hasInWindowLedgerTip(
  points: LivePnlPoint[],
  leftEdge: number,
  rightEdge: number
): boolean {
  for (const p of points) {
    if (p.time >= leftEdge - 2 && p.time <= rightEdge) return true;
  }
  return false;
}

/**
 * Liveline only plots from the first in-window series point — not back to
 * `leftEdge`. Markers timed in the gap before that point sit in empty chart
 * space (common on 24h / week / month windows).
 */
export function firstLinePointTimeInWindow(
  points: LivePnlPoint[],
  leftEdge: number,
  rightEdge: number
): number | null {
  let first: number | null = null;
  for (const p of points) {
    if (p.time < leftEdge - 2) continue;
    if (p.time > rightEdge) break;
    if (first === null || p.time < first) first = p.time;
  }
  return first;
}

export function projectBetMarkers(
  markers: ChartBetMarker[],
  layout: PnlChartLayout,
  linePoints?: LivePnlPoint[],
  opts?: { ledgerPoints?: LivePnlPoint[] }
): ProjectedBetMarker[] {
  if (!layout.hasSufficientData) return [];
  const { pad, chartW, chartH, leftEdge, rightEdge, toX, toY } = layout;
  const vertices = opts?.ledgerPoints ?? linePoints;
  if (vertices && !hasInWindowLedgerTip(vertices, leftEdge, rightEdge)) return [];
  const projected: ProjectedBetMarker[] = [];
  const firstDrawnTime = linePoints
    ? firstLinePointTimeInWindow(linePoints, leftEdge, rightEdge)
    : null;

  for (const marker of markers) {
    const eventTimeSec = marker.eventTimeSec ?? marker.settledAtSec;
    // A 24h view must not keep This-week events just because the icon sits on
    // the prior plateau (that time can fall inside a wider leftover series).
    if (eventTimeSec < leftEdge || eventTimeSec > rightEdge) continue;
    if (firstDrawnTime != null && eventTimeSec < firstDrawnTime - 1) continue;
    // Ledger tip only — densified hold samples are not events. The icon sits
    // on the prior plateau, so either time may be the plotted vertex.
    if (
      vertices &&
      !seriesVertexNear(vertices, eventTimeSec) &&
      !seriesVertexNear(vertices, marker.settledAtSec)
    ) {
      continue;
    }
    let plotTime = marker.settledAtSec;
    if (firstDrawnTime != null && plotTime < firstDrawnTime - 1) {
      plotTime = firstDrawnTime;
    }
    if (plotTime < leftEdge || plotTime > rightEdge) continue;
    // Markers are already timed at the prior plateau (or £0 origin). Read the
    // plotted line at that time so they sit ON the same Y Liveline uses.
    const lineValue = linePoints
      ? seriesValueAt(linePoints, plotTime)
      : null;
    if (linePoints && lineValue == null) continue;
    const x = toX(plotTime);
    const y = toY(lineValue ?? marker.cumulativeValue);
    if (x < pad.left - 6 || x > pad.left + chartW + 6) continue;
    if (y < pad.top - 6 || y > pad.top + chartH + 6) continue;
    projected.push({ marker, x, y });
  }

  return projected;
}

/** Whether a history row should appear as a chart annotation for this user. */
export function isChartAnnotationEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (!CHART_ANNOTATION_KINDS.has(entry.kind)) return false;
  // Desk hedge lays are not History / chart narrative while campaigns run.
  if (isDeskCampaignLayHistoryEntry(entry, ctx)) return false;

  // Casino settlements are campaign-level (no bet/event link).
  if (entry.kind === "casino_settlement") return true;

  if (entry.betId != null) return ctx.betsById.has(entry.betId);

  if (entry.eventId != null) {
    for (const bet of ctx.betsById.values()) {
      if (bet.eventId === entry.eventId) return true;
    }
  }

  return false;
}

/** Cumulative settled P&L series — matches `state.ts` ledger steps. */
export function buildSettledPnlSeries(bets: BetRow[]): { timeMs: number; value: number }[] {
  const settled = bets
    .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
    .sort((a, b) => (a.settledAt ?? a.createdAt) - (b.settledAt ?? b.createdAt));

  let running = 0;
  return settled.map((b) => {
    running += b.actualProfit!;
    return { timeMs: b.settledAt ?? b.createdAt, value: Math.round(running * 100) / 100 };
  });
}

export function cumulativeSettledAt(
  series: { timeMs: number; value: number }[],
  timeMs: number
): number {
  let value = 0;
  for (const point of series) {
    if (point.timeMs <= timeMs) value = point.value;
    else break;
  }
  return value;
}

/** P&L strictly before a settlement step (marker sits at the foot of the jump). */
export function cumulativeSettledBefore(
  series: { timeMs: number; value: number }[],
  timeMs: number
): number {
  let value = 0;
  for (const point of series) {
    if (point.timeMs < timeMs) value = point.value;
    else break;
  }
  return value;
}

export function buildChartAnnotations(
  history: HistoryRow[],
  ctx: HistoryContext
): ChartAnnotation[] {
  const settledSeries = buildSettledPnlSeries([...ctx.betsById.values()]);
  const seen = new Set<string>();
  const annotations: ChartAnnotation[] = [];

  for (const entry of history) {
    if (!isChartAnnotationEntry(entry, ctx)) continue;
    if (seen.has(entry.dedupe)) continue;
    seen.add(entry.dedupe);

    const occurredMs = historyOccurredAt(entry, ctx);
    const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
    const promo = entry.betId != null ? ctx.promoByBetId[entry.betId] : undefined;

    const yValue =
      entry.kind === "settlement"
        ? cumulativeSettledBefore(settledSeries, occurredMs)
        : cumulativeSettledAt(settledSeries, occurredMs);

    annotations.push({
      key: entry.dedupe,
      entry,
      timeSec: occurredMs / 1000,
      value: yValue,
      href: historyEntryHref(entry, ctx),
      title: historyEntryTitle(entry, ctx),
      subtitle: historyEntrySubtitle(entry, bet, promo) ?? entry.detail ?? undefined,
      amount: entry.kind === "settlement" ? entry.amount : undefined,
    });
  }

  return annotations.sort((a, b) => a.timeSec - b.timeSec);
}

export function computePnlChartLayout(opts: {
  width: number;
  height: number;
  pad: PnlChartPadding;
  windowSecs: number;
  showBadge: boolean;
  livePoints: LivePnlPoint[];
  liveValue: number;
  nowSec?: number;
  referenceValue?: number;
  /**
   * Last well-computed {min, max} (from a frame with 2+ in-window points).
   * Liveline itself freezes its displayed range rather than recomputing it
   * when a window goes sparse (see `updateRange` early-return in the lib) -
   * mirror that here so markers stay on the same vertical scale as the line
   * instead of jumping to a narrower/mismatched fallback range.
   */
  fallbackRange?: { min: number; max: number };
}): PnlChartLayout | null {
  const {
    width,
    height,
    pad,
    windowSecs,
    showBadge,
    livePoints,
    liveValue,
    referenceValue = 0,
    fallbackRange,
  } = opts;
  const nowSec = opts.nowSec ?? Date.now() / 1000;

  if (livePoints.length < 2 || width <= 0 || height <= 0 || windowSecs <= 0) return null;

  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  if (chartW <= 0 || chartH <= 0) return null;

  const buffer = showBadge ? WINDOW_BUFFER_BADGE : WINDOW_BUFFER_NO_BADGE;
  const rightEdge = nowSec + windowSecs * buffer;
  const leftEdge = rightEdge - windowSecs;

  // Layout is still computed when the window is sparse so callers can keep a
  // fallback range. Liveline itself draws nothing when `visible.length < 2`
  // (blank canvas) — the overlay must not paint markers in that state.
  const visible: LivePnlPoint[] = [];
  for (const p of livePoints) {
    if (p.time >= leftEdge - 2 && p.time <= rightEdge) visible.push(p);
  }

  const hasSufficientData = visible.length >= 2;
  const fallbackStale =
    fallbackRange != null &&
    (fallbackRange.min > referenceValue + 1 || fallbackRange.max < referenceValue - 1);
  const { min: minVal, max: maxVal } =
    !hasSufficientData && fallbackRange && !fallbackStale
      ? fallbackRange
      : computePnlValueRange(visible, liveValue, referenceValue, false);
  const valRange = maxVal - minVal || 1;

  return {
    chartW,
    chartH,
    pad,
    leftEdge,
    rightEdge,
    minVal,
    maxVal,
    valRange,
    hasSufficientData,
    toX: (timeSec) => pad.left + ((timeSec - leftEdge) / (rightEdge - leftEdge)) * chartW,
    toY: (value) => pad.top + (1 - (value - minVal) / valRange) * chartH,
  };
}

export function projectChartAnnotations(
  annotations: ChartAnnotation[],
  layout: PnlChartLayout,
  linePoints?: LivePnlPoint[]
): ProjectedChartAnnotation[] {
  if (!layout.hasSufficientData) return [];
  const { pad, chartW, chartH, leftEdge, rightEdge, toX, toY } = layout;
  const projected: ProjectedChartAnnotation[] = [];

  for (const annotation of annotations) {
    if (annotation.timeSec < leftEdge || annotation.timeSec > rightEdge) continue;
    // Settlement icons sit at the foot of their own jump (strictly before).
    const lineValue = linePoints
      ? seriesValueAt(linePoints, annotation.timeSec, {
          before: annotation.entry.kind === "settlement",
        })
      : null;
    const x = toX(annotation.timeSec);
    const y = toY(lineValue ?? annotation.value);
    if (x < pad.left - 8 || x > pad.left + chartW + 8) continue;
    if (y < pad.top - 8 || y > pad.top + chartH + 8) continue;
    projected.push({ annotation, x, y });
  }

  return spreadOverlappingAnnotations(projected);
}

/** V2 density — nudge markers that share nearly the same x so icons stay readable. */
export function spreadOverlappingAnnotations(
  projected: ProjectedChartAnnotation[],
  minGapPx = 14
): ProjectedChartAnnotation[] {
  if (projected.length < 2) return projected;

  const sorted = [...projected].sort((a, b) => a.x - b.x || a.y - b.y);
  const out: ProjectedChartAnnotation[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const y = current.y;
    const cluster = [current];

    while (
      i + 1 < sorted.length &&
      Math.abs(sorted[i + 1]!.x - current.x) < minGapPx
    ) {
      cluster.push(sorted[++i]!);
    }

    if (cluster.length > 1) {
      const mid = (cluster.length - 1) / 2;
      cluster.forEach((item, idx) => {
        out.push({
          ...item,
          y: item.y + (idx - mid) * minGapPx,
        });
      });
    } else {
      out.push({ ...current, y });
    }
  }

  return out;
}
