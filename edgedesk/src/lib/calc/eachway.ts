/**
 * Each Way matched calculator: an EW back bet is a win bet + a place bet.
 * Lay both parts separately on the exchange.
 */

import {
  eachWayLayStakes,
  eachWayOutcomePnL,
  placeOddsFromTerms,
} from "./each-way-outcomes";

export interface EachWayInput {
  /** Stake per part: an EW bet of `stake` costs 2 x stake in total */
  stake: number;
  winOdds: number;
  /** Place terms as a fraction of (winOdds - 1), e.g. 0.2 for 1/5 */
  placeFraction: number;
  layWinOdds: number;
  layPlaceOdds: number;
  commission: number;
}

export interface EachWayResult {
  placeOdds: number;
  layWinStake: number;
  layWinLiability: number;
  layPlaceStake: number;
  layPlaceLiability: number;
  totalOutlay: number;
  profitIfWins: number;
  profitIfPlacesOnly: number;
  profitIfUnplaced: number;
  worstCase: number;
}

export function eachWay(input: EachWayInput): EachWayResult {
  const lays = eachWayLayStakes({
    stakePerPart: input.stake,
    winOdds: input.winOdds,
    placeFraction: input.placeFraction,
    layWinOdds: input.layWinOdds,
    layPlaceOdds: input.layPlaceOdds,
    commission: input.commission,
  });

  const layInput = {
    stakePerPart: input.stake,
    winOdds: input.winOdds,
    placeFraction: input.placeFraction,
    layWinStake: lays.layWinStake,
    layWinOdds: input.layWinOdds,
    layPlaceStake: lays.layPlaceStake,
    layPlaceOdds: input.layPlaceOdds,
    commission: input.commission,
  };

  const profitIfWins = eachWayOutcomePnL(layInput, "win").total;
  const profitIfPlacesOnly = eachWayOutcomePnL(layInput, "standard_place").total;
  const profitIfUnplaced = eachWayOutcomePnL(layInput, "unplaced").total;

  return {
    ...lays,
    totalOutlay: input.stake * 2,
    profitIfWins,
    profitIfPlacesOnly,
    profitIfUnplaced,
    worstCase: Math.min(profitIfWins, profitIfPlacesOnly, profitIfUnplaced),
  };
}

export { placeOddsFromTerms };
