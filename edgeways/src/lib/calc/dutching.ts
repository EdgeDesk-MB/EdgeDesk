/** Dutching: split a total stake across mutually exclusive outcomes for equal profit. */

import { roundPence, roundToIncrement } from "./money";

export interface DutchLeg {
  label: string;
  odds: number;
  /** Bookmaker commission is rare; exchange legs may carry commission on winnings */
  commission?: number;
}

/** Oddsmonkey / spreadsheet increments: penny through a fiver. */
export const DUTCH_STAKE_INCREMENTS = [0.01, 0.5, 1, 2, 2.5, 5] as const;
export type DutchStakeIncrement = (typeof DUTCH_STAKE_INCREMENTS)[number];

/** Penny-level dutch is "equal" when outcome P&Ls sit within 2p. */
export const DUTCH_EQUALISED_TOLERANCE = 0.02;

export function formatDutchStakeIncrement(increment: number): string {
  if (increment < 1) return `${Math.round(increment * 100)}p`;
  if (Number.isInteger(increment)) return `£${increment}`;
  return `£${increment.toFixed(2)}`;
}

export interface DutchLegResult extends DutchLeg {
  stake: number;
  returnIfWins: number;
  profitIfWins: number;
}

export interface DutchResult {
  legs: DutchLegResult[];
  totalStake: number;
  /**
   * Equal profit when the book is still equalised. After rounding or a custom
   * stake, this is the worst-case profit if a single outcome wins.
   */
  profit: number;
  /** Sum of implied probabilities. < 1 means an arb / positive edge */
  totalImplied: number;
  /** Market overround as a percentage (e.g. 2.5 means bookies hold 2.5%) */
  overroundPct: number;
  worstProfit?: number;
  bestProfit?: number;
  equalised?: boolean;
}

export type DutchStakedLeg = DutchLeg & {
  stake: number;
  freeBet?: "snr" | "sr";
};

