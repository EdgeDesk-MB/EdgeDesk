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
 *
 * Processed as a single chronological pass, so a debit can only draw down
 * lots that already existed at its own timestamp - an old, over-drawn debit
 * must not reach forward and silently eat a credit added afterwards.
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

/** True when the credit is a promo award (not a void restore / manual top-up). */
export function isPromoFreeBetLot(lot: Pick<FreeBetLot, "note">): boolean {
  return Boolean(lot.note?.includes("Free bet promo"));
}

/**
 * Pick which open lot a free-bet stake should draw down.
 *
 * Prefer promo credits tied to the same offer (via preferBetIds), then the
 * newest promo credit on the account, then the newest open lot. Pure FIFO
 * left stale void-restore lots in place while newer awards were "spent"
 * against the wrong credit (Ivybet Regal Desire resurfacing).
 *
 * When `stake` is set, only return a lot that can cover it in full — a
 * `[[lot:N]]` debit cannot overflow to the next lot, so undersized targets
 * must fall back to untagged FIFO instead.
 */
export function selectFreeBetLotForUsage(
  accountId: number,
  opts?: { preferBetIds?: Iterable<number>; stake?: number }
): FreeBetLot | null {
  const lots = listFreeBetLots(accountId).filter((l) => l.remaining > 0.001);
  if (lots.length === 0) return null;

  const covers = (lot: FreeBetLot): boolean =>
    opts?.stake == null || lot.remaining + 0.001 >= opts.stake;

  const firstCovering = (candidates: FreeBetLot[]): FreeBetLot | null => {
    for (const lot of candidates) {
      if (covers(lot)) return lot;
    }
    return null;
  };

  const prefer = opts?.preferBetIds ? new Set(opts.preferBetIds) : null;
  if (prefer && prefer.size > 0) {
    const sameOffer = lots.filter((l) => l.betId != null && prefer.has(l.betId));
    const samePromo = firstCovering(
      sameOffer
        .filter(isPromoFreeBetLot)
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    );
    if (samePromo) return samePromo;
    const sameNewest = firstCovering(
      [...sameOffer].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    );
    if (sameNewest) return sameNewest;
  }

  const promo = firstCovering(
    lots
      .filter(isPromoFreeBetLot)
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  );
  if (promo) return promo;

  return firstCovering(
    [...lots].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  );
}

/** Note for a free-bet usage debit that targets a specific lot. */
export function freeBetUsageNote(label: string, lotId: number | null | undefined): string {
  const clean = label.trim() || "Free bet";
  if (lotId == null) return `Free bet used - ${clean}`;
  return `Free bet used - [[lot:${lotId}]] ${clean}`;
}
