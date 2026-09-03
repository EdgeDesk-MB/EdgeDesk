/**
 * Neon side of the durable racecard cache. Global feed data (one row per UK
 * calendar date shared by every desk), so no clerk scoping - same posture as
 * feed_sync_state. Reads/writes go through the drizzle schema so column names
 * stay in one place.
 */
import "server-only";

import { eq, lt } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { racecardCache } from "@/lib/db/schema.pg";

export interface NeonRacecardCacheRow {
  date: string;
  oddsTier: string;
  payload: string;
  fetchedAt: number;
}

export async function readNeonRacecardCache(
  date: string
): Promise<NeonRacecardCacheRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(racecardCache)
    .where(eq(racecardCache.date, date))
    .limit(1);
  return rows[0] ?? null;
}

export async function writeNeonRacecardCache(input: {
  date: string;
  oddsTier: string;
  payload: string;
  fetchedAt: number;
}): Promise<void> {
  await getNeonDb()
    .insert(racecardCache)
    .values(input)
    .onConflictDoUpdate({
      target: racecardCache.date,
      set: {
        oddsTier: input.oddsTier,
        payload: input.payload,
        fetchedAt: input.fetchedAt,
      },
    });
}

/** Drop rows older than the cutoff date (YYYY-MM-DD sorts lexicographically). */
export async function deleteNeonRacecardCacheBefore(cutoffDate: string): Promise<void> {
  await getNeonDb().delete(racecardCache).where(lt(racecardCache.date, cutoffDate));
}
