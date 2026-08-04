import type { BetRow } from "@/lib/db/schema";
import { roundPence } from "@/lib/calc/money";

/** Extra settled income (casino campaigns, affectPnl adjustments). */
export type PaceIncomePoint = {
  time: number;
  amount: number;
};

export interface PaceStats {
  /** Settled P&L total across bets, casino, and P&L adjustments. */
  totalProfit: number;
  /** Inclusive calendar days from first settled activity through today (UTC date). */
  dayCount: number;
  /** First settled activity timestamp (ms), or null if none. */
  activityStartMs: number | null;
  /** totalProfit / dayCount. */
  dailyAvg: number;
  /** dailyAvg × 365. */
  yearlyEst: number;
  /** Settled bets + casino settlements + P&L adjustments. */
  settlementCount: number;
}

function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isSettledBet(bet: BetRow): boolean {
  return bet.status !== "void" && bet.status !== "open" && bet.actualProfit != null;
}

/**
 * Daily average = settled profit ÷ calendar days since first settled activity
 * (bets including boosts, casino campaigns, and affectPnl adjustments) through today.
 * Yearly estimate = daily average × 365.
 */
export function computePaceStats(
  bets: BetRow[],
  otherIncome: PaceIncomePoint[] = [],
  nowMs = Date.now()
): PaceStats {
  let totalProfit = 0;
  let earliest = Infinity;
  let settlementCount = 0;

  for (const bet of bets) {
    if (!isSettledBet(bet)) continue;
    totalProfit += bet.actualProfit ?? 0;
    settlementCount += 1;
    const ts = bet.settledAt ?? bet.createdAt;
    if (ts < earliest) earliest = ts;
  }

  for (const point of otherIncome) {
    totalProfit += point.amount;
    settlementCount += 1;
    if (point.time < earliest) earliest = point.time;
  }

  if (settlementCount === 0) {
    return {
      totalProfit: 0,
      dayCount: 0,
      activityStartMs: null,
      dailyAvg: 0,
      yearlyEst: 0,
      settlementCount: 0,
    };
  }

  totalProfit = roundPence(totalProfit);
  const startDay = utcDayStart(earliest);
  const todayDay = utcDayStart(nowMs);
  const dayCount = Math.max(1, Math.floor((todayDay - startDay) / 86_400_000) + 1);
  const dailyAvg = totalProfit / dayCount;
  const yearlyEst = dailyAvg * 365;

  return {
    totalProfit,
    dayCount,
    activityStartMs: earliest,
    dailyAvg,
    yearlyEst,
    settlementCount,
  };
}

export function formatPaceDayCount(dayCount: number): string {
  if (dayCount <= 0) return "No settled activity";
  if (dayCount === 1) return "1 day";
  return `${dayCount.toLocaleString("en-GB")} days`;
}

export function formatActivitySince(ms: number | null): string {
  if (ms == null) return "-";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
