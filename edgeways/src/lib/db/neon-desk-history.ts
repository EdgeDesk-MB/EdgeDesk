/**
 * Hosted desk history feed on Neon (EDGE-47). Writes are idempotent on the
 * `dedupe` natural key, same as the SQLite path.
 */
import "server-only";

import { desc, eq } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteHistoryRow } from "@/lib/db/neon-desk-map";
import { history as pgHistory } from "@/lib/db/schema.pg";
import type { HistoryRow } from "@/lib/db/schema";

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
  values: NeonDeskHistoryValues
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .insert(pgHistory)
    .values({ ...values, clerkUserId })
    .onConflictDoNothing({ target: pgHistory.dedupe });
}
