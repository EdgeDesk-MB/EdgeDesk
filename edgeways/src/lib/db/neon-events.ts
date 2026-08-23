/**
 * Global Neon feed events (EDGE-81b).
 *
 * The `events` table is feed data shared by every hosted desk, not per-login
 * desk data, so nothing here filters on `clerk_user_id` — see the same note in
 * `neon-desk-backup.ts`. Reads serve the hosted Home snapshot; writes come from
 * the leased feed poller only.
 */
import "server-only";

import { eq, inArray } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteEventRow } from "@/lib/db/neon-desk-map";
import { events as pgEvents } from "@/lib/db/schema.pg";
import type { EventRow } from "@/lib/db/schema";

export async function listNeonEvents(): Promise<EventRow[]> {
  const rows = await getNeonDb().select().from(pgEvents).orderBy(pgEvents.startTime);
  return rows.map(toSqliteEventRow);
}

export async function listNeonEventsByIds(ids: number[]): Promise<EventRow[]> {
  if (ids.length === 0) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgEvents)
    .where(inArray(pgEvents.id, ids));
  return rows.map(toSqliteEventRow);
}

/** Fields the feed poller is allowed to write onto a global event row. */
export type NeonEventFeedPatch = Partial<{
  status: EventRow["status"];
  homeScore: number;
  awayScore: number;
  minute: number;
  period: string | null;
  homeLed2: number;
  awayLed2: number;
  goals: string | null;
  matchEnding: string | null;
  ftHomeScore: number | null;
  ftAwayScore: number | null;
}>;

export async function updateNeonEvent(
  id: number,
  patch: NeonEventFeedPatch
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await getNeonDb().update(pgEvents).set(patch).where(eq(pgEvents.id, id));
}
