/**
 * Hosted desk history feed on Neon (EDGE-47). Writes are idempotent on the
 * per-user (clerk_user_id, dedupe) natural key (EDGE-99).
 */
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteHistoryRow } from "@/lib/db/neon-desk-map";
import { history as pgHistory } from "@/lib/db/schema.pg";
import type { EventRow, HistoryRow } from "@/lib/db/schema";
import { eventHistoryFacts } from "@/lib/history-event-rows";

export async function listNeonDeskHistory(limit = 500): Promise<HistoryRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgHistory)
    .where(eq(pgHistory.clerkUserId, clerkUserId))
    .orderBy(desc(pgHistory.createdAt), desc(pgHistory.id))
    .limit(limit);
  return rows.map(toSqliteHistoryRow);
}

export type NeonDeskHistoryValues = {
  dedupe: string;
  kind: HistoryRow["kind"];
  eventId?: number | null;
  betId?: number | null;
  minute?: number | null;
  title: string;
  detail?: string | null;
  note?: string | null;
  amount?: number | null;
  createdAt: number;
};

/** Idempotent: a re-fired dedupe key is a no-op. */
export async function insertNeonDeskHistory(
  values: NeonDeskHistoryValues,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId) return;
  await getNeonDb()
    .insert(pgHistory)
    .values({ ...values, clerkUserId })
    .onConflictDoNothing({
      target: [pgHistory.clerkUserId, pgHistory.dedupe],
    });
}

/** Insert or refresh title/detail when the tape later names the scorer. */
export async function upsertNeonDeskHistory(
  values: NeonDeskHistoryValues,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId) return;
  await getNeonDb()
    .insert(pgHistory)
    .values({ ...values, clerkUserId })
    .onConflictDoUpdate({
      target: [pgHistory.clerkUserId, pgHistory.dedupe],
      set: {
        title: values.title,
        detail: values.detail ?? null,
        amount: values.amount ?? null,
        eventId: values.eventId ?? null,
        betId: values.betId ?? null,
        minute: values.minute ?? null,
      },
    });
}

/** Write kick-off / goal / 2UP / full-time rows for this login's desk events. */
export async function syncNeonDeskEventHistory(
  events: EventRow[],
  existing: HistoryRow[] = [],
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId) return;
  const now = Date.now();
  const dedupesByEvent = new Map<number, string[]>();
  for (const row of existing) {
    if (row.eventId == null) continue;
    const list = dedupesByEvent.get(row.eventId) ?? [];
    list.push(row.dedupe);
    dedupesByEvent.set(row.eventId, list);
  }
  for (const event of events) {
    const existingDedupes = dedupesByEvent.get(event.id) ?? [];
    const seen = new Set(existingDedupes);
    const facts = eventHistoryFacts(event, now, {
      existingDedupes,
      clerkUserId,
    });
    for (const fact of facts) {
      if (seen.has(fact.dedupe)) continue;
      const values: NeonDeskHistoryValues = {
        dedupe: fact.dedupe,
        kind: fact.kind,
        eventId: fact.eventId,
        minute: fact.minute,
        title: fact.title,
        detail: fact.detail,
        createdAt: fact.createdAt,
      };
      if (fact.write === "upsert") {
        await upsertNeonDeskHistory(values, clerkUserId);
      } else {
        await insertNeonDeskHistory(values, clerkUserId);
      }
      seen.add(fact.dedupe);
    }
  }
}

/** Edit a balance-correction note. Clerk-scoped. */
export async function patchNeonDeskHistoryNote(
  id: number,
  note: string | null
): Promise<HistoryRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save a note.");
  }
  const next = note?.trim() ? note.trim() : null;
  const rows = await getNeonDb()
    .update(pgHistory)
    .set({ note: next })
    .where(
      and(
        eq(pgHistory.id, id),
        eq(pgHistory.clerkUserId, clerkUserId),
        eq(pgHistory.kind, "balance_adjustment")
      )
    )
    .returning();
  return rows[0] ? toSqliteHistoryRow(rows[0]) : null;
}

/** Drop feed rows for a deleted hosted bet. Clerk-scoped. */
export async function purgeNeonDeskHistoryForBet(betId: number): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgHistory)
    .where(and(eq(pgHistory.betId, betId), eq(pgHistory.clerkUserId, clerkUserId)));
}

/** Drop settlement rows so a result correction can re-settle this login's bet. */
export async function purgeNeonDeskSettlementHistoryForBet(
  betId: number
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgHistory)
    .where(
      and(
        eq(pgHistory.betId, betId),
        eq(pgHistory.clerkUserId, clerkUserId),
        eq(pgHistory.kind, "settlement")
      )
    );
}
