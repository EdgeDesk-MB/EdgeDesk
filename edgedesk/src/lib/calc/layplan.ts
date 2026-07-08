/**
 * Advanced lay planning: part lays + underlay / standard / overlay targeting.
 *
 * A position is: one back bet, zero or more part lays already placed at various
 * odds, and one further lay to be placed at the current market odds. The three
 * named targets solve for that remaining lay stake:
 *
 * - standard  — equalise profit whichever side wins (classic matched bet)
 * - underlay  — zero net P&L when the BOOKIE bet LOSES (all profit rides on the
 *               bookie win; the user's boosted-odds play)
 * - overlay   — zero net P&L when the BOOKIE bet WINS (all profit lands on the
 *               exchange side)
 *
 * Commission is charged on lay winnings; part lays are assumed to be at the same
 * exchange (same commission) as the remaining lay.
 */

import type { BetMode } from "./matched";
import { roundPence } from "./money";

export interface PartLay {
  odds: number;
  stake: number;
}

export interface LayPlanInput {
  mode: BetMode;
  backStake: number;
  backOdds: number;
  /** Current market lay odds for the remaining (new) lay */
  layOdds: number;
  commission: number;
  partLays?: PartLay[];
  refundAmount?: number;
  refundRetention?: number;
}

/** Bookie-side profit for each outcome, independent of any laying. */
export function backReturns(input: LayPlanInput): { win: number; lose: number } {
  const { mode, backStake, backOdds } = input;
  switch (mode) {
    case "qualifying":
      return { win: backStake * (backOdds - 1), lose: -backStake };
    case "free_snr":
      return { win: backStake * (backOdds - 1), lose: 0 };
    case "free_sr":
      return { win: backStake * backOdds, lose: 0 };
    case "risk_free": {
      const refund = (input.refundAmount ?? backStake) * (input.refundRetention ?? 0.7);
      return { win: backStake * (backOdds - 1), lose: -backStake + refund };
    }
  }
}

export interface LayBounds {
  /** Remaining lay stake at layOdds to equalise both outcomes */
  standard: number;
  /** Remaining lay stake so the bookie-loses outcome nets £0 */
  underlay: number;
  /** Remaining lay stake so the bookie-wins outcome nets £0 */
  overlay: number;
}

const clamp0 = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);

export function layBounds(input: LayPlanInput): LayBounds {
  const { layOdds, commission: c } = input;
  const parts = input.partLays ?? [];
  const { win, lose } = backReturns(input);
  const partLiability = parts.reduce((a, p) => a + p.stake * (p.odds - 1), 0);
  const partStake = parts.reduce((a, p) => a + p.stake, 0);

  // standard: win - partLiab - L(Ol-1)  =  lose + (partStake + L)(1-c)
  const standard = (win - lose - partLiability - partStake * (1 - c)) / (layOdds - c);
  // underlay: lose + (partStake + L)(1-c) = 0
  const underlay = -lose / (1 - c) - partStake;
  // overlay: win - partLiab - L(Ol-1) = 0
  const overlay = (win - partLiability) / (layOdds - 1);

  return { standard: clamp0(standard), underlay: clamp0(underlay), overlay: clamp0(overlay) };
}

/** Lay stake rounded to the nearest penny — what you can actually place on-exchange. */
export function executableLayStake(input: LayPlanInput, override?: number | null): number {
  if (override != null && Number.isFinite(override)) return roundPence(override);
  return roundPence(layBounds(input).standard);
}

export interface LayPlanOutcome {
  /** Remaining lay stake used (at layOdds) */
  layStake: number;
  totalLayStake: number;
  totalLiability: number;
  /** Effective single-lay odds that reproduce the combined liability (for storage) */
  effectiveLayOdds: number;
  ifBackWins: { bookie: number; exchange: number; total: number };
  ifBackLoses: { bookie: number; exchange: number; total: number };
  guaranteed: number;
}

/** Full P&L for a chosen remaining lay stake (part lays included). */
export function layPlanOutcome(input: LayPlanInput & { layStake: number }): LayPlanOutcome {
  const { layOdds, commission: c, layStake } = input;
  const parts = input.partLays ?? [];
  const { win, lose } = backReturns(input);

  const totalLayStake = parts.reduce((a, p) => a + p.stake, 0) + layStake;
  const totalLiability =
    parts.reduce((a, p) => a + p.stake * (p.odds - 1), 0) + layStake * (layOdds - 1);

  const exchangeIfBackWins = -totalLiability;
  const exchangeIfBackLoses = totalLayStake * (1 - c);

  const ifBackWins = { bookie: win, exchange: exchangeIfBackWins, total: win + exchangeIfBackWins };
  const ifBackLoses = {
    bookie: lose,
    exchange: exchangeIfBackLoses,
    total: lose + exchangeIfBackLoses,
  };

  return {
    layStake,
    totalLayStake,
    totalLiability,
    effectiveLayOdds: totalLayStake > 0 ? 1 + totalLiability / totalLayStake : layOdds,
    ifBackWins,
    ifBackLoses,
    guaranteed: Math.min(ifBackWins.total, ifBackLoses.total),
  };
}
