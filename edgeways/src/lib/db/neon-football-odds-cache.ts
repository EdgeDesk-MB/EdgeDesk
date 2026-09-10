/**
 * Neon side of the shared football exchange-odds cache. Global feed data,
 * no clerk scoping — same posture as fixture_cache.
 */
import "server-only";

import { eq, lt } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { ensureNeonFootballScoutTables } from "@/lib/db/neon-football-scout-schema";
import { footballOddsCache } from "@/lib/db/schema.pg";

export interface NeonFootballOddsCacheRow {
  fixtureKey: string;
  date: string;
  home: string;
  away: string;
  startTime: number;
  payload: string;
  fetchedAt: number;
}

export async function readNeonFootballOddsCache(
  fixtureKey: string
): Promise<NeonFootballOddsCacheRow | null> {
  await ensureNeonFootballScoutTables();
  const rows = await getNeonDb()
    .select()
    .from(footballOddsCache)
    .where(eq(footballOddsCache.fixtureKey, fixtureKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function readNeonFootballOddsCacheForDate(
  date: string
): Promise<NeonFootballOddsCacheRow[]> {
  await ensureNeonFootballScoutTables();
  return getNeonDb()
    .select()
    .from(footballOddsCache)
    .where(eq(footballOddsCache.date, date));
}

export async function writeNeonFootballOddsCache(
  input: NeonFootballOddsCacheRow
): Promise<void> {
  await ensureNeonFootballScoutTables();
  await getNeonDb()
    .insert(footballOddsCache)
    .values(input)
    .onConflictDoUpdate({
      target: footballOddsCache.fixtureKey,
      set: {
        date: input.date,
        home: input.home,
        away: input.away,
        startTime: input.startTime,
        payload: input.payload,
        fetchedAt: input.fetchedAt,
      },
    });
}

export async function deleteNeonFootballOddsCacheBefore(
  cutoffDate: string
): Promise<void> {
  await ensureNeonFootballScoutTables();
  await getNeonDb().delete(footballOddsCache).where(lt(footballOddsCache.date, cutoffDate));
}
