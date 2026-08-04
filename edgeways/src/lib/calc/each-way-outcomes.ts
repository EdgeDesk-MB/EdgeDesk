/**
 * Shared each-way / extra-place outcome maths - bookie EW back vs separate win & place lays.
 */

export type EachWayRaceOutcome = "win" | "standard_place" | "extra_place" | "unplaced";

export interface EachWayLayInput {
  /** Stake on each half of the EW back (total outlay = 2 × stakePerPart) */
  stakePerPart: number;
  winOdds: number;
  /** Place terms as fraction of (winOdds - 1), e.g. 0.2 for 1/5 */
  placeFraction: number;
  layWinStake: number;
  layWinOdds: number;
  layPlaceStake: number;
  layPlaceOdds: number;
  commission: number;
}

export function placeOddsFromTerms(winOdds: number, placeFraction: number): number {
  return 1 + (winOdds - 1) * placeFraction;
}

export function classifyEachWayFinish(
  position: number,
  bookiePlaces: number,
  exchangePlaces: number
): EachWayRaceOutcome {
  if (position <= 0) return "unplaced";
  if (position === 1) return "win";
  if (position <= exchangePlaces) return "standard_place";
  if (position <= bookiePlaces) return "extra_place";
  return "unplaced";
}

/** Bookie + exchange P&L for one settlement scenario. */
export function eachWayOutcomePnL(
  input: EachWayLayInput,
  outcome: EachWayRaceOutcome
): { bookie: number; exchange: number; total: number } {
  const {
    stakePerPart: stake,
    winOdds,
    placeFraction,
    layWinStake,
    layWinOdds,
    layPlaceStake,
    layPlaceOdds,
    commission: c,
  } = input;
  const placeOdds = placeOddsFromTerms(winOdds, placeFraction);
  const layWinLiability = layWinStake * (layWinOdds - 1);
  const layPlaceLiability = layPlaceStake * (layPlaceOdds - 1);
  const layWinWinnings = layWinStake * (1 - c);
  const layPlaceWinnings = layPlaceStake * (1 - c);

  switch (outcome) {
    case "win":
      return {
        bookie: stake * (winOdds - 1) + stake * (placeOdds - 1),
        exchange: -layWinLiability - layPlaceLiability,
        total:
          stake * (winOdds - 1) +
          stake * (placeOdds - 1) -
          layWinLiability -
          layPlaceLiability,
      };
    case "standard_place":
      return {
        bookie: -stake + stake * (placeOdds - 1),
        exchange: layWinWinnings - layPlaceLiability,
        total: -stake + stake * (placeOdds - 1) + layWinWinnings - layPlaceLiability,
      };
    case "extra_place":
      return {
        bookie: -stake + stake * (placeOdds - 1),
        exchange: layWinWinnings + layPlaceWinnings,
        total: -stake + stake * (placeOdds - 1) + layWinWinnings + layPlaceWinnings,
      };
    case "unplaced":
      return {
        bookie: -2 * stake,
        exchange: layWinWinnings + layPlaceWinnings,
        total: -2 * stake + layWinWinnings + layPlaceWinnings,
      };
  }
}

/** Lay stakes using standard matched each-way formulas (MBB / exchange place market). */
export function eachWayLayStakes(input: {
  stakePerPart: number;
  winOdds: number;
  placeFraction: number;
  layWinOdds: number;
  layPlaceOdds: number;
  commission: number;
}): {
  placeOdds: number;
  layWinStake: number;
  layWinLiability: number;
  layPlaceStake: number;
  layPlaceLiability: number;
} {
  const { stakePerPart, winOdds, placeFraction, layWinOdds, layPlaceOdds, commission: c } = input;
  const placeOdds = placeOddsFromTerms(winOdds, placeFraction);
  const layWinStake = (stakePerPart * winOdds) / (layWinOdds - c);
  const layPlaceStake = (stakePerPart * placeOdds) / (layPlaceOdds - c);
  return {
    placeOdds,
    layWinStake,
    layWinLiability: layWinStake * (layWinOdds - 1),
    layPlaceStake,
    layPlaceLiability: layPlaceStake * (layPlaceOdds - 1),
  };
}
