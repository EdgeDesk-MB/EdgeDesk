/**
 * FIFO free-bet lot balance — shared by ledger summary and account modal.
 */
import { eq } from "drizzle-orm";
import { balanceTransactions, db } from "@/lib/db";

export interface FreeBetLot {
  id: number;
  accountId: number;
  originalAmount: number;
  remaining: number;
  note: string | null;
  createdAt: number;
  betId: number | null;
}

const LOT_MARKER_RE = /\[\[lot:(\d+)\]\]/;

export function targetedLotId(note: string | null | undefined): number | null {
  const m = note?.match(LOT_MARKER_RE);
  return m ? Number(m[1]) : null;
}

/**
 * Positive free_bet credits with remaining after later free_bet debits (FIFO).
 * Debits tagged `[[lot:N]]` write off that credit only (used for manual remove).
 */
export function listFreeBetLots(accountId: number): FreeBetLot[] {
  const txs = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .all()
    .filter((t) => t.category === "free_bet" && !t.pending)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);

  const lots: Array<FreeBetLot & { _left: number }> = [];
  const debits: typeof txs = [];

  for (const t of txs) {
    if (t.amount > 0) {
      lots.push({
        id: t.id,
        accountId,
        originalAmount: t.amount,
        remaining: t.amount,
        note: t.note,
        createdAt: t.createdAt,
        betId: t.betId,
        _left: t.amount,
      });
    } else if (t.amount < 0) {
      debits.push(t);
    }
  }

  for (const t of debits) {
    let need = -t.amount;
    const targetId = targetedLotId(t.note);
    if (targetId != null) {
      const lot = lots.find((l) => l.id === targetId);
      if (lot) {
        const take = Math.min(lot._left, need);
        lot._left -= take;
      }
      continue;
    }
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot._left <= 0) continue;
      const take = Math.min(lot._left, need);
      lot._left -= take;
      need -= take;
    }
  }

  return lots
    .filter((l) => l._left > 0.001)
    .map(({ _left, ...lot }) => ({
      ...lot,
      remaining: Math.round(_left * 100) / 100,
    }));
}

/** Open free-bet balance from FIFO lots (matches account modal + table). */
export function sumFreeBetLotBalance(accountId: number): number {
  const total = listFreeBetLots(accountId).reduce((sum, lot) => sum + lot.remaining, 0);
  return Math.round(total * 100) / 100;
}
