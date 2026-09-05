/**
 * Neon side of the durable football fixture cache. Global feed data (one row
 * per UK calendar date shared by every desk), so no clerk scoping - same
 * posture as racecard_cache / feed_sync_state.
 */
import "server-only";

import { eq, lt } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { fixtureCache } from "@/lib/db/schema.pg";

export interface NeonFixtureCacheRow {
  date: string;
  payload: string;
  fetchedAt: number;
}

export async function readNeonFixtureCache(
  date: string
): Promise<NeonFixtureCacheRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(fixtureCache)
    .where(eq(fixtureCache.date, date))
    .limit(1);
  return rows[0] ?? null;
}

export async function writeNeonFixtureCache(input: {
  date: string;
  payload: string;
  fetchedAt: number;
}): Promise<void> {
  await getNeonDb()
    .insert(fixtureCache)
    .values(input)
    .onConflictDoUpdate({
      target: fixtureCache.date,
      set: {
        payload: input.payload,
        fetchedAt: input.fetchedAt,
      },
    });
}

/** Drop rows older than the cutoff date (YYYY-MM-DD sorts lexicographically). */
export async function deleteNeonFixtureCacheBefore(cutoffDate: string): Promise<void> {
  await getNeonDb().delete(fixtureCache).where(lt(fixtureCache.date, cutoffDate));
}
