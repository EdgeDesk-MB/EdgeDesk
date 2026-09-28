/**
 * Hosted desk history feed on Neon (EDGE-47). Writes are idempotent on the
 * per-user (clerk_user_id, dedupe) natural key (EDGE-99).
 */
import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteHistoryRow } from "@/lib/db/neon-desk-map";
import { history as pgHistory } from "@/lib/db/schema.pg";
import type { EventRow, HistoryRow } from "@/lib/db/schema";
import {
  eventHistoryFacts,
  obsoleteScoreHistoryDedupes,
} from "@/lib/history-event-rows";

export async function listNeonDeskHistoryKeysForEvents(
  eventIds: number[],
  clerkUserId = neonDeskClerkUserId()
): Promise<Array<Pick<HistoryRow, "eventId" | "dedupe">>> {
  if (!clerkUserId || eventIds.length === 0) return [];
  return getNeonDb()
    .select({ eventId: pgHistory.eventId, dedupe: pgHistory.dedupe })
    .from(pgHistory)
    .where(
      and(eq(pgHistory.clerkUserId, clerkUserId), inArray(pgHistory.eventId, eventIds))
    );
}

/** Newest first. `limit: null` reads the whole feed (History pages over all rows). */
export async function listNeonDeskHistory(limit: number | null = 500): Promise<HistoryRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const query = getNeonDb()
    .select()
    .from(pgHistory)
    .where(eq(pgHistory.clerkUserId, clerkUserId))
    .orderBy(desc(pgHistory.createdAt), desc(pgHistory.id));
  const rows = limit == null ? await query : await query.limit(limit);
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
        createdAt: values.createdAt,
      },
    });
}

const SYNC_WRITE_CHUNK = 500;

type ExistingHistoryRow = Pick<HistoryRow, "eventId" | "dedupe"> &
  Partial<Pick<HistoryRow, "title" | "detail" | "amount" | "betId" | "minute" | "createdAt">>;

/** True when a full stored row already holds what an upsert would write. */
function upsertIsNoop(row: ExistingHistoryRow | undefined, values: NeonDeskHistoryValues): boolean {
  if (!row || row.title === undefined) return false;
  return (
    row.title === values.title &&
    (row.detail ?? null) === (values.detail ?? null) &&
    (row.amount ?? null) === (values.amount ?? null) &&
    (row.eventId ?? null) === (values.eventId ?? null) &&
    (row.betId ?? null) === (values.betId ?? null) &&
    (row.minute ?? null) === (values.minute ?? null) &&
    row.createdAt === values.createdAt
  );
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += SYNC_WRITE_CHUNK) {
    out.push(list.slice(i, i + SYNC_WRITE_CHUNK));
  }
  return out;
}

/**
 * Write kick-off / goal / 2UP / full-time rows for this login's desk events.
 * Batched: at most one insert, one upsert and one delete per 500 rows, however
 * many events. Pass full stored rows as `existing` to skip unchanged upserts
 * and stale-tick deletes that would be no-ops. Returns rows written or removed.
 */
export async function syncNeonDeskEventHistory(
  events: EventRow[],
  existing: ExistingHistoryRow[] = [],
  clerkUserId = neonDeskClerkUserId()
): Promise<number> {
  if (!clerkUserId) return 0;
  const now = Date.now();
  const byDedupe = new Map(existing.map((row) => [row.dedupe, row]));
  const dedupesByEvent = new Map<number, string[]>();
  for (const row of existing) {
    if (row.eventId == null) continue;
    const list = dedupesByEvent.get(row.eventId) ?? [];
    list.push(row.dedupe);
    dedupesByEvent.set(row.eventId, list);
  }

  const inserts = new Map<string, NeonDeskHistoryValues>();
  const upserts = new Map<string, NeonDeskHistoryValues>();
  const purges = new Set<string>();
  for (const event of events) {
    const existingDedupes = dedupesByEvent.get(event.id) ?? [];
    const seen = new Set(existingDedupes);
    const facts = eventHistoryFacts(event, now, {
      existingDedupes,
      clerkUserId,
    });
    for (const fact of facts) {
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
        inserts.delete(fact.dedupe);
        if (!upsertIsNoop(byDedupe.get(fact.dedupe), values)) {
          upserts.set(fact.dedupe, values);
        }
        seen.add(fact.dedupe);
        continue;
      }
      if (seen.has(fact.dedupe)) continue;
      inserts.set(fact.dedupe, values);
      seen.add(fact.dedupe);
    }
    for (const dedupe of obsoleteScoreHistoryDedupes(event)) {
      // A stale tick is removed after this event's writes, so it must not land.
      inserts.delete(dedupe);
      upserts.delete(dedupe);
      if (existing.length === 0 || byDedupe.has(dedupe)) purges.add(dedupe);
    }
  }

  const db = getNeonDb();
  for (const batch of chunks([...inserts.values()])) {
    await db
      .insert(pgHistory)
      .values(batch.map((values) => ({ ...values, clerkUserId })))
      .onConflictDoNothing({
        target: [pgHistory.clerkUserId, pgHistory.dedupe],
      });
  }
  for (const batch of chunks([...upserts.values()])) {
    await db
      .insert(pgHistory)
      .values(batch.map((values) => ({ ...values, clerkUserId })))
      .onConflictDoUpdate({
        target: [pgHistory.clerkUserId, pgHistory.dedupe],
        set: {
          title: sql`excluded.title`,
          detail: sql`excluded.detail`,
          amount: sql`excluded.amount`,
          eventId: sql`excluded.event_id`,
          betId: sql`excluded.bet_id`,
          minute: sql`excluded.minute`,
          createdAt: sql`excluded.created_at`,
        },
      });
  }
  for (const batch of chunks([...purges])) {
    await purgeNeonDeskHistoryDedupes(batch, clerkUserId);
  }
  return inserts.size + upserts.size + purges.size;
}

/** Drop leftover nameless score ticks once the tape names that scoreline. */
export async function purgeNeonDeskHistoryDedupes(
  dedupes: string[],
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  if (!clerkUserId || dedupes.length === 0) return;
  await getNeonDb()
    .delete(pgHistory)
    .where(
      and(eq(pgHistory.clerkUserId, clerkUserId), inArray(pgHistory.dedupe, dedupes))
    );
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

export async function purgeNeonDeskPromoHistoryForBet(betId: number): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgHistory)
    .where(
      and(
        eq(pgHistory.betId, betId),
        eq(pgHistory.clerkUserId, clerkUserId),
        eq(pgHistory.kind, "free_bet_promo")
      )
    );
}
