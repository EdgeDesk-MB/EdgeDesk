/**
 * Neon side of the shared football standings (GF/GA) cache. Global feed,
 * no clerk scoping.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { ensureNeonFootballScoutTables } from "@/lib/db/neon-football-scout-schema";
import { footballStandingsCache } from "@/lib/db/schema.pg";

export interface NeonFootballStandingsCacheRow {
  scopeId: string;
  leagueId: number | null;
  season: number | null;
  payload: string;
  fetchedAt: number;
}

export async function readNeonFootballStandingsCache(
  scopeId: string
): Promise<NeonFootballStandingsCacheRow | null> {
  await ensureNeonFootballScoutTables();
  const rows = await getNeonDb()
    .select()
    .from(footballStandingsCache)
    .where(eq(footballStandingsCache.scopeId, scopeId))
    .limit(1);
  return rows[0] ?? null;
}

export async function writeNeonFootballStandingsCache(
  input: NeonFootballStandingsCacheRow
): Promise<void> {
  await ensureNeonFootballScoutTables();
  await getNeonDb()
    .insert(footballStandingsCache)
    .values(input)
    .onConflictDoUpdate({
      target: footballStandingsCache.scopeId,
      set: {
        leagueId: input.leagueId,
        season: input.season,
        payload: input.payload,
        fetchedAt: input.fetchedAt,
      },
    });
}
