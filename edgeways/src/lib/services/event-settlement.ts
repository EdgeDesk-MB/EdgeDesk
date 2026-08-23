/**
 * "Should this bet settle now, and for how much?" — pure, one bet against one
 * event (EDGE-81b, phase 3).
 *
 * This is the decision half of `settleTriggers()` + `autoSettle()` in
 * services/state.ts, lifted so the hosted (Neon) poller can settle with exactly
 * the same maths and the same guards. All arithmetic still comes from
 * `@/lib/calc` (`settleFromOutcome`, `settleBet`, `settleRacingBet`); nothing
 * new is computed here.
 *
 * The local SQLite path keeps its own inline loops; parity is asserted in
 * `event-settlement.test.ts`.
 */
import { isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { isBetBuilderDeskLay } from "@/lib/bets/bet-builder-desk-bets";
import {
  hasBetWinTrigger,
  parseBetTriggerRule,
  toMatchResult,
  toSettleable,
  toTriggerContext,
} from "@/lib/bets/settle-inputs";
import { formatFinishingPosition } from "@/lib/bet-outcomes";
import {
  evaluateTrigger,
  racingMarketReadyToSettle,
  settleBet,
  settleFromOutcome,
  settleRacingBet,
} from "@/lib/calc";
import type { BetRow, EventRow } from "@/lib/db/schema";
import { parseRaceResults, selectionPosition } from "@/lib/racing";

export type EventSettlement = {
  status: BetRow["status"];
  profit: number;
  /** Human explanation, already merged onto the bet's existing notes. */
  notes: string;
  /** Which engine decided it: the trigger rule, or the final result. */
  via: "trigger" | "final_result";
};

function withNotes(bet: BetRow, explanation: string): string {
  return bet.notes ? `${bet.notes} | ${explanation}` : explanation;
}

/**
 * "The bet wins IF …" bets settle the moment the outcome is irreversible, not
 * only at full time. Dutch bets are excluded, exactly as on local.
 */
function triggerSettlement(bet: BetRow, event: EventRow): EventSettlement | null {
  if (event.status === "upcoming") return null;
  const rule = parseBetTriggerRule(bet);
  if (!rule) return null;
  const verdict = evaluateTrigger(rule, toTriggerContext(event));
  if (verdict.status === "pending") return null;

  const outcome = settleFromOutcome(toSettleable(bet), verdict.status === "won");
  const explanation = `Trigger ${verdict.status}: ${verdict.reason} - ${outcome.explanation}`;
  return {
    status: outcome.status,
    profit: outcome.profit,
    notes: withNotes(bet, explanation),
    via: "trigger",
  };
}

function finalResultSettlement(bet: BetRow, event: EventRow): EventSettlement | null {
  // Desk owns Acca / Bet Builder hedges — do not settle them ahead of desk legs.
  if (isAccaDeskLay(bet) || isBetBuilderDeskLay(bet)) return null;
  if (event.status !== "finished") return null;

  const settleable = toSettleable(bet);
  let outcome;
  let explanationSuffix = "";

  if (event.sport === "horse_racing") {
    const race = parseRaceResults(event.goals);
    if (!race) return null;
    // Fast result: win markets settle on winner-only; place/EW wait for placings.
    if (!racingMarketReadyToSettle(settleable.market, race)) return null;
    outcome = settleRacingBet(settleable, race);
    if (outcome && bet.selection.trim()) {
      const posLabel = formatFinishingPosition(selectionPosition(bet.selection, race));
      if (posLabel) explanationSuffix = ` · ${posLabel}`;
    }
  } else {
    outcome = settleBet(settleable, toMatchResult(event));
  }

  // Underivable market: stays open for manual settlement.
  if (!outcome) return null;

  return {
    status: outcome.status,
    profit: outcome.profit,
    notes: withNotes(bet, `${outcome.explanation}${explanationSuffix}`),
    via: "final_result",
  };
}

/** Null when the bet is not settleable from this event yet. */
export function settlementForBetOnEvent(
  bet: BetRow,
  event: EventRow
): EventSettlement | null {
  if (bet.status !== "open") return null;
  if (bet.eventId !== event.id) return null;
  if (hasBetWinTrigger(bet)) {
    if (bet.betType === "dutch") return null;
    return triggerSettlement(bet, event);
  }
  return finalResultSettlement(bet, event);
}
