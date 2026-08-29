/**
 * Hosted desk wallets on Neon (EDGE-47): accounts plus the balance ledger.
 * Transfers and pending-credit confirmation write here too. Promo free-bet
 * credits live on this ledger; FIFO lots are derived from the rows.
 */
import "server-only";

import { and, eq, lt, or } from "drizzle-orm";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { insertNeonDeskHistory } from "@/lib/db/neon-desk-history";
import {
  toSqliteAccountRow,
  toSqliteBalanceTransactionRow,
  toSqliteExchangeRow,
} from "@/lib/db/neon-desk-map";
import { historyNoteFromManualTx } from "@/lib/services/balances-manual-note";
import {
  accounts as pgAccounts,
  balanceTransactions as pgBalanceTransactions,
  bets as pgBets,
  exchanges as pgExchanges,
  offers as pgOffers,
} from "@/lib/db/schema.pg";
import type { AccountRow, BalanceTransactionRow, ExchangeRow } from "@/lib/db/schema";

let neonExchangesSeeded = false;

/** Shared catalog of exchange brands. Commission is overlaid per desk. */
export async function ensureNeonExchanges(): Promise<void> {
  if (neonExchangesSeeded) return;
  const db = getNeonDb();
  const existing = await db
    .select({ id: pgExchanges.id })
    .from(pgExchanges)
    .limit(1);
  if (existing.length === 0) {
    const now = Date.now();
    await db
      .insert(pgExchanges)
      .values(
        EXCHANGE_PRESETS.map((p, i) => ({
          name: p.name,
          commissionPct: p.commissionPct,
          brandColor: p.brandColor,
          backColor: p.backColor,
          layColor: p.layColor,
          isDefault: i === 0 ? 1 : 0,
          createdAt: now,
        }))
      )
      .onConflictDoNothing();
  }
  neonExchangesSeeded = true;
}

export async function listNeonExchanges(): Promise<ExchangeRow[]> {
  await ensureNeonExchanges();
  const rows = await getNeonDb().select().from(pgExchanges).orderBy(pgExchanges.id);
  return rows.map(toSqliteExchangeRow);
}

export async function insertNeonExchange(input: {
  name: string;
  commissionPct: number;
  brandColor: string;
  backColor: string;
  layColor: string;
  isDefault: boolean;
}): Promise<ExchangeRow> {
  await ensureNeonExchanges();
  const db = getNeonDb();
  if (input.isDefault) {
    await db.update(pgExchanges).set({ isDefault: 0 });
  }
  const rows = await db
    .insert(pgExchanges)
    .values({
      name: input.name,
      commissionPct: input.commissionPct,
      brandColor: input.brandColor,
      backColor: input.backColor,
      layColor: input.layColor,
      isDefault: input.isDefault ? 1 : 0,
      createdAt: Date.now(),
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Neon did not return the saved exchange.");
  return toSqliteExchangeRow(row);
}

export async function neonExchangeExists(id: number): Promise<boolean> {
  await ensureNeonExchanges();
  const rows = await getNeonDb()
    .select({ id: pgExchanges.id })
    .from(pgExchanges)
    .where(eq(pgExchanges.id, id))
    .limit(1);
  return rows.length > 0;
}

export type NeonDeskAccountValues = {
  name: string;
  type: "bookie" | "exchange" | "bank";
  exchangeId?: number | null;
  fundedByAccountId?: number | null;
  brandColor?: string | null;
  isActive?: number;
  createdAt: number;
};

export async function listNeonDeskAccounts(
  clerkUserId = neonDeskClerkUserId()
): Promise<AccountRow[]> {
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgAccounts)
    .where(eq(pgAccounts.clerkUserId, clerkUserId))
    .orderBy(pgAccounts.id);
  return rows.map(toSqliteAccountRow);
}

export async function insertNeonDeskAccount(
  values: NeonDeskAccountValues,
  clerkUserId = neonDeskClerkUserId()
): Promise<AccountRow> {
  if (!clerkUserId) {
    throw new Error("Sign in to save an account.");
  }
  const rows = await getNeonDb()
    .insert(pgAccounts)
    .values({ ...values, clerkUserId })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Neon did not return the saved account.");
  }
  return toSqliteAccountRow(row);
}

export type NeonDeskAccountPatch = Partial<{
  isActive: number;
  brandColor: string;
  exchangeId: number | null;
  accessStatus: "available" | "gubbed" | "closed";
  owner: string;
  notes: string | null;
  fundedByAccountId: number | null;
  wrRemaining: number;
  wrMinOdds: number | null;
  wrType: "stake" | "risk_win";
  health: "cooling" | null;
  healthUpdatedAt: number;
  name: string;
}>;

