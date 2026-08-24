/**
 * Hosted desk wallets on Neon (EDGE-47): accounts plus the balance ledger.
 * Free-bet lots, transfers and pending-credit workflows stay SQLite-only until
 * their own cutover.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import {
  toSqliteAccountRow,
  toSqliteBalanceTransactionRow,
} from "@/lib/db/neon-desk-map";
import {
  accounts as pgAccounts,
  balanceTransactions as pgBalanceTransactions,
  bets as pgBets,
  exchanges as pgExchanges,
  offers as pgOffers,
} from "@/lib/db/schema.pg";
import type { AccountRow, BalanceTransactionRow } from "@/lib/db/schema";

let neonExchangesSeeded = false;

/** Exchanges are global reference data (not user-scoped); seed presets once. */
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

export async function listNeonDeskAccounts(): Promise<AccountRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgAccounts)
    .where(eq(pgAccounts.clerkUserId, clerkUserId))
    .orderBy(pgAccounts.id);
  return rows.map(toSqliteAccountRow);
}

export async function insertNeonDeskAccount(
  values: NeonDeskAccountValues
): Promise<AccountRow> {
  const clerkUserId = neonDeskClerkUserId();
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
  patch: NeonDeskAccountPatch
): Promise<AccountRow | null> {
  const clerkUserId = neonDeskClerkUserId();
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

export async function listNeonDeskBalanceTransactions(): Promise<
  BalanceTransactionRow[]
> {  const clerkUserId = neonDeskClerkUserId();
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

export type NeonDeskTransactionValues = {  accountId: number;
  amount: number;
  category: BalanceTransactionRow["category"];
  betId?: number | null;
  casinoOfferId?: number | null;
  affectPnl?: number;
  note?: string | null;
  createdAt: number;
};

export async function insertNeonDeskTransaction(
  values: NeonDeskTransactionValues
): Promise<BalanceTransactionRow> {
  const clerkUserId = neonDeskClerkUserId();
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
