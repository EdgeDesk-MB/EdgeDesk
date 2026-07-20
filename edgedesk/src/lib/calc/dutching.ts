/** Dutching: split a total stake across mutually exclusive outcomes for equal profit. */

export interface DutchLeg {
  label: string;
  odds: number;
  /** Bookmaker commission is rare; exchange legs may carry commission on winnings */
  commission?: number;
}

export interface DutchLegResult extends DutchLeg {
  stake: number;
  returnIfWins: number;
  profitIfWins: number;
}

export interface DutchResult {
  legs: DutchLegResult[];
  totalStake: number;
  /** Equal profit across all outcomes (negative when the book is against you) */
  profit: number;
  /** Sum of implied probabilities. < 1 means an arb / positive edge */
  totalImplied: number;
  /** Market overround as a percentage (e.g. 2.5 means bookies hold 2.5%) */
  overroundPct: number;
}

export function dutch(legs: DutchLeg[], totalStake: number): DutchResult {
  // Effective odds after commission: 1 + (odds - 1) * (1 - c)
  const effective = legs.map((l) => 1 + (l.odds - 1) * (1 - (l.commission ?? 0)));
  const inverses = effective.map((o) => 1 / o);
  const S = inverses.reduce((a, b) => a + b, 0);

  const legResults: DutchLegResult[] = legs.map((leg, i) => {
    const stake = totalStake * (inverses[i] / S);
    const returnIfWins = stake * effective[i];
    return { ...leg, stake, returnIfWins, profitIfWins: returnIfWins - totalStake };
  });

  return {
    legs: legResults,
    totalStake,
    profit: totalStake / S - totalStake,
    totalImplied: S,
    overroundPct: (S - 1) * 100,
  };
}

/** Total stake needed to hit a target equal-profit across the legs. Null if impossible (S >= 1). */
export function dutchStakeForProfit(legs: DutchLeg[], targetProfit: number): number | null {
  const effective = legs.map((l) => 1 + (l.odds - 1) * (1 - (l.commission ?? 0)));
  const S = effective.map((o) => 1 / o).reduce((a, b) => a + b, 0);
  if (S >= 1) return null;
  return (targetProfit * S) / (1 - S);
}

/**
 * Total stake needed so `legs[legIndex]` gets exactly `legStake`, while every
 * leg still returns equal profit (the "fix one outcome's stake" entry mode).
 * Null if the leg index is out of range or the inputs are non-positive.
 */
export function dutchStakeForLegStake(
  legs: DutchLeg[],
  legIndex: number,
  legStake: number
): number | null {
  const leg = legs[legIndex];
  if (!leg || !(legStake > 0) || !(leg.odds > 1)) return null;
  const effective = legs.map((l) => 1 + (l.odds - 1) * (1 - (l.commission ?? 0)));
  const S = effective.map((o) => 1 / o).reduce((a, b) => a + b, 0);
  return legStake * effective[legIndex] * S;
}

/**
 * 2UP dutch: back Home at bookie A and Away at bookie B, both paying out early at 2 goals up.
 * Scenario matrix including double-payout windfalls.
 */
export interface TwoUpDutchInput {
  homeStake: number;
  homeOdds: number;
  awayStake: number;
  awayOdds: number;
}

export interface TwoUpDutchScenario {
  label: string;
  profit: number;
  windfall: boolean;
}

export function twoUpDutchScenarios(input: TwoUpDutchInput): TwoUpDutchScenario[] {
  const { homeStake, homeOdds, awayStake, awayOdds } = input;
  const outlay = homeStake + awayStake;
  const homeReturn = homeStake * homeOdds;
  const awayReturn = awayStake * awayOdds;

  return [
    { label: "Home wins (no 2-up drama)", profit: homeReturn - outlay, windfall: false },
    { label: "Away wins (no 2-up drama)", profit: awayReturn - outlay, windfall: false },
    { label: "Draw (neither goes 2 up)", profit: -outlay, windfall: false },
    { label: "Home 2 up, then draws/loses (home paid early)", profit: homeReturn - outlay, windfall: true },
    {
      label: "Home 2 up, away comes back to WIN (both paid!)",
      profit: homeReturn + awayReturn - outlay,
      windfall: true,
    },
    { label: "Away 2 up, then draws/loses (away paid early)", profit: awayReturn - outlay, windfall: true },
    {
      label: "Away 2 up, home comes back to WIN (both paid!)",
      profit: homeReturn + awayReturn - outlay,
      windfall: true,
    },
  ];
}