export async function patchNeonDeskAccount(
  id: number,
  patch: NeonDeskAccountPatch,
  clerkUserId = neonDeskClerkUserId()
): Promise<AccountRow | null> {
  if (!clerkUserId) {
    throw new Error("Sign in to save an account.");
  }
  const rows = await getNeonDb()
    .update(pgAccounts)
    .set(patch)
    .where(and(eq(pgAccounts.id, id), eq(pgAccounts.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteAccountRow(rows[0]) : null;
}

export async function listNeonDeskBalanceTransactions(
  clerkUserId = neonDeskClerkUserId()
): Promise<BalanceTransactionRow[]> {
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBalanceTransactions)
    .where(eq(pgBalanceTransactions.clerkUserId, clerkUserId))
    .orderBy(pgBalanceTransactions.id);
  return rows.map(toSqliteBalanceTransactionRow);
}

/**
 * Hosted rename with a mini cascade: bets and offers reference the venue by
 * name string, so they move with the account (mirrors renameVenueAccount).
 */
export async function renameNeonDeskAccount(
  id: number,
  name: string
): Promise<{ account: AccountRow | null; betsUpdated: number; offersUpdated: number }> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save an account.");
  }
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required.");

  const db = getNeonDb();
  const existing = await db
    .select()
    .from(pgAccounts)
    .where(and(eq(pgAccounts.id, id), eq(pgAccounts.clerkUserId, clerkUserId)))
    .limit(1);
  const current = existing[0];
  if (!current) return { account: null, betsUpdated: 0, offersUpdated: 0 };
  const oldName = current.name;

  const updated = await db
    .update(pgAccounts)
    .set({ name: trimmed })
    .where(and(eq(pgAccounts.id, id), eq(pgAccounts.clerkUserId, clerkUserId)))
    .returning();

  let betsUpdated = 0;
  let offersUpdated = 0;
  if (oldName !== trimmed) {
    const betRows = await db
      .update(pgBets)
      .set({ bookmaker: trimmed })
      .where(and(eq(pgBets.clerkUserId, clerkUserId), eq(pgBets.bookmaker, oldName)))
      .returning({ id: pgBets.id });
    betsUpdated = betRows.length;
    const offerRows = await db
      .update(pgOffers)
      .set({ bookmaker: trimmed })
      .where(and(eq(pgOffers.clerkUserId, clerkUserId), eq(pgOffers.bookmaker, oldName)))
      .returning({ id: pgOffers.id });
    offersUpdated = offerRows.length;
  }

  return {
    account: updated[0] ? toSqliteAccountRow(updated[0]) : null,
    betsUpdated,
    offersUpdated,
  };
}

export async function recordNeonManualTransaction(input: {
  account: AccountRow;
  amount: number;
  category: "top_up" | "withdrawal" | "adjustment" | "free_bet";
  note?: string;
  affectPnl?: boolean;
}): Promise<void> {
  const now = Date.now();
  const note = input.note ?? input.category.replace("_", " ");
  await insertNeonDeskTransaction({
    accountId: input.account.id,
    amount: input.amount,
    category: input.category,
    note,
    affectPnl: input.affectPnl ? 1 : 0,
    createdAt: now,
  });

  if (
    input.affectPnl &&
    input.amount !== 0 &&
    (input.category === "adjustment" || input.category === "top_up")
  ) {
    const isTopUp = input.category === "top_up";
    const sign = input.amount > 0 ? "+" : "";
    const formattedAmount = `${sign}GBP ${Math.abs(input.amount).toFixed(2)}`;
    await insertNeonDeskHistory({
      dedupe: `${isTopUp ? "topup" : "adj"}:${input.account.id}:${now}`,
      kind: "balance_adjustment",
      title: isTopUp ? "Top-up" : "Balance correction",
      detail: `${input.account.name} - ${formattedAmount}`,
      note: historyNoteFromManualTx(input.note, input.category),
      amount: input.amount,
      createdAt: now,
    });
  }
}

export type NeonDeskTransactionValues = {
  accountId: number;
  amount: number;
  category: BalanceTransactionRow["category"];
  betId?: number | null;
  casinoOfferId?: number | null;
  affectPnl?: number;
  note?: string | null;
  createdAt: number;
  pending?: number;
  transferGroupId?: string | null;
  confirmedAt?: number | null;
};

export async function insertNeonDeskTransaction(
  values: NeonDeskTransactionValues,
  clerkUserId = neonDeskClerkUserId()
): Promise<BalanceTransactionRow> {
  if (!clerkUserId) {
    throw new Error("Sign in to save a transaction.");
  }
  const rows = await getNeonDb()
    .insert(pgBalanceTransactions)
    .values({ ...values, clerkUserId })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Neon did not return the saved transaction.");
  }
  return toSqliteBalanceTransactionRow(row);
}

