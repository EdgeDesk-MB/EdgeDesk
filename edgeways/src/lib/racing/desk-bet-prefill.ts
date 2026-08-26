import { estimateLayPlaceOdds } from "@/lib/calc/estimate-lay-place-odds";

/** Bookie / exchange prices from a Racing Desk runner row. */
export type DeskRunnerPriceInput = {
  bookieDecimal?: number | null;
  spDecimal?: number | null;
  exchangeDecimal?: number | null;
};

/** Bookie win first, then SP, then a conservative default. */
export function deskRunnerWinOdds(runner: DeskRunnerPriceInput, fallback = 8): number {
  const bookie = runner.bookieDecimal;
  if (bookie != null && bookie > 1) return bookie;
  const sp = runner.spDecimal;
  if (sp != null && sp > 1) return sp;
  return fallback;
}

/**
 * Live exchange lay when the desk row has one; otherwise bookie + 3%
 * (same estimate the Exchange column shows as "est. +3%").
 */
export function deskRunnerLayWinOdds(runner: DeskRunnerPriceInput, winOdds: number): number {
  const exchange = runner.exchangeDecimal;
  if (exchange != null && exchange > 1) return exchange;
  return winOdds * 1.03;
}

/**
 * Win + place lays to seed Add bet / matched / each-way from a desk row.
 * Place uses the exchange win lay (not the bookie) so both markets track
 * the same Exchange column until a live PLACE feed exists.
 */
export function deskRunnerLayPrices(
  runner: DeskRunnerPriceInput,
  placeFraction: number
): { winOdds: number; layWinOdds: number; layPlaceOdds: number } {
  const winOdds = deskRunnerWinOdds(runner);
  const layWinOdds = deskRunnerLayWinOdds(runner, winOdds);
  return {
    winOdds,
    layWinOdds,
    layPlaceOdds: estimateLayPlaceOdds(layWinOdds, placeFraction),
  };
}
