/**
 * Early free-bet credit for unconditional "bet & get" offers.
 * Some bookies (e.g. Ladbrokes) release the free bet on placement, not settlement.
 */

import { aiEffectsForBet, type AiEffect } from "@/lib/calc/ai-triggers";
import type { BetRow, HistoryRow } from "@/lib/db/schema";

export const EARLY_FREE_BET_AWARD_REASON = "Awarded on placement";

/** AI free-bet effects from trigger rule / label, then trigger text, then linked offer title. */
export function freeBetEffectsForBet(
  bet: Pick<BetRow, "triggerRule" | "label" | "triggerText">,
  offerTitle?: string | null
): AiEffect[] {
  const fromRuleOrLabel = aiEffectsForBet(bet.triggerRule, bet.label);
  if (fromRuleOrLabel.length > 0) return fromRuleOrLabel;
  if (bet.triggerText?.trim()) return aiEffectsForBet(null, bet.triggerText);
  if (offerTitle?.trim()) return aiEffectsForBet(null, offerTitle);
  return [];
}

/** Unconditional free-bet effect on a bet (empty positions = award on settle, or early). */
export function unconditionalFreeBetEffect(
  bet: Pick<BetRow, "triggerRule" | "label" | "triggerText">,
  offerTitle?: string | null
): (AiEffect & { kind: "free_bet_award" }) | null {
  const award = freeBetEffectsForBet(bet, offerTitle).find(
    (e): e is AiEffect & { kind: "free_bet_award" } =>
      e.kind === "free_bet_award" && e.positions.length === 0 && e.amount > 0
  );
  return award ?? null;
}

/**
 * Whether a history "Bet placed" row should show the early free-bet award prompt.
 * Hidden once credited (settlement already shows "Free bet won!"). Place-conditional
 * rewards and void bets never show it.
 * `offerTitle` covers bets linked to a campaign whose title carries the reward
 * (e.g. "Bet £10 get £10 free bet") when the bet row itself has no trigger text.
 */
export function showEarlyFreeBetAwardButton(
  entry: Pick<HistoryRow, "kind" | "betId">,
  bet:
    | Pick<
        BetRow,
        | "id"
        | "status"
        | "bookmaker"
        | "betType"
        | "triggerRule"
        | "label"
        | "triggerText"
        | "offerId"
      >
    | undefined,
  promo: { amount: number; reason: string } | undefined,
  offerTitle?: string | null
): boolean {
  if (entry.kind !== "bet_placed") return false;
  if (!bet || entry.betId !== bet.id) return false;
  if (bet.status === "void") return false;
  if (bet.betType === "free_snr" || bet.betType === "free_sr") return false;
  if (promo && promo.amount > 0) return false;

  const effect = unconditionalFreeBetEffect(bet, offerTitle);
  if (!effect) return false;
  if (!bet.bookmaker?.trim()) return false;
  return true;
}

