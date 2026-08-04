/**
 * Free-bet "lots" - FIFO remaining from promo / manual free-bet credits.
 */
import { eq } from "drizzle-orm";
import { accounts, balanceTransactions, db } from "@/lib/db";
import {
  listFreeBetLots,
  sumFreeBetLotBalance,
  type FreeBetLot,
} from "@/lib/accounts/free-bet-lot-balance";
import { recordManualTransaction } from "@/lib/services/balances";

export type { FreeBetLot };
export { listFreeBetLots, sumFreeBetLotBalance };

const LOT_MARKER_RE = /\[\[lot:(\d+)\]\]/;

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

  const label =
    lot.note
      ?.replace(/^Free bet promo - /, "")
      .replace(/^Free bet removed - /, "")
      .replace(LOT_MARKER_RE, "")
      .trim() || "Free bet";
  recordManualTransaction(
    credit.accountId,
    -lot.remaining,
    "free_bet",
    `Free bet removed - [[lot:${lotId}]] ${label}`
  );
  return { ...lot, remaining: 0 };
}
