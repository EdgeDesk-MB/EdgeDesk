/**
 * Free-bet "lots" - FIFO remaining from promo / manual free-bet credits.
 *
 * Do not import `@/lib/services/quiet-alerts` here. This module is pulled into
 * `/api/state` via daily-tasks-digest; a missing quiet* export then fails the
 * whole app. Dismiss expiring alerts from `api/accounts/free-bets`.
 */
import { eq } from "drizzle-orm";
import { accounts, balanceTransactions, db } from "@/lib/db";
import {
  listFreeBetLots,
  sumFreeBetLotBalance,
  type FreeBetLot,
} from "@/lib/accounts/free-bet-lot-balance";
import { freeBetRemoveNote } from "@/lib/accounts/free-bet-lot-math";
import { recordManualTransaction } from "@/lib/services/balances";

export type { FreeBetLot };
export { listFreeBetLots, sumFreeBetLotBalance };

export function listAllOpenFreeBetLots(): Array<FreeBetLot & { accountName: string }> {
  const bookies = db
    .select()
    .from(accounts)
    .all()
    .filter((a) => a.type === "bookie" && a.isActive);

  const out: Array<FreeBetLot & { accountName: string }> = [];
  for (const a of bookies) {
    for (const lot of listFreeBetLots(a.id)) {
      out.push({ ...lot, accountName: a.name });
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Write off remaining balance on a free-bet lot (audit debit). */
export function removeFreeBetLot(lotId: number): FreeBetLot {
  const credit = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.id, lotId))
    .get();
  if (!credit || credit.category !== "free_bet" || credit.amount <= 0) {
    throw new Error("Free bet not found");
  }

  const lot = listFreeBetLots(credit.accountId).find((l) => l.id === lotId);
  if (!lot || lot.remaining <= 0.001) {
    throw new Error("Free bet already used or removed");
  }

  recordManualTransaction(
    credit.accountId,
    -lot.remaining,
    "free_bet",
    freeBetRemoveNote(lotId, lot.note)
  );
  return { ...lot, remaining: 0 };
}

/** Set or clear the conversion deadline on an open free-bet credit. */
export function setFreeBetLotExpiry(lotId: number, expiresAt: number | null): FreeBetLot {
  const credit = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.id, lotId))
    .get();
  if (!credit || credit.category !== "free_bet" || credit.amount <= 0) {
    throw new Error("Free bet not found");
  }

  const lot = listFreeBetLots(credit.accountId).find((l) => l.id === lotId);
  if (!lot || lot.remaining <= 0.001) {
    throw new Error("Free bet already used or removed");
  }

  const next =
    expiresAt == null
      ? null
      : Number.isFinite(expiresAt)
        ? Math.round(expiresAt)
        : null;
  if (expiresAt != null && next == null) {
    throw new Error("Invalid expiry");
  }

  db.update(balanceTransactions)
    .set({ expiresAt: next })
    .where(eq(balanceTransactions.id, lotId))
    .run();
  return { ...lot, expiresAt: next };
}
