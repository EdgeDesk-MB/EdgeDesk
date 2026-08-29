/**
 * Hosted free-bet lots: FIFO remaining from Neon ledger rows, plus remove
 * and expiry writes. Mirrors src/lib/accounts/free-bet-lots.ts.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import {
  freeBetRemoveNote,
  listFreeBetLotsFromTransactions,
  type FreeBetLot,
} from "@/lib/accounts/free-bet-lot-math";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import {
  insertNeonDeskTransaction,
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
} from "@/lib/db/neon-desk-accounts";
import { balanceTransactions as pgBalanceTransactions } from "@/lib/db/schema.pg";

export async function listNeonOpenFreeBetLots(): Promise<
  Array<FreeBetLot & { accountName: string }>
> {
  const [accounts, txs] = await Promise.all([
    listNeonDeskAccounts(),
    listNeonDeskBalanceTransactions(),
  ]);
  const out: Array<FreeBetLot & { accountName: string }> = [];
  for (const account of accounts) {
    if (account.type !== "bookie" || !account.isActive) continue;
    for (const lot of listFreeBetLotsFromTransactions(account.id, txs)) {
      out.push({ ...lot, accountName: account.name });
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
}

export async function removeNeonFreeBetLot(lotId: number): Promise<FreeBetLot> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error("Sign in to remove a free bet.");

  const txs = await listNeonDeskBalanceTransactions(clerkUserId);
  const credit = txs.find((t) => t.id === lotId);
  if (!credit || credit.category !== "free_bet" || credit.amount <= 0) {
    throw new Error("Free bet not found");
  }

  const lot = listFreeBetLotsFromTransactions(credit.accountId, txs).find(
    (l) => l.id === lotId
  );
  if (!lot || lot.remaining <= 0.001) {
    throw new Error("Free bet already used or removed");
  }

  await insertNeonDeskTransaction(
    {
      accountId: credit.accountId,
      amount: -lot.remaining,
      category: "free_bet",
      note: freeBetRemoveNote(lotId, lot.note),
      createdAt: Date.now(),
    },
    clerkUserId
  );
  return { ...lot, remaining: 0 };
}

export async function setNeonFreeBetLotExpiry(
  lotId: number,
  expiresAt: number | null
): Promise<FreeBetLot> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error("Sign in to set a free-bet expiry.");

  const next =
    expiresAt == null
      ? null
      : Number.isFinite(expiresAt)
        ? Math.round(expiresAt)
        : null;
  if (expiresAt != null && next == null) {
    throw new Error("Invalid expiry");
  }

  const txs = await listNeonDeskBalanceTransactions(clerkUserId);
  const credit = txs.find((t) => t.id === lotId);
  if (!credit || credit.category !== "free_bet" || credit.amount <= 0) {
    throw new Error("Free bet not found");
  }

  const lot = listFreeBetLotsFromTransactions(credit.accountId, txs).find(
    (l) => l.id === lotId
  );
  if (!lot || lot.remaining <= 0.001) {
    throw new Error("Free bet already used or removed");
  }

  const rows = await getNeonDb()
    .update(pgBalanceTransactions)
    .set({ expiresAt: next })
    .where(
      and(
        eq(pgBalanceTransactions.id, lotId),
        eq(pgBalanceTransactions.clerkUserId, clerkUserId)
      )
    )
    .returning();
  if (!rows[0]) throw new Error("Free bet not found");
  return { ...lot, expiresAt: next };
}
