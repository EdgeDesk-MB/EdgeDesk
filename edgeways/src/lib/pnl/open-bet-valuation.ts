/**
 * Open-bet valuation for platform P&L.
 *
 * Matched bets store worst-case guaranteed profit as `expectedProfit` at placement.
 * Until settlement (or a live in-play revaluation), that worst case is the
 * provisional contribution to running profit.
 *
 * Labelling: when both matched outcomes are equal (within a penny), the figure is
 * locked — not an estimate. When they diverge, show the worse side as
 * "Worst outcome". Naked / incomplete lays stay "Est.".
 */
import { matchedBet, type BetMode } from "@/lib/calc/matched";
import type { BetRow } from "@/lib/db/schema";

/** Pence-level equality for the two matched outcomes after roundPence. */
const OUTCOME_EQUAL_EPS = 0.02;

const MATCHED_MODES = new Set<string>([
  "qualifying",
  "free_snr",
  "free_sr",
  "risk_free",
]);

export type OpenBetOutcomeKind = "locked" | "worst" | "estimate";

type OutcomeKindBet = Pick<
  BetRow,
  | "betType"
  | "backStake"
  | "backOdds"
  | "layStake"
  | "layOdds"
  | "commission"
  | "refundAmount"
  | "refundRetention"
  | "expectedProfit"
>;

/**
 * Classify how to label an open bet's stored `expectedProfit`.
 * Recomputes back-wins vs lay-wins from stakes when a lay is present.
 */
export function openBetOutcomeKind(bet: OutcomeKindBet): OpenBetOutcomeKind {
  if (
    MATCHED_MODES.has(bet.betType) &&
    bet.backStake > 0 &&
    bet.backOdds > 1 &&
    bet.layStake > 0 &&
    bet.layOdds > 1
  ) {
    const result = matchedBet({
      mode: bet.betType as BetMode,
      backStake: bet.backStake,
      backOdds: bet.backOdds,
      layOdds: bet.layOdds,
      commission: bet.commission,
      layStakeOverride: bet.layStake,
      refundAmount: bet.refundAmount ?? undefined,
      refundRetention: bet.refundRetention ?? undefined,
    });
    const spread = Math.abs(result.profitIfBackWins - result.profitIfLayWins);
    return spread <= OUTCOME_EQUAL_EPS ? "locked" : "worst";
  }
  return "estimate";
}

export function openBetOutcomeLabel(kind: OpenBetOutcomeKind): string {
  switch (kind) {
    case "locked":
      return "Locked";
    case "worst":
      return "Worst outcome";
    case "estimate":
      return "Est.";
  }
}

/** Worst-case / planned profit for an open bet (null if unknown). */
export function openBetExpectedProfit(
  bet: Pick<BetRow, "status" | "expectedProfit">
): number | null {
  if (bet.status !== "open") return null;
  if (bet.expectedProfit == null || Number.isNaN(bet.expectedProfit)) return null;
  return bet.expectedProfit;
}

/**
 * Sum worst-case expected profit across open bets.
 * Optionally exclude bet ids already valued via live provisional (avoid double-count).
 */
export function sumOpenExpectedProfit(
  bets: Array<Pick<BetRow, "id" | "status" | "expectedProfit">>,
  opts?: { excludeBetIds?: Iterable<number> }
): number {
  const exclude = opts?.excludeBetIds ? new Set(opts.excludeBetIds) : null;
  let total = 0;
  for (const bet of bets) {
    if (exclude?.has(bet.id)) continue;
    const value = openBetExpectedProfit(bet);
    if (value != null) total += value;
  }
  return Math.round(total * 100) / 100;
}
