import type { BetRow } from "@/lib/db";
import {
  aiEffectsForBet,
  describeAiEffect,
  evaluateTrigger,
  type TriggerContext,
  type TriggerRule,
} from "@/lib/calc";

/** Live Positions card note — only true "wins IF" rules and place-based free-bet awards. */
export function formatLivePositionTriggerNote(
  bet: Pick<BetRow, "triggerText" | "triggerRule" | "label">,
  rule: TriggerRule | null,
  context: TriggerContext
): string | null {
  const triggerText = bet.triggerText?.trim();
  if (rule && triggerText) {
    return `wins IF ${triggerText} - ${evaluateTrigger(rule, context).reason}`;
  }

  const effects = aiEffectsForBet(bet.triggerRule, bet.triggerText ?? bet.label);
  const placeEffect = effects.find(
    (e) => e.kind === "free_bet_award" && e.positions.length > 0
  );
  if (placeEffect) {
    return describeAiEffect(placeEffect).split(" - credits")[0] ?? null;
  }

  return null;
}

export function livePositionTriggerNoteShowsBolt(note: string | null): boolean {
  return !!note?.startsWith("wins IF");
}
