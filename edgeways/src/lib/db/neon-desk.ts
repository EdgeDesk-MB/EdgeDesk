/**
 * Hosted desk rows on Neon (EDGE-47). First slice: bets only.
 * Offers, wallets and history stay on SQLite until the next cutover.
 */
import "server-only";

import { eq } from "drizzle-orm";
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
