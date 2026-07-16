/**
 * Mug-bet cadence planning (J5) - account longevity is half the game.
 * A plan says "place a camouflage bet at this bookie at least every N
 * days, within £X a month". Due-ness and month cost are pure functions;
 * the money stays REAL (bankroll, net P&L) but is excluded from every
 * edge metric - camouflage is a deliberate expense, not lost edge.
 */

import { roundPence } from "@/lib/calc/money";
import type { BetRow, MugPlanRow } from "@/lib/db/schema";

const DAY_MS = 86_400_000;

export interface MugDueState {
  due: boolean;
  /** Days since the last mug bet; null = never placed one */
  daysSince: number | null;
  /** Days until next due (negative = overdue) */
  daysUntilDue: number;
}

export function mugDue(
  plan: Pick<MugPlanRow, "cadenceDays" | "lastMugAt">,
  now: number
): MugDueState {
  if (plan.lastMugAt == null) {
    // Never mugged: due immediately.
    return { due: true, daysSince: null, daysUntilDue: 0 };
  }
  const daysSince = (now - plan.lastMugAt) / DAY_MS;
  const daysUntilDue = plan.cadenceDays - daysSince;
  return { due: daysUntilDue <= 0, daysSince, daysUntilDue };
}

export function isMugBet(bet: Pick<BetRow, "purpose">): boolean {
  return bet.purpose === "mug";
}

/**
 * Net £ from SETTLED mug bets at a bookie in the calendar month of `now`
 * (local time). Usually negative - it is the camouflage cost line.
 */
export function mugNetThisMonth(
  bets: Array<{
    purpose: string | null;
    bookmaker: string | null;
    actualProfit: number | null;
    settledAt: number | null;
    status: string;
  }>,
  bookmaker: string,
  now: number
): number {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const monthStart = start.getTime();
  return roundPence(
    bets
      .filter(
        (b) =>
          b.purpose === "mug" &&
          b.bookmaker === bookmaker &&
          b.actualProfit != null &&
          b.settledAt != null &&
          b.settledAt >= monthStart &&
          b.status !== "open" &&
          b.status !== "void"
      )
      .reduce((a, b) => a + (b.actualProfit ?? 0), 0)
  );
}
