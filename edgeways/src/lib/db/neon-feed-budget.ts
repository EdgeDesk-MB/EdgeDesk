/**
 * Durable per-feed daily counters (EDGE-81c, generalised for the feed monitor).
 *
 * The in-memory counter in `services/apifootball.ts` is per serverless
 * instance, so the real cap used to be instance-count x DAILY_BUDGET. This
 * increments and checks in ONE statement: the `WHERE feed_budget.used < budget`
 * guard on the conflict branch means an over-cap attempt returns no row (denied)
 * and does not inflate the counter further.
 *
 * Football and racing both spend through `spendNeonFeedBudget` (hard cap,
 * EDGE-100). `recordNeonFeedUsage` remains for any future feed whose real
 * constraint is rate, not volume.
 *
 * `feed_budget` is global coordination data — no clerk scoping.
 */
import "server-only";

import { getDeskActor } from "@/lib/db/desk-scope";
import { getNeonSql } from "@/lib/db/neon";

export type FeedKind = "football" | "racing";

export const FEED_BUDGET_SPEND_SQL = `
INSERT INTO feed_budget (feed, day, used)
VALUES ($1, $2, 1)
ON CONFLICT (feed, day) DO UPDATE
   SET used = feed_budget.used + 1
 WHERE feed_budget.used < $3
RETURNING used
`.trim();

/** Uncapped increment for feeds whose real constraint is rate, not volume. */
export const FEED_USAGE_RECORD_SQL = `
INSERT INTO feed_budget (feed, day, used)
VALUES ($1, $2, 1)
ON CONFLICT (feed, day) DO UPDATE
   SET used = feed_budget.used + 1
RETURNING used
`.trim();

/** UTC calendar day, matching the in-memory counter's key. */
export function feedBudgetDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Atomically claim one request. Returns the new usage when allowed, or null
 * when the day is already at the cap.
 */
export async function spendNeonFeedBudget(
  budget: number,
  day = feedBudgetDay(),
  feed: FeedKind = "football"
): Promise<number | null> {
  const sql = getNeonSql();
  const rows = (await sql.query(FEED_BUDGET_SPEND_SQL, [feed, day, budget])) as Array<{
    used: string | number;
  }>;
  const used = rows[0]?.used;
  return used == null ? null : Number(used);
}

/** Count one request with no cap. Returns the new usage. */
export async function recordNeonFeedUsage(
  feed: FeedKind,
  day = feedBudgetDay()
): Promise<number | null> {
  const sql = getNeonSql();
  const rows = (await sql.query(FEED_USAGE_RECORD_SQL, [feed, day])) as Array<{
    used: string | number;
  }>;
  const used = rows[0]?.used;
  return used == null ? null : Number(used);
}

export async function neonFeedBudgetUsed(
  day = feedBudgetDay(),
  feed: FeedKind = "football"
): Promise<number> {
  const sql = getNeonSql();
  const rows = (await sql.query(
    `SELECT used FROM feed_budget WHERE feed = $1 AND day = $2`,
    [feed, day]
  )) as Array<{ used: string | number }>;
  return Number(rows[0]?.used ?? 0);
}

export type FeedUsageDay = { day: string; used: number };

/** Newest-first raw rows for the admin usage chart (gaps filled by the caller). */
export async function neonFeedUsageHistory(
  feed: FeedKind,
  days: number
): Promise<FeedUsageDay[]> {
  const sql = getNeonSql();
  const rows = (await sql.query(
    `SELECT day, used FROM feed_budget
      WHERE feed = $1
      ORDER BY day DESC
      LIMIT $2`,
    [feed, days]
  )) as Array<{ day: string; used: string | number }>;
  return rows.map((row) => ({ day: row.day, used: Number(row.used) }));
}

export const FEED_USAGE_EVENT_INSERT_SQL = `
INSERT INTO feed_usage_events (feed, day, at, operation, clerk_user_id, email)
VALUES ($1, $2, $3, $4, $5, $6)
`.trim();

/**
 * Attribute one spent request to the current desk actor (null id = system
 * spend: poller, feed sync). Best-effort by design — attribution must never
 * block or fail a feed call, so errors are swallowed.
 */
export async function logFeedUsageEvent(
  feed: FeedKind,
  operation: string,
  day = feedBudgetDay()
): Promise<void> {
  try {
    const actor = getDeskActor();
    const sql = getNeonSql();
    await sql.query(FEED_USAGE_EVENT_INSERT_SQL, [
      feed,
      day,
      Date.now(),
      operation,
      actor.clerkUserId,
      actor.email,
    ]);
  } catch {
    // swallow: see docstring
  }
}

export type FeedUsageAttributionRow = {
  feed: FeedKind;
  clerkUserId: string | null;
  email: string | null;
  operation: string;
  count: number;
};

/** Today's spend grouped by actor and operation, for the admin feed monitor. */
export async function neonFeedUsageAttribution(
  day = feedBudgetDay()
): Promise<FeedUsageAttributionRow[]> {
  const sql = getNeonSql();
  const rows = (await sql.query(
    `SELECT feed, clerk_user_id, email, operation, COUNT(*)::int AS count
       FROM feed_usage_events
      WHERE day = $1
      GROUP BY feed, clerk_user_id, email, operation`,
    [day]
  )) as Array<{
    feed: string;
    clerk_user_id: string | null;
    email: string | null;
    operation: string;
    count: string | number;
  }>;
  return rows.map((row) => ({
    feed: row.feed === "racing" ? "racing" : "football",
    clerkUserId: row.clerk_user_id,
    email: row.email,
    operation: row.operation,
    count: Number(row.count),
  }));
}
