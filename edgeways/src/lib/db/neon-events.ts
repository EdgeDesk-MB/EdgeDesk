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

export async function findNeonEventByExternalId(
  externalId: string
): Promise<EventRow | null> {
  const trimmed = externalId.trim();
  if (!trimmed) return null;
  const rows = await getNeonDb()
    .select()
    .from(pgEvents)
    .where(eq(pgEvents.externalId, trimmed))
    .limit(1);
  return rows[0] ? toSqliteEventRow(rows[0]) : null;
}

export async function getNeonEvent(id: number): Promise<EventRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgEvents)
    .where(eq(pgEvents.id, id))
    .limit(1);
  return rows[0] ? toSqliteEventRow(rows[0]) : null;
}

export type NeonEventValues = {
  sport: string;
  externalId?: string | null;
  competition?: string | null;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  status?: EventRow["status"];
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  homeLed2?: number;
  awayLed2?: number;
  source?: EventRow["source"];
  goals?: string | null;
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
  matchEnding?: string | null;
  period?: string | null;
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  lineups?: string | null;
  tapeFetchedAt?: number | null;
  simScript?: string | null;
  simStartedAt?: number | null;
  createdAt: number;
};

export async function insertNeonEvent(values: NeonEventValues): Promise<EventRow> {
  const rows = await getNeonDb()
    .insert(pgEvents)
    .values({
      sport: values.sport,
      externalId: values.externalId ?? null,
      competition: values.competition ?? null,
      homeTeam: values.homeTeam,
      awayTeam: values.awayTeam,
      startTime: values.startTime,
      status: values.status ?? "upcoming",
      homeScore: values.homeScore ?? 0,
      awayScore: values.awayScore ?? 0,
      minute: values.minute ?? 0,
      homeLed2: values.homeLed2 ?? 0,
      awayLed2: values.awayLed2 ?? 0,
      source: values.source ?? "manual",
      goals: values.goals ?? null,
      ftHomeScore: values.ftHomeScore ?? null,
      ftAwayScore: values.ftAwayScore ?? null,
      matchEnding: values.matchEnding ?? null,
      period: values.period ?? null,
      htHomeScore: values.htHomeScore ?? null,
      htAwayScore: values.htAwayScore ?? null,
      lineups: values.lineups ?? null,
      tapeFetchedAt: values.tapeFetchedAt ?? null,
      simScript: values.simScript ?? null,
      simStartedAt: values.simStartedAt ?? null,
      createdAt: values.createdAt,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Neon did not return the saved fixture.");
  return toSqliteEventRow(row);
}

export async function deleteNeonEvent(id: number): Promise<boolean> {
  const rows = await getNeonDb()
    .delete(pgEvents)
    .where(eq(pgEvents.id, id))
    .returning({ id: pgEvents.id });
  return rows.length > 0;
}

export async function listNeonEventsByIds(ids: number[]): Promise<EventRow[]> {
  if (ids.length === 0) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgEvents)
    .where(inArray(pgEvents.id, ids));
  return rows.map(toSqliteEventRow);
}

/** Fields the feed poller or hosted tracker may write onto a global event row. */
export type NeonEventFeedPatch = Partial<{
  status: EventRow["status"];
  homeScore: number;
  awayScore: number;
  minute: number;
  period: string | null;
  htHomeScore: number | null;
  htAwayScore: number | null;
  lineups: string | null;
  tapeFetchedAt: number | null;
  homeLed2: number;
  awayLed2: number;
  goals: string | null;
  matchEnding: string | null;
  ftHomeScore: number | null;
  ftAwayScore: number | null;
  competition: string | null;
  homeTeam: string;
  awayTeam: string;
}>;

export async function updateNeonEvent(
  id: number,
  patch: NeonEventFeedPatch
): Promise<EventRow | null> {
  if (Object.keys(patch).length === 0) {
    return getNeonEvent(id);
  }
  const rows = await getNeonDb()
    .update(pgEvents)
    .set(patch)
    .where(eq(pgEvents.id, id))
    .returning();
  return rows[0] ? toSqliteEventRow(rows[0]) : null;
}
