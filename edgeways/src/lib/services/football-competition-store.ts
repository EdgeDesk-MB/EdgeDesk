/**
 * Durable current-season football competition catalog (server-only).
 *
 * Store-first, same contract as fixture-store:
 *
 * 1. READ the persisted row (Neon hosted, SQLite local).
 * 2. Fresh → serve. Stale → serve immediately and refresh in the background.
 * 3. MISS → one live `/leagues?current=true` fetch, write-through.
 *    Empty upstream payloads are not stored.
 *
 * Global feed data, not desk data — no clerk scoping.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db, footballCompetitionCatalog } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import type { FootballCompetitionCatalogEntry } from "@/lib/events/fixture-scope";
import { currentLeagues, hasApiKey } from "@/lib/services/apifootball";

const CATALOG_ID = "current";

export const FOOTBALL_COMPETITION_CATALOG_FRESH_MS = 24 * 60 * 60 * 1000;

export interface StoredFootballCompetitions {
  competitions: FootballCompetitionCatalogEntry[];
  fetchedAt: number;
}

function parseStoredRow(row: {
  payload: string;
  fetchedAt: number;
}): StoredFootballCompetitions | null {
  try {
    const competitions = JSON.parse(row.payload) as FootballCompetitionCatalogEntry[];
    if (!Array.isArray(competitions) || competitions.length === 0) return null;
    return { competitions, fetchedAt: row.fetchedAt };
  } catch {
    return null;
  }
}

export async function readFootballCompetitionCatalog(): Promise<StoredFootballCompetitions | null> {
  if (isNeonDesk()) {
    const { readNeonFootballCompetitionCatalog } = await import(
      "@/lib/db/neon-football-competition-catalog"
    );
    const row = await readNeonFootballCompetitionCatalog();
    return row ? parseStoredRow(row) : null;
  }
  const row = db
    .select()
    .from(footballCompetitionCatalog)
    .where(eq(footballCompetitionCatalog.id, CATALOG_ID))
    .get();
  return row ? parseStoredRow(row) : null;
}

export async function writeFootballCompetitionCatalog(
  competitions: FootballCompetitionCatalogEntry[],
  fetchedAt: number = Date.now()
): Promise<void> {
  if (competitions.length === 0) return;
  const payload = JSON.stringify(competitions);
  if (isNeonDesk()) {
    const { writeNeonFootballCompetitionCatalog } = await import(
      "@/lib/db/neon-football-competition-catalog"
    );
    await writeNeonFootballCompetitionCatalog({ payload, fetchedAt });
    return;
  }
  db.insert(footballCompetitionCatalog)
    .values({
      id: CATALOG_ID,
      payload,
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: footballCompetitionCatalog.id,
      set: { payload, fetchedAt },
    })
    .run();
}

let refreshInflight: Promise<void> | null = null;

export function refreshFootballCompetitionCatalog(): Promise<void> {
  if (refreshInflight) return refreshInflight;
  const work = (async () => {
    const competitions = await currentLeagues();
    await writeFootballCompetitionCatalog(competitions);
  })().finally(() => {
    refreshInflight = null;
  });
  refreshInflight = work;
  return work;
}

function scheduleBackgroundRefresh(): void {
  const work = async () => {
    try {
      await refreshFootballCompetitionCatalog();
    } catch (error) {
      console.error("[football-competition-store] background refresh failed:", error);
    }
  };
  void (async () => {
    try {
      const { after } = await import("next/server");
      after(work);
    } catch {
      await work();
    }
  })();
}

/** Stored catalog only. Never hits the provider. */
export async function peekFootballCompetitionCatalog(): Promise<FootballCompetitionCatalogEntry[]> {
  const stored = await readFootballCompetitionCatalog().catch(() => null);
  return stored?.competitions ?? [];
}

/**
 * Store-first catalog. Throws only on a cold miss when the live fetch fails.
 * A stale payload always serves.
 */
export async function getFootballCompetitionCatalog(): Promise<FootballCompetitionCatalogEntry[]> {
  const stored = await readFootballCompetitionCatalog().catch(() => null);
  const now = Date.now();

  if (stored) {
    const fresh = now - stored.fetchedAt < FOOTBALL_COMPETITION_CATALOG_FRESH_MS;
    if (!fresh) scheduleBackgroundRefresh();
    return stored.competitions;
  }

  const competitions = await currentLeagues();
  await writeFootballCompetitionCatalog(competitions, now).catch(() => {});
  return competitions;
}

export async function warmFootballCompetitionCatalog(): Promise<{
  warmed: boolean;
  skipped: boolean;
}> {
  if (!hasApiKey()) return { warmed: false, skipped: false };
  const stored = await readFootballCompetitionCatalog().catch(() => null);
  if (stored && Date.now() - stored.fetchedAt < FOOTBALL_COMPETITION_CATALOG_FRESH_MS) {
    return { warmed: false, skipped: true };
  }
  await refreshFootballCompetitionCatalog();
  return { warmed: true, skipped: false };
}
