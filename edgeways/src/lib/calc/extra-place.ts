/**
 * Extra place offers - bookie pays more places than the exchange place market.
 * Lay stakes match standard each-way; profit lands when the horse finishes in the extra zone.
 */

import {
  eachWayLayStakes,
  eachWayOutcomePnL,
  type EachWayRaceOutcome,
} from "./each-way-outcomes";

export interface ExtraPlaceInput {
  stakePerPart: number;
  winOdds: number;
  placeFraction: number;
  layWinOdds: number;
  layPlaceOdds: number;
  commission: number;
  /** Places paid by the bookie EW offer (e.g. 4) */
  bookiePlaces: number;
  /** Places paid by the exchange place market (e.g. 3) */
  exchangePlaces: number;
  layWinStakeOverride?: number;
  layPlaceStakeOverride?: number;
}

export interface ExtraPlaceOutcomeRow {
  key: EachWayRaceOutcome;
  label: string;
  bookie: number;
  exchange: number;
  total: number;
  highlight?: boolean;
}

export interface ExtraPlaceResult {
  placeOdds: number;
  layWinStake: number;
  layWinLiability: number;
  layPlaceStake: number;
  layPlaceLiability: number;
  totalOutlay: number;
  bookiePlaces: number;
  exchangePlaces: number;
  outcomes: ExtraPlaceOutcomeRow[];
  /** Smallest loss among non–extra-place outcomes (typical qualifying loss) */
  qualifyingLoss: number;
  profitIfExtraPlace: number;
  /** Value of the extra place vs qualifying loss, as decimal odds */
  impliedExtraPlaceOdds: number | null;
  worstCase: number;
}

const OUTCOME_LABELS: Record<EachWayRaceOutcome, string> = {
  win: "Wins",
  standard_place: "Standard place",
  extra_place: "Extra place",
  unplaced: "Unplaced",
};

export function extraPlace(input: ExtraPlaceInput): ExtraPlaceResult {
  const computed = eachWayLayStakes(input);
  const layWinStake = input.layWinStakeOverride ?? computed.layWinStake;
  const layPlaceStake = input.layPlaceStakeOverride ?? computed.layPlaceStake;
  const lays = {
    placeOdds: computed.placeOdds,
    layWinStake,
    layWinLiability: layWinStake * (input.layWinOdds - 1),
    layPlaceStake,
    layPlaceLiability: layPlaceStake * (input.layPlaceOdds - 1),
  };
  const layInput = {
    stakePerPart: input.stakePerPart,
    winOdds: input.winOdds,
    placeFraction: input.placeFraction,
    layWinStake,
    layWinOdds: input.layWinOdds,
    layPlaceStake,
    layPlaceOdds: input.layPlaceOdds,
    commission: input.commission,
  };

  const outcomeKeys: EachWayRaceOutcome[] =
    input.bookiePlaces > input.exchangePlaces
      ? ["win", "standard_place", "extra_place", "unplaced"]
      : ["win", "standard_place", "unplaced"];

  const outcomes: ExtraPlaceOutcomeRow[] = outcomeKeys.map((key) => {
    const pnl = eachWayOutcomePnL(layInput, key);
    return {
      key,
      label: OUTCOME_LABELS[key],
      ...pnl,
      highlight: key === "extra_place",
    };
  });

  const nonExtra = outcomes.filter((o) => o.key !== "extra_place");
  const qualifyingLoss = Math.min(...nonExtra.map((o) => o.total));
  const extra = outcomes.find((o) => o.key === "extra_place");
  const profitIfExtraPlace = extra?.total ?? 0;

  let impliedExtraPlaceOdds: number | null = null;
  if (qualifyingLoss < 0 && profitIfExtraPlace > 0) {
    impliedExtraPlaceOdds = (profitIfExtraPlace + Math.abs(qualifyingLoss)) / Math.abs(qualifyingLoss);
  }

  return {
    ...lays,
    totalOutlay: input.stakePerPart * 2,
    bookiePlaces: input.bookiePlaces,
    exchangePlaces: input.exchangePlaces,
    outcomes,
    qualifyingLoss,
    profitIfExtraPlace,
    impliedExtraPlaceOdds,
    worstCase: Math.min(...outcomes.map((o) => o.total)),
  };
}
