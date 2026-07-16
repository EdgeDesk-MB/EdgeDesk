/**
 * Lock-in advisor (J3) - close any open back+lay single for a guaranteed
 * P&L at TODAY'S user-entered exchange prices (no odds are fetched - D2).
 *
 * The position's pre-trade outcomes come from the same primitives as the
 * lay planner (matchedBackReturns + the original lay as a part lay). The
 * advisor then solves the equalising trade in whichever direction closes
 * the gap:
 *
 * - under-laid (win side better)  → LAY more at the current lay price
 * - over-laid  (lose side better) → BACK the selection on the exchange at
 *                                    the current back price
 *
 * Commission is charged on exchange winnings in both directions, per bet
 * (the repo's matched.ts convention). Real exchanges charge on NET market
 * winnings, so when a new back and the original lay share a market the
 * modelled ifWin can only understate reality - the advice is conservative.
 * The 2UP early-payout position is deliberately NOT handled here - its
 * extra payout branch needs the EP desk's own machinery.
 */

import { matchedBackReturns, type BetMode } from "./matched";
import { roundPence } from "./money";

export interface LockInInput {
  mode: BetMode;
  backStake: number;
  backOdds: number;
  /** Original lay already placed; 0 = back-only position */
  layStake: number;
  layOdds: number;
  /** Exchange commission as a fraction (0.02 = 2%) */
  commission: number;
  /** Today's exchange lay price (for a further lay) */
  currentLayOdds: number;
  /** Today's exchange back price (for closing an over-laid position) */
  currentBackOdds: number;
  refundAmount?: number;
  refundRetention?: number;
}

export type LockInDirection = "lay" | "back" | "none";

export interface LockInOutcomeTotals {
  ifWin: number;
  ifLose: number;
  guaranteed: number;
}

export interface LockInAdvice {
  direction: LockInDirection;
  /** Exact equalising stake (unrounded, for the slider range) */
  fullStake: number;
  /** Pence-rounded stake you can actually place on-exchange */
  executableStake: number;
  /** Totals at the executable stake */
  outcome: LockInOutcomeTotals;
  /** Totals if you do nothing (the position as it stands) */
  preTrade: LockInOutcomeTotals;
}

/** Both sides are within half a penny - nothing worth trading. */
const BALANCED_EPSILON = 0.005;

function preTradeTotals(input: LockInInput): { win: number; lose: number } {
  const { win, lose } = matchedBackReturns(input);
  const hasLay = input.layStake > 0 && input.layOdds > 1;
  const layLiability = hasLay ? input.layStake * (input.layOdds - 1) : 0;
  const layReturn = hasLay ? input.layStake * (1 - input.commission) : 0;
  return { win: win - layLiability, lose: lose + layReturn };
}

/** Totals after adding a trade of `stake` in `direction` at today's prices. */
export function lockInOutcome(
  input: LockInInput,
  direction: LockInDirection,
  stake: number
): LockInOutcomeTotals {
  const { win, lose } = preTradeTotals(input);
  const c = input.commission;
  let ifWin = win;
  let ifLose = lose;
  if (direction === "lay" && stake > 0) {
    ifWin = win - stake * (input.currentLayOdds - 1);
    ifLose = lose + stake * (1 - c);
  } else if (direction === "back" && stake > 0) {
    ifWin = win + stake * (input.currentBackOdds - 1) * (1 - c);
    ifLose = lose - stake;
  }
  return { ifWin, ifLose, guaranteed: Math.min(ifWin, ifLose) };
}

export function lockInAdvice(input: LockInInput): LockInAdvice | null {
  const { backStake, backOdds, currentLayOdds, currentBackOdds, commission: c } = input;
  if (!(backStake > 0) || !(backOdds > 1)) return null;
  if (!(currentLayOdds > 1) || !(currentBackOdds > 1)) return null;
  if (!(c >= 0 && c < 1)) return null;
  if (input.layStake > 0 && !(input.layOdds > 1)) return null;

  const { win, lose } = preTradeTotals(input);
  const preTrade: LockInOutcomeTotals = {
    ifWin: win,
    ifLose: lose,
    guaranteed: Math.min(win, lose),
  };

  let direction: LockInDirection;
  let fullStake: number;
  if (Math.abs(win - lose) < BALANCED_EPSILON) {
    direction = "none";
    fullStake = 0;
  } else if (win > lose) {
    // Lay L at Yc: win − L(Yc−1) = lose + L(1−c) → L = (win − lose)/(Yc − c)
    direction = "lay";
    fullStake = (win - lose) / (currentLayOdds - c);
  } else {
    // Back E at Ob: win + E(Ob−1)(1−c) = lose − E → E = (lose − win)/((Ob−1)(1−c) + 1)
    direction = "back";
    fullStake = (lose - win) / ((currentBackOdds - 1) * (1 - c) + 1);
  }

  const executableStake = direction === "none" ? 0 : roundPence(fullStake);
  return {
    direction,
    fullStake,
    executableStake,
    outcome: lockInOutcome(input, direction, executableStake),
    preTrade,
  };
}
