import {
  fillDailySeries,
  type FeedUsageDayPoint,
} from "@/lib/admin/feed-monitor";

export type DayCount = FeedUsageDayPoint;

export type AdminChartTone =
  | "brand"
  | "edge"
  | "muted"
  | "warning"
  | "success"
  | "destructive"
  | "profit";

export type ShareSlice = {
  key: string;
  label: string;
  value: number;
  tone: AdminChartTone;
};

export type PeriodCompare = {
  current: number;
  previous: number;
  delta: number;
  /** Null when the previous window is zero and the current window is not. */
  pct: number | null;
};

export type ComparePeriod = "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDayKeyFromMs(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → "14 Aug". UTC-safe: never Date.parse a date-only string. */
export function formatUtcDayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function dailyCountsFromEpochs(
  epochs: number[],
  days: number,
  now: Date = new Date()
): DayCount[] {
  const byDay = new Map<string, number>();
  for (const ms of epochs) {
    const day = utcDayKeyFromMs(ms);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return fillDailySeries(
    [...byDay.entries()].map(([day, used]) => ({ day, used })),
    days,
    now
  );
}

export function dailySumsFromEpochValues(
  points: Array<{ at: number; value: number }>,
  days: number,
  now: Date = new Date()
): DayCount[] {
  const byDay = new Map<string, number>();
  for (const point of points) {
    const day = utcDayKeyFromMs(point.at);
    if (!day || !Number.isFinite(point.value)) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + point.value);
  }
  return fillDailySeries(
    [...byDay.entries()].map(([day, used]) => ({ day, used })),
    days,
    now
  );
}

export function lastDays(series: DayCount[], days: number): DayCount[] {
  return series.slice(-days);
}

export function sumSeries(series: DayCount[]): number {
  return series.reduce((sum, point) => sum + point.used, 0);
}

/**
 * Compare the last `window` days with the `window` days before that.
 * Pass a series at least `window * 2` long so the previous period is real.
 */
export function compareTrailingWindows(
  series: DayCount[],
  window: number
): PeriodCompare {
  const current = sumSeries(series.slice(-window));
  const previous = sumSeries(series.slice(-window * 2, -window));
  const delta = current - previous;
  const pct = previous === 0 ? (current === 0 ? 0 : null) : (delta / previous) * 100;
  return { current, previous, delta, pct };
}

export function cumulativeSeries(series: DayCount[]): DayCount[] {
  let total = 0;
  return series.map((point) => {
    total += point.used;
    return { day: point.day, used: total };
  });
}

export function formatPeriodDelta(
  compare: PeriodCompare,
  period: ComparePeriod
): string {
  const noun = period === "week" ? "week" : "month";
  if (compare.current === 0 && compare.previous === 0) {
    return `Level vs last ${noun}`;
  }
  if (compare.previous === 0) {
    return "Up from none";
  }
  if (compare.delta === 0) {
    return `Level vs last ${noun}`;
  }
  const pct = Math.round(Math.abs(compare.pct ?? 0));
  return compare.delta > 0
    ? `Up ${pct}% vs last ${noun}`
    : `Down ${pct}% vs last ${noun}`;
}

export function shareSlices(
  items: Array<{
    key: string;
    label: string;
    value: number;
    tone: AdminChartTone;
  }>
): ShareSlice[] {
  return items.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0,
  }));
}

export function rankShare(
  items: Array<{ key: string; label: string; value: number }>,
  tones: AdminChartTone[],
  limit = 8
): ShareSlice[] {
  const sorted = [...items]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const other = rest.reduce((sum, item) => sum + item.value, 0);
  const slices: ShareSlice[] = head.map((item, index) => ({
    key: item.key,
    label: item.label,
    value: item.value,
    tone: tones[index % tones.length] ?? "muted",
  }));
  if (other > 0) {
    slices.push({
      key: "other",
      label: "Other",
      value: other,
      tone: "muted",
    });
  }
  return slices;
}

export function shareTotal(slices: ShareSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0);
}

export const SERIES_WINDOW_DAYS = 30;
export const SERIES_COMPARE_DAYS = 60;
