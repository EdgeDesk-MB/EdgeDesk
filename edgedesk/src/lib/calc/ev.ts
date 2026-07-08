/** Expected value, edge and no-vig (fair odds) utilities. */

export interface NoVigResult {
  /** Fair probability of each outcome with the margin removed */
  fairProbabilities: number[];
  fairOdds: number[];
  overroundPct: number;
}

/** Remove the vig from a full market of decimal odds (multiplicative method). */
export function noVig(oddsList: number[]): NoVigResult {
  const implied = oddsList.map((o) => 1 / o);
  const S = implied.reduce((a, b) => a + b, 0);
  const fairProbabilities = implied.map((p) => p / S);
  return {
    fairProbabilities,
    fairOdds: fairProbabilities.map((p) => 1 / p),
    overroundPct: (S - 1) * 100,
  };
}

export interface EvResult {
  /** EV in stake units (e.g. 0.05 = +5p per £1) */
  evPerUnit: number;
  evForStake: number;
  edgePct: number;
  impliedProbability: number;
  fairOdds: number;
}

/** EV of backing at `odds` when the true win probability is `trueProbability`. */
export function expectedValue(odds: number, trueProbability: number, stake = 1): EvResult {
  const evPerUnit = trueProbability * (odds - 1) - (1 - trueProbability);
  return {
    evPerUnit,
    evForStake: evPerUnit * stake,
    edgePct: (odds * trueProbability - 1) * 100,
    impliedProbability: 1 / odds,
    fairOdds: 1 / trueProbability,
  };
}

/**
 * Estimate the true probability of a back selection from exchange lay odds
 * (exchange prices are the closest public proxy for fair value).
 */
export function trueProbabilityFromExchange(backOddsExchange: number, layOddsExchange: number): number {
  // Midpoint of back/lay implied probabilities
  return (1 / backOddsExchange + 1 / layOddsExchange) / 2;
}
