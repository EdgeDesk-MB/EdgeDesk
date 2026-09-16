import { inferSportFromBet, isAutoSettleMarket } from "@/lib/markets";

/**
 * Same gate as Profit Tracker: hide Set result when a result-centric path
 * exists (race placings, or a linked auto-settle market).
 */
export function canManualSettleBet(
  bet: { status: string; market: string; sport?: string | null },
  event?: { sport?: string | null } | null,
  offerSport?: string | null
): boolean {
  if (bet.status !== "open") return false;
  if (event?.sport === "horse_racing") return false;
  const sport = inferSportFromBet(
    bet.market,
    event?.sport,
    offerSport,
    bet.sport
  );
  return !event || !isAutoSettleMarket(sport, bet.market);
}
