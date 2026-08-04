import { roundPence } from "@/lib/calc/money";
import type { BetRow } from "@/lib/db";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";

/**
 * Horse-racing P&L attributed to the local calendar day of the race
 * (`event.startTime`), not when the user entered the result.
 *
 * - Settled bets on today's races → `actualProfit`
 * - Open bets on today's races → worst-case `expectedProfit` (same basis as
 *   homepage provisional), so the figure can move when the result lands
 * - Void / other sports / races on other days → excluded
 */
export function racingPnlToday(
  bets: Array<{
    actualProfit: number | null;
    expectedProfit: number | null;
    status: BetRow["status"];
    eventId: number | null;
  }>,
  events: Array<{ id: number; sport: string; startTime: number }>,
  nowMs: number = Date.now()
): number {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const todayHorseEventIds = new Set(
    events
      .filter(
        (e) =>
          e.sport === "horse_racing" &&
          e.startTime >= dayStart &&
          e.startTime < dayEnd
      )
      .map((e) => e.id)
  );

  let total = 0;
  for (const bet of bets) {
    if (bet.eventId == null || !todayHorseEventIds.has(bet.eventId)) continue;
    if (bet.status === "void") continue;

    if (bet.status === "open") {
      const expected = openBetExpectedProfit(bet);
      if (expected != null) total += expected;
      continue;
    }

    if (bet.actualProfit != null) total += bet.actualProfit;
  }

  return roundPence(total);
}
