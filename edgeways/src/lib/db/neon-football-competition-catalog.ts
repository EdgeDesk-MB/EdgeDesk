/**
 * Neon side of the durable football competition catalog. Global feed data
 * (one shared row), no clerk scoping — same posture as fixture_cache.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { footballCompetitionCatalog } from "@/lib/db/schema.pg";

export const FOOTBALL_COMPETITION_CATALOG_ID = "current";

export interface NeonFootballCompetitionCatalogRow {
  id: string;
  payload: string;
  fetchedAt: number;
}

export async function readNeonFootballCompetitionCatalog(): Promise<NeonFootballCompetitionCatalogRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(footballCompetitionCatalog)
    .where(eq(footballCompetitionCatalog.id, FOOTBALL_COMPETITION_CATALOG_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function writeNeonFootballCompetitionCatalog(input: {
  payload: string;
  fetchedAt: number;
}): Promise<void> {
  await getNeonDb()
    .insert(footballCompetitionCatalog)
    .values({
      id: FOOTBALL_COMPETITION_CATALOG_ID,
      payload: input.payload,
      fetchedAt: input.fetchedAt,
    })
    .onConflictDoUpdate({
      target: footballCompetitionCatalog.id,
      set: {
        payload: input.payload,
        fetchedAt: input.fetchedAt,
      },
    });
}
