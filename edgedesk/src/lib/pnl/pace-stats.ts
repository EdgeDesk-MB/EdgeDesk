import type { BetRow } from "@/lib/db/schema";

export interface PaceStats {
  /** Settled P&L total (excludes open / void). */
  totalProfit: number;
  /** Inclusive calendar days from first settled activity through today (UTC date). */
  dayCount: number;
  /** First settled activity timestamp (ms), or null if none. */
  activityStartMs: number | null;
  /** totalProfit / dayCount. */
  dailyAvg: number;
  /** dailyAvg × 365. */
  yearlyEst: number;
  settledBetCount: number;
}

function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isSettledBet(bet: BetRow): boolean {
  return bet.status !== "void" && bet.status !== "open" && bet.actualProfit != null;
}

/**
 * Daily average = settled profit ÷ calendar days since first settled bet (through today).
 * Yearly estimate = daily average × 365.
 */
export function computePaceStats(bets: BetRow[], nowMs = Date.now()): PaceStats {
  const settled = bets.filter(isSettledBet);
  if (settled.length === 0) {
    return {
      totalProfit: 0,
      dayCount: 0,
      activityStartMs: null,
      dailyAvg: 0,
      yearlyEst: 0,
      settledBetCount: 0,
    };
  }

  let totalProfit = 0;
  let earliest = Infinity;
  for (const bet of settled) {
    totalProfit += bet.actualProfit ?? 0;
    const ts = bet.settledAt ?? bet.createdAt;
    if (ts < earliest) earliest = ts;
  }

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
    settledBetCount: settled.length,
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
