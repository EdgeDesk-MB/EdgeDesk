/**
 * Hosted desk rows on Neon (EDGE-47). First slice: bets only.
 * Offers, wallets and history stay on SQLite until the next cutover.
 */
import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { getDeskActor } from "@/lib/db/desk-scope";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteBetRow } from "@/lib/db/neon-desk-map";
import { bets as pgBets } from "@/lib/db/schema.pg";
import type { BetRow } from "@/lib/db/schema";

export { toSqliteBetRow } from "@/lib/db/neon-desk-map";

export type NeonDeskBetValues = {
  eventId?: number | null;
  offerId?: number | null;
  label: string;
  market: string;
  selection: string;
  betType: string;
  bookmaker?: string;
  exchangeId?: number;
  backStake: number;
  backOdds: number;
  layStake: number;
  layOdds: number;
  commission: number;
  earlyPayout: number;
  refundAmount?: number;
  refundRetention?: number;
  legs?: string | null;
  triggerText?: string | null;
  triggerRule?: string | null;
  expectedProfit?: number;
  notes?: string;
  createdAt: number;
  quickLogged?: number | null;
  purpose?: string | null;
  sport?: string | null;
  /** Import rows land pre-settled (EDGE-68): status + profit + flags set. */
  status?: "open" | "won" | "lost" | "void" | "early_payout" | "half_win" | "half_lose" | "push";
  actualProfit?: number;
  settledAt?: number | null;
  source?: string | null;
  balanceLedgered?: number;
  balanceSettled?: number;
  importFingerprint?: string | null;
  importMeta?: string | null;
};

export function neonDeskClerkUserId(): string | null {
  const actor = getDeskActor();
  return actor.neonClerkUserId?.trim() || actor.clerkUserId?.trim() || null;
}

function resolveClerkUserId(explicit?: string | null): string | null {
  const id = explicit?.trim() || neonDeskClerkUserId();
  return id || null;
}

export async function listNeonDeskBets(
  clerkUserId?: string | null
): Promise<BetRow[]> {
  const id = resolveClerkUserId(clerkUserId);
  if (!id) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBets)
    .where(eq(pgBets.clerkUserId, id))
    .orderBy(pgBets.id);
  return rows.map(toSqliteBetRow);
}

/** Bets linked to one campaign — playbook steps must not load the whole desk. */
export async function listNeonDeskBetsForOffer(
  offerId: number,
  clerkUserId?: string | null
): Promise<BetRow[]> {
  const id = resolveClerkUserId(clerkUserId);
  if (!id) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBets)
    .where(and(eq(pgBets.clerkUserId, id), eq(pgBets.offerId, offerId)))
    .orderBy(pgBets.id);
  return rows.map(toSqliteBetRow);
}

/** Offer ids that already have a linked bet — used to hide spent campaigns from Race picks. */
export async function listNeonDeskLinkedOfferIds(
  clerkUserId?: string | null
): Promise<Set<number>> {
  const id = resolveClerkUserId(clerkUserId);
  if (!id) return new Set();
  const rows = await getNeonDb()
    .selectDistinct({ offerId: pgBets.offerId })
    .from(pgBets)
    .where(and(eq(pgBets.clerkUserId, id), isNotNull(pgBets.offerId)));
  return new Set(
    rows.map((row) => row.offerId).filter((offerId): offerId is number => offerId != null)
  );
}

export async function insertNeonDeskBet(
  values: NeonDeskBetValues
): Promise<BetRow> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save a bet.");
  }
  const rows = await getNeonDb()
    .insert(pgBets)
    .values({
      ...values,
      clerkUserId,
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Neon did not return the saved bet.");
  }
  return toSqliteBetRow(row);
}

export async function getNeonDeskBet(id: number): Promise<BetRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const rows = await getNeonDb()
    .select()
    .from(pgBets)
    .where(and(eq(pgBets.id, id), eq(pgBets.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ? toSqliteBetRow(rows[0]) : null;
}

export type NeonDeskBetPatch = Partial<{
  purpose: string | null;
  legs: string | null;
  status: BetRow["status"];
  actualProfit: number | null;
  label: string;
  betType: string;
  bookmaker: string | null;
  exchangeId: number | null;
  backStake: number;
  backOdds: number;
  layStake: number;
  layOdds: number;
  commission: number;
  earlyPayout: number;
  expectedProfit: number | null;
  notes: string | null;
  eventId: number | null;
  sport: string | null;
  market: string;
  selection: string;
  offerId: number | null;
  refundAmount: number | null;
  refundRetention: number | null;
  triggerText: string | null;
  triggerRule: string | null;
  settledAt: number | null;
  balanceLedgered: number;
  balanceSettled: number;
}>;

export async function patchNeonDeskBet(
  id: number,
  patch: NeonDeskBetPatch,
  clerkUserId = neonDeskClerkUserId()
): Promise<BetRow | null> {
  if (!clerkUserId) {
    throw new Error("Sign in to save a bet.");
  }
  const rows = await getNeonDb()
    .update(pgBets)
    .set(patch)
    .where(and(eq(pgBets.id, id), eq(pgBets.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteBetRow(rows[0]) : null;
}

/**
 * One worker wins the right to write placement ledger rows. Dashboard heal
 * and settle-heal can otherwise debit the same open bet twice.
 */
export async function claimNeonBetPlacementLedger(
  id: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  if (!clerkUserId) return false;
  const rows = await getNeonDb()
    .update(pgBets)
    .set({ balanceLedgered: 1 })
    .where(
      and(
        eq(pgBets.id, id),
        eq(pgBets.clerkUserId, clerkUserId),
        eq(pgBets.balanceLedgered, 0)
      )
    )
    .returning({ id: pgBets.id });
  return rows.length > 0;
}

/**
 * One worker wins the right to write settlement ledger rows. Feed sync
 * and dashboard heal can otherwise credit the same win twice.
 */
export async function claimNeonBetSettlementLedger(
  id: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  if (!clerkUserId) return false;
  const rows = await getNeonDb()
    .update(pgBets)
    .set({ balanceSettled: 1 })
    .where(
      and(
        eq(pgBets.id, id),
        eq(pgBets.clerkUserId, clerkUserId),
        eq(pgBets.balanceSettled, 0)
      )
    )
    .returning({ id: pgBets.id });
  return rows.length > 0;
}

/** Deletes one bet for this login. Throws when signed out. */
export async function deleteNeonDeskBet(id: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to delete a bet.");
  }
  const rows = await getNeonDb()
    .delete(pgBets)
    .where(and(eq(pgBets.id, id), eq(pgBets.clerkUserId, clerkUserId)))
    .returning({ id: pgBets.id });
  return rows.length > 0;
}

/** Deletes this login’s bets only. Returns null when nobody is signed in. */
export async function deleteNeonDeskBets(): Promise<number | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const rows = await getNeonDb()
    .delete(pgBets)
    .where(eq(pgBets.clerkUserId, clerkUserId))
    .returning({ id: pgBets.id });
  return rows.length;
}

/** EDGE-68: fingerprints already on the hosted desk, for idempotent import. */
export async function listNeonDeskImportFingerprints(): Promise<Set<string>> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return new Set();
  const rows = await getNeonDb()
    .select({ fingerprint: pgBets.importFingerprint })
    .from(pgBets)
    .where(eq(pgBets.clerkUserId, clerkUserId));
  return new Set(
    rows
      .map((row) => row.fingerprint)
      .filter((value): value is string => Boolean(value))
  );
}
