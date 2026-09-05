/**
 * Feed monitor logic (admin → Feed health). Pure functions so thresholds,
 * pace projection and series filling are unit-tested without a database.
 *
 * Threshold model: ok below 70% of cap, warning 70–90%, critical at/above 90%.
 * The point of the monitor is to give the operator time to upgrade the
 * provider plan BEFORE the cap is hit, so warning is deliberately early.
 */

export type FeedThresholdState = "ok" | "warning" | "critical";

export const FEED_WARNING_RATIO = 0.7;
export const FEED_CRITICAL_RATIO = 0.9;

export function feedThresholdState(used: number, cap: number): FeedThresholdState {
  if (cap <= 0) return "critical";
  const ratio = used / cap;
  if (ratio >= FEED_CRITICAL_RATIO) return "critical";
  if (ratio >= FEED_WARNING_RATIO) return "warning";
  return "ok";
}

export type FeedPace = {
  /** Linear end-of-day projection from today's usage rate so far. */
  projected: number;
  /**
   * Epoch ms when the cap is reached at the current rate, or null when the
   * rate is zero / the cap is not projected to be reached today. Already
   * over cap returns the start of the current window (i.e. "now-ish").
   */
  capReachedAt: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Linear pace projection over the UTC day. Early in the day tiny usage
 * produces absurd projections, so pace only counts once 5% of the day
 * (~72 min) has elapsed; before that we report the raw count as projection.
 */
export function projectDailyPace(
  used: number,
  cap: number,
  now: Date = new Date()
): FeedPace {
  const dayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const elapsed = Math.max(0, now.getTime() - dayStart);
  const minElapsed = DAY_MS * 0.05;

  if (used <= 0) return { projected: 0, capReachedAt: null };
  if (used >= cap) return { projected: used, capReachedAt: now.getTime() };
  if (elapsed < minElapsed) return { projected: used, capReachedAt: null };

  const rate = used / elapsed; // requests per ms
  const projected = Math.round(rate * DAY_MS);
  const remaining = cap - used;
  const capReachedAt =
    projected > cap ? now.getTime() + remaining / rate : null;
  return { projected, capReachedAt };
}

export type FeedUsageDayPoint = { day: string; used: number };

/**
 * Fill missing days with zero so the chart shows quiet days honestly instead
 * of skipping them. Returns oldest-first, ending at `now`'s UTC day.
 */
export function fillDailySeries(
  rows: FeedUsageDayPoint[],
  days: number,
  now: Date = new Date()
): FeedUsageDayPoint[] {
  const byDay = new Map(rows.map((row) => [row.day, row.used]));
  const series: FeedUsageDayPoint[] = [];
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today - i * DAY_MS).toISOString().slice(0, 10);
    series.push({ day, used: byDay.get(day) ?? 0 });
  }
  return series;
}

export const FEED_STATE_LABEL: Record<FeedThresholdState, string> = {
  ok: "Healthy",
  warning: "Watch",
  critical: "Upgrade soon",
};

export const FEED_STATE_DESCRIPTION: Record<FeedThresholdState, string> = {
  ok: "Well within today's cap.",
  warning: "Over 70% of today's cap, plan a provider upgrade.",
  critical: "Over 90% of today's cap, upgrade the provider plan now.",
};

/** One grouped row from feed_usage_events (feed, actor, operation, count). */
export type FeedUsageAttributionInput = {
  feed: "football" | "racing";
  clerkUserId: string | null;
  email: string | null;
  operation: string;
  count: number;
};

export type FeedSourceSpend = {
  /** clerk user id, or "system" for poller / feed-sync spend. */
  key: string;
  label: string;
  isSystem: boolean;
  total: number;
  football: number;
  racing: number;
  /** Most-spent operations first. */
  operations: Array<{
    feed: "football" | "racing";
    operation: string;
    count: number;
  }>;
};

export const FEED_OPERATION_LABEL: Record<string, string> = {
  "fixtures-by-date": "Fixture browsing",
  "live-fixtures": "Live scores poll",
  "fixture-by-id": "Fixture lookup",
  "goal-events": "Goal events",
  "match-events": "Match events",
  lineups: "Lineups",
  "racecards-free": "Racecards (free)",
  "racecards-standard": "Racecards (standard)",
  results: "Results",
  odds: "Odds",
  other: "Other",
};

export function feedOperationLabel(operation: string): string {
  return FEED_OPERATION_LABEL[operation] ?? "Other";
}

/**
 * Roll grouped attribution rows up to one row per source (user or system).
 * Highest spend first; on a tie the system row sorts last, because the
 * operator's question is "which user is spending?".
 */
export function groupFeedUsageBySource(
  rows: FeedUsageAttributionInput[]
): FeedSourceSpend[] {
  const bySource = new Map<string, FeedSourceSpend>();
  for (const row of rows) {
    const key = row.clerkUserId ?? "system";
    let source = bySource.get(key);
    if (!source) {
      source = {
        key,
        label:
          row.email ??
          (row.clerkUserId ? `User …${row.clerkUserId.slice(-6)}` : "System / poller"),
        isSystem: row.clerkUserId == null,
        total: 0,
        football: 0,
        racing: 0,
        operations: [],
      };
      bySource.set(key, source);
    }
    source.total += row.count;
    source[row.feed] += row.count;
    source.operations.push({
      feed: row.feed,
      operation: row.operation,
      count: row.count,
    });
  }
  const sources = [...bySource.values()];
  for (const source of sources) {
    source.operations.sort((a, b) => b.count - a.count);
  }
  return sources.sort(
    (a, b) => b.total - a.total || Number(a.isSystem) - Number(b.isSystem)
  );
}
