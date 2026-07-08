/**
 * Early payout (2UP) calculator: back a team at a bookie offering "2 goals ahead = paid out",
 * lay the same team at the exchange.
 */

export interface TwoUpInput {
  backStake: number;
  backOdds: number;
  layOdds: number;
  commission: number;
  /** Optional lay stake override; defaults to the standard qualifying lay */
  layStakeOverride?: number;
}

export interface TwoUpScenario {
  key: "team_wins" | "no_2up_no_win" | "windfall";
  label: string;
  profit: number;
}

export interface TwoUpResult {
  layStake: number;
  liability: number;
  scenarios: TwoUpScenario[];
  qualifyingLoss: number;
  windfallProfit: number;
}

export function twoUp(input: TwoUpInput): TwoUpResult {
  const { backStake, backOdds, layOdds, commission } = input;
  const layStake = input.layStakeOverride ?? (backStake * backOdds) / (layOdds - commission);
  const liability = layStake * (layOdds - 1);
  const layWinnings = layStake * (1 - commission);

  const teamWins = backStake * (backOdds - 1) - liability;
  const noTwoUpNoWin = layWinnings - backStake;
  const windfall = backStake * (backOdds - 1) + layWinnings;

  return {
    layStake,
    liability,
    scenarios: [
      { key: "team_wins", label: "Team wins (2 up or not)", profit: teamWins },
      { key: "no_2up_no_win", label: "Team never goes 2 up & fails to win", profit: noTwoUpNoWin },
      { key: "windfall", label: "Team goes 2 up, then FAILS to win (double payout)", profit: windfall },
    ],
    qualifyingLoss: Math.min(teamWins, noTwoUpNoWin),
    windfallProfit: windfall,
  };
}

/**
 * Expected value of the 2UP position given an estimated probability of the windfall
 * (team goes 2 up then fails to win) and the probability the team wins.
 */
export function twoUpEV(result: TwoUpResult, pTeamWins: number, pWindfall: number): number {
  const pOther = Math.max(0, 1 - pTeamWins - pWindfall);
  const [win, other, windfall] = result.scenarios;
  return pTeamWins * win.profit + pOther * other.profit + pWindfall * windfall.profit;
}
