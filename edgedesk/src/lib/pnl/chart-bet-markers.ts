import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  historyEntryHref,
  historyEntrySubtitle,
  historyEntryTitle,
  historyOccurredAt,
  type HistoryContext,
} from "@/lib/history-display";

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

const WINDOW_BUFFER_BADGE = 0.05;
const WINDOW_BUFFER_NO_BADGE = 0.015;

export type ChartBetMarkerTone = "win" | "loss" | "neutral";

export interface ChartBetMarker {
  id: number;
  label: string;
  status: BetRow["status"];
  settledAtSec: number;
  betProfit: number;
  cumulativeValue: number;
  tone: ChartBetMarkerTone;
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

/** Settled bets — marker i is drawn at the prior settlement's line point (first omitted). */
export function buildChartBetMarkers(bets: BetRow[]): ChartBetMarker[] {
  const settled = bets
    .filter((b) => b.status !== "open" && b.settledAt != null)
    .sort((a, b) => (a.settledAt ?? 0) - (b.settledAt ?? 0));

  if (settled.length < 2) return [];

  let running = 0;
  const plotPoints: { timeSec: number; value: number }[] = [];

  for (const bet of settled) {
    if (bet.status !== "void" && bet.actualProfit != null) {
      running += bet.actualProfit;
    }
    plotPoints.push({
      timeSec: (bet.settledAt ?? bet.createdAt) / 1000,
      value: Math.round(running * 100) / 100,
    });
  }

  const markers: ChartBetMarker[] = [];

  for (let i = 1; i < settled.length; i++) {
    const bet = settled[i]!;
    const plot = plotPoints[i - 1]!;
    markers.push({
      id: bet.id,
      label: bet.label,
      status: bet.status,
      settledAtSec: plot.timeSec,
      betProfit: bet.actualProfit ?? 0,
      cumulativeValue: plot.value,
      tone: markerToneFromBet(bet),
    });
  }

  return markers;
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
export function projectBetMarkers(
  markers: ChartBetMarker[],
  layout: PnlChartLayout,
  linePoints?: LivePnlPoint[]
): ProjectedBetMarker[] {
  const { pad, chartW, chartH, leftEdge, rightEdge, toX, toY } = layout;
  const projected: ProjectedBetMarker[] = [];

  for (const marker of markers) {
    if (marker.settledAtSec < leftEdge || marker.settledAtSec > rightEdge) continue;
    const lineValue = linePoints ? seriesValueAt(linePoints, marker.settledAtSec) : null;
    const x = toX(marker.settledAtSec);
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
  } = opts;
  const nowSec = opts.nowSec ?? Date.now() / 1000;

  if (livePoints.length < 2 || width <= 0 || height <= 0 || windowSecs <= 0) return null;

  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  if (chartW <= 0 || chartH <= 0) return null;

  const buffer = showBadge ? WINDOW_BUFFER_BADGE : WINDOW_BUFFER_NO_BADGE;
  const rightEdge = nowSec + windowSecs * buffer;
  const leftEdge = rightEdge - windowSecs;

  const visible: LivePnlPoint[] = [];
  for (const p of livePoints) {
    if (p.time >= leftEdge - 2 && p.time <= rightEdge) visible.push(p);
  }
  if (visible.length < 2) return null;

  const { min: minVal, max: maxVal } = computePnlValueRange(
    visible,
    liveValue,
    referenceValue,
    false
  );
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
    toX: (timeSec) => pad.left + ((timeSec - leftEdge) / (rightEdge - leftEdge)) * chartW,
    toY: (value) => pad.top + (1 - (value - minVal) / valRange) * chartH,
  };
}

export function projectChartAnnotations(
  annotations: ChartAnnotation[],
  layout: PnlChartLayout,
  linePoints?: LivePnlPoint[]
): ProjectedChartAnnotation[] {
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
