/**
 * FIFO free-bet lots from ledger rows. Pure: no SQLite, no Neon client.
 */
export interface FreeBetLot {
  id: number;
  accountId: number;
  originalAmount: number;
  remaining: number;
  note: string | null;
  createdAt: number;
  betId: number | null;
  /** User-set conversion deadline (epoch ms). Null until set. */
  expiresAt: number | null;
}

export type FreeBetLotTx = {
  id: number;
  accountId: number;
  amount: number;
  category: string | null;
  pending: number;
  note: string | null;
  createdAt: number;
  betId: number | null;
  expiresAt: number | null;
};

const LOT_MARKER_RE = /\[\[lot:(\d+)\]\]/;

export function targetedLotId(note: string | null | undefined): number | null {
  const m = note?.match(LOT_MARKER_RE);
  return m ? Number(m[1]) : null;
}

/**
 * Positive free_bet credits with remaining after later free_bet debits (FIFO).
 * Debits tagged `[[lot:N]]` write off that credit only (used for manual remove).
 *
 * Processed as a single chronological pass, so a debit can only draw down
 * lots that already existed at its own timestamp - an old, over-drawn debit
 * must not reach forward and silently eat a credit added afterwards.
 */
export function listFreeBetLotsFromTransactions(
  accountId: number,
  txs: ReadonlyArray<FreeBetLotTx>
): FreeBetLot[] {
  const rows = txs
    .filter((t) => t.accountId === accountId && t.category === "free_bet" && !t.pending)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);

  const lots: Array<FreeBetLot & { _left: number }> = [];

  for (const t of rows) {
    if (t.amount > 0) {
      lots.push({
        id: t.id,
        accountId,
        originalAmount: t.amount,
        remaining: t.amount,
        note: t.note,
        createdAt: t.createdAt,
        betId: t.betId,
        expiresAt: t.expiresAt ?? null,
        _left: t.amount,
      });
      continue;
    }
    if (t.amount >= 0) continue;

    let need = -t.amount;
    const targetId = targetedLotId(t.note);
    if (targetId != null) {
      const lot = lots.find((l) => l.id === targetId);
      if (lot) {
        const take = Math.min(lot._left, need);
        lot._left -= take;
        continue;
      }
      // Hosted conversions were tagged with SQLite lot ids. A missing
      // target must still draw down lots that already existed, same as
      // an untagged debit.
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

export function sumFreeBetLotBalanceFromTransactions(
  accountId: number,
  txs: ReadonlyArray<FreeBetLotTx>
): number {
  const total = listFreeBetLotsFromTransactions(accountId, txs).reduce(
    (sum, lot) => sum + lot.remaining,
    0
  );
  return Math.round(total * 100) / 100;
}

export function freeBetBalanceByAccountFromTransactions(
  accounts: ReadonlyArray<{ id: number; type: string }>,
  txs: ReadonlyArray<FreeBetLotTx>
): Record<number, number> {
  const map: Record<number, number> = {};
  for (const account of accounts) {
    if (account.type !== "bookie") continue;
    const fb = sumFreeBetLotBalanceFromTransactions(account.id, txs);
    if (fb > 0) map[account.id] = fb;
  }
  return map;
}