export async function purgeNeonDeskTransactionsForBet(
  betId: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgBalanceTransactions)
    .where(
      and(
        eq(pgBalanceTransactions.betId, betId),
        eq(pgBalanceTransactions.clerkUserId, clerkUserId)
      )
    );
}

/** Drop cash stake / free-bet usage debits so an open bet can be re-ledgered. */
export async function purgeNeonDeskPlacementTransactionsForBet(
  betId: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgBalanceTransactions)
    .where(
      and(
        eq(pgBalanceTransactions.betId, betId),
        eq(pgBalanceTransactions.clerkUserId, clerkUserId),
        or(
          eq(pgBalanceTransactions.category, "bet_stake"),
          and(
            eq(pgBalanceTransactions.category, "free_bet"),
            lt(pgBalanceTransactions.amount, 0)
          )
        )
      )
    );
}

/** Drop settlement credits so a reopened hosted bet can re-ledger cleanly. */
export async function purgeNeonDeskSettlementTransactionsForBet(
  betId: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgBalanceTransactions)
    .where(
      and(
        eq(pgBalanceTransactions.betId, betId),
        eq(pgBalanceTransactions.clerkUserId, clerkUserId),
        eq(pgBalanceTransactions.category, "bet_settlement")
      )
    );
}

export async function listNeonPendingTransactions(limit = 50) {
  const rows = await listNeonDeskBalanceTransactions();
  return rows
    .filter((t) => t.pending)
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    .slice(0, limit);
}

export async function confirmNeonPendingTransaction(txId: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to confirm a transfer.");
  }
  const rows = await getNeonDb()
    .update(pgBalanceTransactions)
    .set({ pending: 0, confirmedAt: Date.now() })
    .where(
      and(
        eq(pgBalanceTransactions.id, txId),
        eq(pgBalanceTransactions.clerkUserId, clerkUserId),
        eq(pgBalanceTransactions.pending, 1)
      )
    )
    .returning({ id: pgBalanceTransactions.id });
  return rows.length > 0;
}

export async function transferNeonBetweenAccounts(input: {
  bankAccountId: number;
  venueAccountId: number;
  amount: number;
  direction: "to_venue" | "to_bank";
  fee?: number;
  note?: string;
  pendingBankCredit?: boolean;
}): Promise<{ transferGroupId: string }> {
  const amount = Math.abs(input.amount);
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const accounts = await listNeonDeskAccounts();
  const bank = accounts.find((a) => a.id === input.bankAccountId);
  const venue = accounts.find((a) => a.id === input.venueAccountId);
  if (!bank || !bank.isActive || bank.type !== "bank") {
    throw new Error("Bank account not found");
  }
  if (!venue || !venue.isActive || (venue.type !== "bookie" && venue.type !== "exchange")) {
    throw new Error("Bookie/exchange account not found");
  }

  const fee = Math.max(0, input.fee ?? 0);
  if (fee >= amount && input.direction === "to_bank") {
    throw new Error("Fee must be less than withdrawal amount");
  }

  const groupId = `xfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const noteBase = input.note?.trim();
  const now = Date.now();

  if (input.direction === "to_venue") {
    await insertNeonDeskTransaction({
      accountId: bank.id,
      amount: -amount,
      category: "transfer",
      note: noteBase ?? `Deposit to ${venue.name}`,
      transferGroupId: groupId,
      createdAt: now,
    });
    if (fee > 0) {
      await insertNeonDeskTransaction({
        accountId: bank.id,
        amount: -fee,
        category: "fee",
        note: "Deposit fee",
        transferGroupId: groupId,
        createdAt: now,
      });
    }
    await insertNeonDeskTransaction({
      accountId: venue.id,
      amount,
      category: "transfer",
      note: noteBase ?? `Deposit from ${bank.name}`,
      transferGroupId: groupId,
      createdAt: now,
    });
  } else {
    const pending = input.pendingBankCredit !== false;
    const net = amount - fee;
    await insertNeonDeskTransaction({
      accountId: venue.id,
      amount: -amount,
      category: "transfer",
      note: noteBase ?? `Withdraw to ${bank.name}`,
      transferGroupId: groupId,
      createdAt: now,
    });
    await insertNeonDeskTransaction({
      accountId: bank.id,
      amount: net,
      category: "transfer",
      note: noteBase
        ? `${noteBase}${fee > 0 ? ` (−£${fee.toFixed(2)} fee)` : ""}`
        : `Withdraw from ${venue.name}${fee > 0 ? ` (−£${fee.toFixed(2)} fee)` : ""}`,
      transferGroupId: groupId,
      pending: pending ? 1 : 0,
      createdAt: now,
    });
  }

  return { transferGroupId: groupId };
}
