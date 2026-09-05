/**
 * Pure adapters from stored rows to the calc engine's settlement inputs.
 *
 * These live outside `services/state.ts` so the hosted (Neon) settlement path
 * can reuse the exact same conversions without importing the SQLite-bound
 * state service. `state.ts` re-exports them, so its public API is unchanged.
 */
import { betWinRuleForBet, type DutchLegRecord, type MatchResult, type SettleableBet, type TriggerContext, type TriggerRule } from "@/lib/calc";
import { tapeGoals } from "@/lib/events/match-tape";
import { parseEwMeta } from "@/lib/bets/ew-meta";
import type { BetRow, EventRow } from "@/lib/db/schema";

export function toSettleable(bet: BetRow): SettleableBet {
  return {
    market: bet.market as SettleableBet["market"],
    selection: bet.selection,
    betType: bet.betType as SettleableBet["betType"],
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    earlyPayout: !!bet.earlyPayout,
    refundAmount: bet.refundAmount ?? undefined,
    refundRetention: bet.refundRetention ?? undefined,
    legs: bet.legs ? (JSON.parse(bet.legs) as DutchLegRecord[]) : undefined,
    ewMeta: parseEwMeta(bet.notes) ?? undefined,
  };
}

export function toMatchResult(event: EventRow): MatchResult {
  // Bets settle at 90 minutes (FT). Use the stored 90-min score for AET/PEN matches.
  const usesFtScore =
    (event.matchEnding === "aet" || event.matchEnding === "pen") &&
    event.ftHomeScore != null &&
    event.ftAwayScore != null;
  return {
    homeScore: usesFtScore ? event.ftHomeScore! : event.homeScore,
    awayScore: usesFtScore ? event.ftAwayScore! : event.awayScore,
    homeLed2: !!event.homeLed2,
    awayLed2: !!event.awayLed2,
    inPlay: event.status === "live",
  };
}

export function toTriggerContext(event: EventRow): TriggerContext {
  const usesFtScore =
    (event.matchEnding === "aet" || event.matchEnding === "pen") &&
    event.ftHomeScore != null &&
    event.ftAwayScore != null;
  return {
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    homeScore: usesFtScore ? event.ftHomeScore! : event.homeScore,
    awayScore: usesFtScore ? event.ftAwayScore! : event.awayScore,
    finished: event.status === "finished",
    goals: tapeGoals(event.goals),
  };
}

/** Does this rule need the goal timeline (scorers/order), not just the score? */
export function ruleNeedsTimeline(rule: TriggerRule): boolean {
  switch (rule.kind) {
    case "first_goalscorer":
    case "last_goalscorer":
    case "player_scores":
    case "team_scores_first":
      return true;
    case "and":
      return rule.rules.some(ruleNeedsTimeline);
    default:
      return false;
  }
}

export function parseBetTriggerRule(bet: BetRow): TriggerRule | null {
  return betWinRuleForBet(bet.triggerRule);
}

export function hasBetWinTrigger(bet: BetRow): boolean {
  return parseBetTriggerRule(bet) != null;
}
