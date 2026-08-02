/**
 * Repair place-refund triggers that were stored as unconditional free bets.
 *
 * Cause: labels like "Course · Horse · Bet £50 get £50 free bet (2nd, 3rd, 4th)"
 * used to lose the place clause when parsing (split on ·). Settlement then
 * credited "Offer unlocked" on any settle, including wins / non-placing losses.
 */
import { eq } from "drizzle-orm";
import {
  buildTriggerBundle,
  evaluateFreeBetAward,
  inferAiEffectsFromText,
  isPlaceFreeBetEffect,
  parseTriggerBundle,
  serializeTriggerBundle,
  type AiEffect,
} from "@/lib/calc/ai-triggers";
import { balanceTransactions, bets, db, events } from "@/lib/db";
import { parseRaceResults } from "@/lib/racing";

function sourceText(bet: { triggerText: string | null; label: string }): string {
  return bet.triggerText?.trim() || bet.label.trim();
}

function placeEffectFromText(text: string): (AiEffect & { kind: "free_bet_award" }) | null {
  const effect = inferAiEffectsFromText(text).find(
    (e): e is AiEffect & { kind: "free_bet_award" } =>
      e.kind === "free_bet_award" && e.positions.length > 0
  );
  return effect ?? null;
}

/** True when stored rule has an unconditional free-bet award but the text is place-conditional. */
export function betNeedsPlaceTriggerRepair(bet: {
  triggerRule: string | null;
  triggerText: string | null;
  label: string;
}): boolean {
  const place = placeEffectFromText(sourceText(bet));
  if (!place) return false;
  const stored = parseTriggerBundle(bet.triggerRule).effects.find(
    (e) => e.kind === "free_bet_award"
  );
  return !!stored && stored.positions.length === 0;
}

function placeEffectForBet(bet: {
  triggerRule: string | null;
  triggerText: string | null;
  label: string;
}): (AiEffect & { kind: "free_bet_award" }) | null {
  const stored = parseTriggerBundle(bet.triggerRule).effects.find(
    (e): e is AiEffect & { kind: "free_bet_award" } => isPlaceFreeBetEffect(e)
  );
  if (stored) return stored;
  return placeEffectFromText(sourceText(bet));
}

/**
 * Rebuild mis-stored place triggers. Reverse "Offer unlocked" credits when the
 * race result shows the place condition was not met (including leftover credits
 * after an earlier pass already fixed the rule JSON).
 */
export function repairMisparsedPlaceFreeBetTriggers(): {
  rulesFixed: number;
  creditsReversed: number;
} {
  let rulesFixed = 0;
  let creditsReversed = 0;

  const allBets = db.select().from(bets).all();
  for (const bet of allBets) {
    if (!placeEffectFromText(sourceText(bet))) continue;

    if (betNeedsPlaceTriggerRepair(bet)) {
      const rebuilt = buildTriggerBundle({
        label: bet.label,
        triggerText: bet.triggerText,
      });
      db.update(bets)
        .set({ triggerRule: serializeTriggerBundle(rebuilt.bundle) })
        .where(eq(bets.id, bet.id))
        .run();
      rulesFixed += 1;
    }

    const placeEffect = placeEffectForBet(
      db.select().from(bets).where(eq(bets.id, bet.id)).get() ?? bet
    );
    if (!placeEffect || !bet.eventId) continue;

    const event = db.select().from(events).where(eq(events.id, bet.eventId)).get();
    if (!event || event.sport !== "horse_racing" || event.status !== "finished") continue;
    const race = parseRaceResults(event.goals);
    if (!race) continue;

    const verdict = evaluateFreeBetAward(placeEffect, bet.selection, race);
    if (verdict.met) continue;

    const credits = db
      .select()
      .from(balanceTransactions)
      .where(eq(balanceTransactions.betId, bet.id))
      .all()
      .filter(
        (t) =>
          t.category === "free_bet" &&
          t.amount > 0 &&
          !!t.note?.includes("Offer unlocked")
      );

    // Drop mistaken "Offer unlocked" credits when the place condition was not
    // met. FIFO may have drawn the lot down with an unrelated debit, which
    // still left getPromoAwardsByBetId treating the campaign as awarded.
    for (const credit of credits) {
      db.delete(balanceTransactions).where(eq(balanceTransactions.id, credit.id)).run();
      creditsReversed += 1;
    }
  }

  return { rulesFixed, creditsReversed };
}
