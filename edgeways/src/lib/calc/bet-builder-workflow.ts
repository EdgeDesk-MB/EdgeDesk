/**
 * Bet Builder desk maths — reuses whole-combo equalising lay from Acca.
 * BB is same-event; matching is one lay (or deliberate no lay).
 */

import { roundPence } from "./money";

export {
  wholeAccaLay as wholeComboLay,
  type WholeAccaLay as WholeComboLay,
  type WholeAccaLayInput as WholeComboLayInput,
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
} from "./acca-workflow";

export interface BbProfitSelection {
  result: "pending" | "won" | "lost" | "void";
}

export interface BbProfitRun {
  stake: number;
  backOdds: number;
  commission: number;
  wholeLayStake?: number | null;
  wholeLayOdds?: number | null;
  /** Desk free-bet convert; lose contributes £0 (not −stake). */
  backBetType?: string | null;
}

/**
 * Campaign P&L for a Bet Builder run. Each contribution is rounded to the
 * penny as it's added, matching settleLinkedBet in bet-builder-desk.ts.
 */
export function bbCampaignProfit(
  run: BbProfitRun,
  selections: BbProfitSelection[]
): number {
  const anyLost = selections.some((s) => s.result === "lost");
  const allResolved =
    selections.length > 0 && selections.every((s) => s.result !== "pending");
  const allVoid = selections.every((s) => s.result === "void");
  if (!allResolved && !anyLost) return 0;

  let total = 0;
  if (anyLost) {
    if (run.backBetType !== "free_snr" && run.backBetType !== "free_sr") {
      total -= run.stake;
    }
    if (run.wholeLayStake != null && run.wholeLayOdds != null) {
      total += roundPence(run.wholeLayStake * (1 - run.commission));
    }
  } else if (allVoid) {
    // back + lay void → £0
  } else {
    total += roundPence(run.stake * (run.backOdds - 1));
    if (run.wholeLayStake != null && run.wholeLayOdds != null) {
      total -= roundPence(run.wholeLayStake * (run.wholeLayOdds - 1));
    }
  }
  return roundPence(total);
}
