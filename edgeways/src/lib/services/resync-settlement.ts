/**
 * Re-derive a stored settlement when the current selection / market no longer
 * matches the recorded result (result-centric). Used after a runner edit and
 * on each local poll so a desk already in the wrong state heals itself.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  evaluateFreeBetAward,
  evaluateUnconditionalFreeBet,
  isPlaceFreeBetEffect,
} from "@/lib/calc/ai-triggers";
import { balanceTransactions, bets, db, events, history, type BetRow, type EventRow } from "@/lib/db";
import { settlementOccurredAt } from "@/lib/history-twoup-moment";
import { EARLY_FREE_BET_AWARD_REASON, settlementFreeBetEffectsForBet } from "@/lib/offers/early-free-bet-award";
import { isRaceResultIncomplete, parseRaceResults } from "@/lib/racing";
import { ledgerFromSettledBet, ledgerPromoAward } from "@/lib/services/balances";
import { staleSettlementCorrection } from "@/lib/services/event-settlement";

function purgeOutcomeDependentLedger(betId: number): void {
  const txs = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.betId, betId))
    .all();
  let removedPromo = false;
  for (const tx of txs) {
    if (tx.category === "bet_settlement") {
      db.delete(balanceTransactions).where(eq(balanceTransactions.id, tx.id)).run();
      continue;
    }
    if (
      tx.category === "free_bet" &&
      tx.amount > 0 &&
      !tx.note?.includes(EARLY_FREE_BET_AWARD_REASON)
    ) {
      db.delete(balanceTransactions).where(eq(balanceTransactions.id, tx.id)).run();
      removedPromo = true;
    }
  }
  db.delete(history)
    .where(and(eq(history.betId, betId), eq(history.kind, "settlement")))
    .run();
  if (removedPromo) {
    db.delete(history)
      .where(and(eq(history.betId, betId), eq(history.kind, "free_bet_promo")))
      .run();
  }
}

export function applyFreeBetEffectsForBet(
  bet: BetRow,
  event: EventRow | undefined
): boolean {
  if (bet.betType === "free_snr" || bet.betType === "free_sr") return false;
  let awarded = false;
  for (const effect of settlementFreeBetEffectsForBet(bet)) {
    if (effect.kind !== "free_bet_award") continue;
    if (!isPlaceFreeBetEffect(effect)) {
      const verdict = evaluateUnconditionalFreeBet(effect, bet.status);
      if (verdict.met) awarded = ledgerPromoAward(bet, effect.amount, verdict.reason) || awarded;
      continue;
    }
    if (!event || event.status !== "finished" || event.sport !== "horse_racing") continue;
    const race = parseRaceResults(event.goals);
    if (!race || isRaceResultIncomplete(race)) continue;
    const verdict = evaluateFreeBetAward(effect, bet.selection, race);
    if (verdict.met) awarded = ledgerPromoAward(bet, effect.amount, verdict.reason) || awarded;
  }
  return awarded;
}

/** Apply a derived correction to one settled bet. Null when nothing changed. */
export function resyncSettledBetAgainstEvent(
  bet: BetRow,
  event: EventRow
): BetRow | null {
  const correction = staleSettlementCorrection(bet, event);
  if (!correction) return null;

  purgeOutcomeDependentLedger(bet.id);

  const settledAt = settlementOccurredAt({
    status: correction.status,
    now: Date.now(),
    event,
    bet,
  });
  db.update(bets)
    .set({
      status: correction.status,
      actualProfit: correction.profit,
      settledAt,
      notes: correction.notes,
      balanceSettled: 0,
    })
    .where(eq(bets.id, bet.id))
    .run();
  const updated = db.select().from(bets).where(eq(bets.id, bet.id)).get();
  if (!updated) return null;
  ledgerFromSettledBet(updated);
  return db.select().from(bets).where(eq(bets.id, bet.id)).get() ?? updated;
}

export function resyncStaleSettlements(): number {
  const settled = db
    .select()
    .from(bets)
    .all()
    .filter((b) => b.status !== "open" && b.eventId != null);
  const eventIds = [...new Set(settled.map((b) => b.eventId).filter((id): id is number => id != null))];
  if (eventIds.length === 0) return 0;
  const byId = new Map(
    db
      .select()
      .from(events)
      .where(inArray(events.id, eventIds))
      .all()
      .map((e) => [e.id, e])
  );
  let n = 0;
  for (const bet of settled) {
    const event = bet.eventId ? byId.get(bet.eventId) : undefined;
    if (!event) continue;
    if (resyncSettledBetAgainstEvent(bet, event)) n += 1;
  }
  return n;
}
