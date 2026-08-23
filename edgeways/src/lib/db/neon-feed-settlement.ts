/**
 * Neon writes the leased feed poller needs (EDGE-81b, phase 3).
 *
 * The poller is a SYSTEM process, not a signed-in desk: it has just synced
 * global events and may therefore touch every user's open bets on those events.
 * That is why nothing here goes through `neonDeskClerkUserId()` — the owner is
 * carried explicitly on each row so history lands in the right desk.
 */
import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteBetRow } from "@/lib/db/neon-desk-map";
import {
  bets as pgBets,
  history as pgHistory,
} from "@/lib/db/schema.pg";
import type { BetRow, HistoryRow } from "@/lib/db/schema";

export type OwnedBet = {
  bet: BetRow;
  /** Null on rows written before the hosted cutover; they get no history row. */
  clerkUserId: string | null;
};

/** Every user's open bets linked to one of the given global events. */
export async function listOpenNeonBetsForEvents(
  eventIds: number[]
): Promise<OwnedBet[]> {
  if (eventIds.length === 0) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBets)
    .where(
      and(
        eq(pgBets.status, "open"),
        isNotNull(pgBets.eventId),
        inArray(pgBets.eventId, eventIds)
      )
    )
    .orderBy(pgBets.id);
  return rows.map((row) => ({
    bet: toSqliteBetRow(row),
    clerkUserId: row.clerkUserId,
  }));
}

export type NeonBetSettlement = {
  id: number;
  status: BetRow["status"];
  actualProfit: number;
  settledAt: number;
  notes: string | null;
};

/**
 * Settle one hosted bet. Guarded on `status = 'open'` so two pollers that
 * somehow overlap cannot settle the same bet twice; returns false when the row
 * had already moved on.
 */
export async function settleNeonBet(
  settlement: NeonBetSettlement
): Promise<boolean> {
  const rows = await getNeonDb()
    .update(pgBets)
    .set({
      status: settlement.status,
      actualProfit: settlement.actualProfit,
      settledAt: settlement.settledAt,
      notes: settlement.notes,
    })
    .where(and(eq(pgBets.id, settlement.id), eq(pgBets.status, "open")))
    .returning({ id: pgBets.id });
  return rows.length > 0;
}

export type OwnedHistoryValues = {
  clerkUserId: string;
  dedupe: string;
  kind: HistoryRow["kind"];
  eventId?: number | null;
  betId?: number | null;
  minute?: number | null;
  title: string;
  detail?: string | null;
  amount?: number | null;
  createdAt: number;
};

/** Idempotent on `dedupe`, same contract as the desk-scoped writer. */
export async function insertNeonHistoryForOwner(
  values: OwnedHistoryValues
): Promise<void> {
  await getNeonDb()
    .insert(pgHistory)
    .values(values)
    .onConflictDoNothing({ target: pgHistory.dedupe });
}
