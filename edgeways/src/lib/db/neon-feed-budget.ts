/**
 * Durable API-Football daily budget (EDGE-81c).
 *
 * The in-memory counter in `services/apifootball.ts` is per serverless
 * instance, so the real cap used to be instance-count x DAILY_BUDGET. This
 * increments and checks in ONE statement: the `WHERE feed_budget.used < budget`
 * guard on the conflict branch means an over-cap attempt returns no row (denied)
 * and does not inflate the counter further.
 *
 * `feed_budget` is global coordination data — no clerk scoping.
 */
import "server-only";

import { getNeonSql } from "@/lib/db/neon";

export const FEED_BUDGET_SPEND_SQL = `
INSERT INTO feed_budget (day, used)
VALUES ($1, 1)
ON CONFLICT (day) DO UPDATE
   SET used = feed_budget.used + 1
 WHERE feed_budget.used < $2
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
  day = feedBudgetDay()
): Promise<number | null> {
  const sql = getNeonSql();
  const rows = (await sql.query(FEED_BUDGET_SPEND_SQL, [day, budget])) as Array<{
    used: string | number;
  }>;
  const used = rows[0]?.used;
  return used == null ? null : Number(used);
}

export async function neonFeedBudgetUsed(day = feedBudgetDay()): Promise<number> {
  const sql = getNeonSql();
  const rows = (await sql.query(
    `SELECT used FROM feed_budget WHERE day = $1`,
    [day]
  )) as Array<{ used: string | number }>;
  return Number(rows[0]?.used ?? 0);
}
