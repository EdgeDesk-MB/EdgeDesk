/** Rough place-lay seed when exchange PLACE prices are not available. */
export function estimateLayPlaceOdds(winOdds: number, placeFraction: number): number {
  if (!(winOdds > 1) || !(placeFraction > 0 && placeFraction < 1)) return 2.8;
  const fair = 1 + (winOdds - 1) * placeFraction;
  return Math.round(fair * 1.08 * 100) / 100;
}