export interface DutchRealiseOptions {
  /** Excel MROUND increment. Default £0.01. */
  roundTo?: number;
  /** Per-leg stake override. Null/undefined keeps the (rounded) ideal. */
  overrides?: Array<number | null | undefined>;
  /** Don't round these indexes (First-outcome / free-bet anchor). Overrides still win. */
  preserveExact?: number[];
  freeLeg?: { index: number; type: "snr" | "sr" };
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

/**
 * Total stake that equalises P&L at `|targetProfit|`. Underround books land
 * a profit of that amount; overround books land a loss of that amount.
 * Null when the book is fair (S = 1) or the target is zero / not finite.
 */
export function dutchStakeForProfit(legs: DutchLeg[], targetProfit: number): number | null {
  const effective = legs.map((l) => 1 + (l.odds - 1) * (1 - (l.commission ?? 0)));
  const S = effective.map((o) => 1 / o).reduce((a, b) => a + b, 0);
  if (!Number.isFinite(S) || !Number.isFinite(targetProfit) || targetProfit === 0) return null;
  const gap = Math.abs(1 - S);
  if (gap < 1e-12) return null;
  return (Math.abs(targetProfit) * S) / gap;
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
 * Free-bet dutching: `freeLegIndex` carries a fixed free-bet stake (never
 * real cash - so it costs nothing if it loses). The other (cash) legs are
 * solved so every outcome pays the same guaranteed profit, given the free
 * leg's own payout if it wins.
 *
 * SNR: winning profit is stake × (odds − 1) (bookie doesn't return the stake).
 * SR: winning profit is stake × odds (the "stake" is paid out as winnings too).
 * Null if the free leg or any other leg's odds/stake are invalid.
 */
export function dutchStakesForFreeLeg(
  legs: DutchLeg[],
  freeLegIndex: number,
  freeLegStake: number,
  freeLegType: "snr" | "sr"
): DutchResult | null {
  const freeLeg = legs[freeLegIndex];
  if (!freeLeg || !(freeLegStake > 0)) return null;
  if (legs.length < 2 || legs.some((l) => !(l.odds > 1))) return null;

  const effective = legs.map((l) => 1 + (l.odds - 1) * (1 - (l.commission ?? 0)));
  const freeEffective = effective[freeLegIndex];
  const freeProfit =
    freeLegType === "sr" ? freeLegStake * freeEffective : freeLegStake * (freeEffective - 1);

  const cashStakes = legs.map((_, i) => (i === freeLegIndex ? freeLegStake : freeProfit / effective[i]));
  const cashOutlay = cashStakes.reduce((sum, stake, i) => (i === freeLegIndex ? sum : sum + stake), 0);
  const profit = freeProfit - cashOutlay;

  const legResults: DutchLegResult[] = legs.map((leg, i) => ({
    ...leg,
    stake: cashStakes[i],
    // SNR doesn't return the stake, so the actual payout if it wins is the
    // winnings only - everywhere else the stake comes back as part of the return.
    returnIfWins: i === freeLegIndex && freeLegType === "snr" ? freeProfit : cashStakes[i] * effective[i],
    profitIfWins: profit,
  }));

  const inverses = effective.map((o) => 1 / o);
  const S = inverses.reduce((a, b) => a + b, 0);

  return {
    legs: legResults,
    totalStake: freeLegStake + cashOutlay,
    profit,
    totalImplied: S,
    overroundPct: (S - 1) * 100,
  };
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

function legEffectiveOdds(leg: DutchLeg): number {
  return 1 + (leg.odds - 1) * (1 - (leg.commission ?? 0));
}

function winningReturn(leg: DutchStakedLeg): number {
  const eff = legEffectiveOdds(leg);
  const raw = leg.freeBet === "snr" ? leg.stake * (eff - 1) : leg.stake * eff;
  return roundPence(raw);
}

/**
 * P&L if each outcome wins, matching settlement: a free leg costs nothing
 * when it loses; cash outlay is the sum of non-free stakes.
 */
export function dutchOutcomeProfits(legs: DutchStakedLeg[]): number[] {
  const cashOutlay = roundPence(legs.reduce((sum, leg) => (leg.freeBet ? sum : sum + leg.stake), 0));
  return legs.map((leg) => roundPence(winningReturn(leg) - cashOutlay));
}

export function dutchWorstProfit(legs: DutchStakedLeg[]): number {
  const profits = dutchOutcomeProfits(legs);
  if (profits.length === 0) return 0;
  return Math.min(...profits);
}

/** Slider centre: the equal-profit split of the first and last legs. */
export const DUTCH_END_BIAS_CENTER = 0.5;
/** Do not drain either end to £0 when the slider is at a stop. */
const DUTCH_END_SHARE_MIN = 0.08;
const DUTCH_END_SHARE_MAX = 0.92;

function clampDutchEndShare(share: number): number {
  if (!Number.isFinite(share)) return DUTCH_END_BIAS_CENTER;
  return Math.min(DUTCH_END_SHARE_MAX, Math.max(DUTCH_END_SHARE_MIN, share));
}

function dutchEndShareFromBias(idealFirstShare: number, bias: number): number {
  const ideal = clampDutchEndShare(idealFirstShare);
  const t = Number.isFinite(bias) ? Math.min(1, Math.max(0, bias)) : DUTCH_END_BIAS_CENTER;
  if (t <= DUTCH_END_BIAS_CENTER) {
    const u = (DUTCH_END_BIAS_CENTER - t) * 2;
    return ideal + u * (DUTCH_END_SHARE_MAX - ideal);
  }
  const u = (t - DUTCH_END_BIAS_CENTER) * 2;
  return ideal - u * (ideal - DUTCH_END_SHARE_MIN);
}

function dutchEndBiasFromShare(idealFirstShare: number, actualFirstShare: number): number {
  const ideal = clampDutchEndShare(idealFirstShare);
  const actual = clampDutchEndShare(actualFirstShare);
  if (actual >= ideal) {
    const span = DUTCH_END_SHARE_MAX - ideal;
    const u = span > 0 ? (actual - ideal) / span : 0;
    return DUTCH_END_BIAS_CENTER - 0.5 * u;
  }
  const span = ideal - DUTCH_END_SHARE_MIN;
  const u = span > 0 ? (ideal - actual) / span : 0;
  return DUTCH_END_BIAS_CENTER + 0.5 * u;
}

function stakePence(value: number): number {
  return Math.round(roundPence(value) * 100);
}

/**
 * Where the first-vs-last chevron sits. 0.5 is the equal-profit end split
 * (Home can still be a larger cash stake than Away). 0 favours the first
 * outcome, 1 favours the last. Middle legs are ignored.
 */
export function dutchEndBias(idealStakes: number[], actualStakes: number[]): number {
  const last = Math.min(idealStakes.length, actualStakes.length) - 1;
  if (last < 1) return DUTCH_END_BIAS_CENTER;
  const idealPot = idealStakes[0] + idealStakes[last];
  const actualPot = actualStakes[0] + actualStakes[last];
  if (!(idealPot > 0) || !(actualPot > 0)) return DUTCH_END_BIAS_CENTER;
  return dutchEndBiasFromShare(idealStakes[0] / idealPot, actualStakes[0] / actualPot);
}

/**
 * Split the first+last pot by slider position. Middle stakes stay as given
 * in `currentStakes`. Centre (`0.5`) restores the ideal ends.
 */
export function applyDutchEndBias(
  idealStakes: number[],
  currentStakes: number[],
  bias: number,
  opts?: { lockFirst?: boolean; lockLast?: boolean }
): number[] {
  const last = idealStakes.length - 1;
  const next = idealStakes.map((stake, i) => currentStakes[i] ?? stake);
  if (last < 1) return next.map(roundPence);

  const idealPotPence = stakePence(idealStakes[0]) + stakePence(idealStakes[last]);
  if (idealPotPence <= 0) return next.map(roundPence);

  if (opts?.lockFirst && opts?.lockLast) return next.map(roundPence);

  if (Math.abs(bias - DUTCH_END_BIAS_CENTER) < 1e-9) {
    if (!opts?.lockFirst) next[0] = idealStakes[0];
    if (!opts?.lockLast) next[last] = idealStakes[last];
    return next.map(roundPence);
  }

  const idealShare = idealStakes[0] / (idealStakes[0] + idealStakes[last]);
  const firstShare = dutchEndShareFromBias(idealShare, bias);

  if (opts?.lockFirst) {
    const firstPence = stakePence(currentStakes[0] ?? idealStakes[0]);
    if (firstPence <= 0 || firstShare <= 0 || firstShare >= 1) return next.map(roundPence);
    next[0] = roundPence(firstPence / 100);
    next[last] = roundPence(Math.round((firstPence * (1 - firstShare)) / firstShare) / 100);
    return next;
  }

  if (opts?.lockLast) {
    const lastPence = stakePence(currentStakes[last] ?? idealStakes[last]);
    if (lastPence <= 0 || firstShare <= 0 || firstShare >= 1) return next.map(roundPence);
    next[last] = roundPence(lastPence / 100);
    next[0] = roundPence(Math.round((lastPence * firstShare) / (1 - firstShare)) / 100);
    return next;
  }

  const currentPotPence = stakePence(currentStakes[0] ?? 0) + stakePence(currentStakes[last] ?? 0);
  const potPence = currentPotPence > 0 ? currentPotPence : idealPotPence;
  const firstPence = Math.round(potPence * firstShare);
  next[0] = roundPence(firstPence / 100);
  next[last] = roundPence((potPence - firstPence) / 100);
  return next;
}

/**
 * Apply execution rounding and per-leg custom stakes to an ideal dutch.
 * Recalculates returns and per-outcome profit. `profit` becomes the worst case.
 */
export function realiseDutch(ideal: DutchResult, options?: DutchRealiseOptions): DutchResult {
  const roundTo = options?.roundTo ?? 0.01;
  const freeIndex = options?.freeLeg?.index;
  const stakes = ideal.legs.map((leg, i) => {
    const override = options?.overrides?.[i];
    if (override != null && Number.isFinite(override) && override >= 0) {
      return roundPence(override);
    }
    if (options?.preserveExact?.includes(i)) return roundPence(leg.stake);
    return roundToIncrement(leg.stake, roundTo);
  });

  const staked: DutchStakedLeg[] = ideal.legs.map((leg, i) => ({
    ...leg,
    stake: stakes[i],
    freeBet: freeIndex === i ? options?.freeLeg?.type : undefined,
  }));

  const profits = dutchOutcomeProfits(staked);
  const worst = profits.length ? Math.min(...profits) : 0;
  const best = profits.length ? Math.max(...profits) : 0;
  const totalStake = roundPence(stakes.reduce((sum, stake) => sum + stake, 0));

  return {
    legs: ideal.legs.map((leg, i) => ({
      ...leg,
      stake: stakes[i],
      returnIfWins: winningReturn(staked[i]),
      profitIfWins: profits[i] ?? 0,
    })),
    totalStake,
    profit: worst,
    totalImplied: ideal.totalImplied,
    overroundPct: ideal.overroundPct,
    worstProfit: worst,
    bestProfit: best,
    equalised: best - worst <= DUTCH_EQUALISED_TOLERANCE,
  };
}
