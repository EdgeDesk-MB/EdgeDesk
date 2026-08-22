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
};

export function neonDeskClerkUserId(): string | null {
  return getDeskActor().clerkUserId?.trim() || null;
}

export async function listNeonDeskBets(): Promise<BetRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBets)
    .where(eq(pgBets.clerkUserId, clerkUserId))
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
