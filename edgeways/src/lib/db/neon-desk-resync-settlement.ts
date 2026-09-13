/**
 * Hosted equivalent of `resync-settlement.ts`: when a settled bet's current
 * selection no longer matches the recorded result, rewrite cash settlement
 * and re-award outcome-dependent free bets.
 */
import "server-only";

import { EARLY_FREE_BET_AWARD_REASON } from "@/lib/offers/early-free-bet-award";
import {
  deleteNeonDeskBalanceTransaction,
  listNeonDeskBalanceTransactions,
  purgeNeonDeskSettlementTransactionsForBet,
} from "@/lib/db/neon-desk-accounts";
import { getNeonDeskBet, patchNeonDeskBet } from "@/lib/db/neon-desk";
import {
  purgeNeonDeskPromoHistoryForBet,
  purgeNeonDeskSettlementHistoryForBet,
} from "@/lib/db/neon-desk-history";
import { ledgerNeonBetSettlement } from "@/lib/db/neon-desk-ledger";
import { settleNeonBet } from "@/lib/db/neon-feed-settlement";
import {
  settlementForBetOnEvent,
  staleSettlementCorrection,
} from "@/lib/services/event-settlement";
import { settlementOccurredAt } from "@/lib/history-twoup-moment";
import type { BetRow, EventRow } from "@/lib/db/schema";

async function purgeOutcomeDependentCredits(betId: number): Promise<boolean> {
  const txs = await listNeonDeskBalanceTransactions();
  let removedPromo = false;
  for (const tx of txs) {
    if (tx.betId !== betId) continue;
    if (
      tx.category === "free_bet" &&
      tx.amount > 0 &&
      !tx.note?.includes(EARLY_FREE_BET_AWARD_REASON)
    ) {
      await deleteNeonDeskBalanceTransaction(tx.id);
      removedPromo = true;
    }
  }
  return removedPromo;
}

export async function resyncNeonSettledBetAgainstEvent(
  bet: BetRow,
  event: EventRow
): Promise<BetRow | null> {
  const correction = staleSettlementCorrection(bet, event);
  if (!correction) return null;

  await purgeNeonDeskSettlementTransactionsForBet(bet.id);
  const removedPromo = await purgeOutcomeDependentCredits(bet.id);
  await purgeNeonDeskSettlementHistoryForBet(bet.id);
  if (removedPromo) await purgeNeonDeskPromoHistoryForBet(bet.id);

  const settledAt = settlementOccurredAt({
    status: correction.status,
    now: Date.now(),
    event,
    bet,
  });
  const opened = await patchNeonDeskBet(bet.id, {
    status: correction.status,
    actualProfit: correction.profit,
    settledAt,
    notes: correction.notes,
    balanceSettled: 0,
  });
  if (!opened) return null;
  await ledgerNeonBetSettlement(opened);
  return (await getNeonDeskBet(bet.id)) ?? opened;
}

export async function resyncNeonStaleSettlements(
  deskBets: BetRow[],
  events: EventRow[]
): Promise<number> {
  const byId = new Map(events.map((e) => [e.id, e]));
  let n = 0;
  for (const bet of deskBets) {
    if (bet.status === "open" || bet.eventId == null) continue;
    const event = byId.get(bet.eventId);
    if (!event) continue;
    if (await resyncNeonSettledBetAgainstEvent(bet, event)) n += 1;
  }
  return n;
}

/**
 * Hosted equivalent of `autoSettle()`: this desk's open bets against events
 * that already have a result. Does not wait for the leased feed poller, so
 * Profit Tracker can settle when localhost is only reading Neon.
 */
export async function settleOpenNeonDeskBets(
  deskBets: BetRow[],
  events: EventRow[],
  now = Date.now()
): Promise<number> {
  const byId = new Map(events.map((event) => [event.id, event]));
  let n = 0;
  for (const bet of deskBets) {
    if (bet.status !== "open" || bet.eventId == null) continue;
    const event = byId.get(bet.eventId);
    if (!event) continue;
    const outcome = settlementForBetOnEvent(bet, event);
    if (!outcome) continue;
    const settledAt = settlementOccurredAt({
      status: outcome.status,
      now,
      event,
      bet,
    });
    const applied = await settleNeonBet({
      id: bet.id,
      status: outcome.status,
      actualProfit: outcome.profit,
      settledAt,
      notes: outcome.notes,
    });
    if (!applied) continue;
    await ledgerNeonBetSettlement({
      ...bet,
      status: outcome.status,
      actualProfit: outcome.profit,
      settledAt,
      notes: outcome.notes,
    });
    n += 1;
  }
  return n;
}
