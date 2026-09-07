/**
 * Durable football fixture store (server-only).
 *
 * Same store-first contract as `racecard-store`:
 *
 * 1. READ: serve the persisted payload for the date (Neon hosted, SQLite
 *    local). Fresh rows return as-is; stale rows return immediately AND
 *    refresh in the background, so users never wait on the feed.
 * 2. MISS: one live fetch, written straight through so the next reader on
 *    any instance is a database read. Empty upstream payloads are not stored.
 * 3. WARM: the cron warmer refreshes today and tomorrow on a slow cadence.
 *
 * Past dates are immutable. Stored rows re-derive upcoming/live from
 * kick-off (same 4h window as `effectiveEventStatus`) so LIVE still shows
 * between cron ticks. Live scores stay on the short poll, not this store.
 *
 * Global feed data, not desk data - no clerk scoping.
 */
import "server-only";

import { eq, lt } from "drizzle-orm";
import { db, fixtureCache } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  effectiveEventStatus,
  feedHorizonDates,
  localCalendarDate,
  mergeByExternalId,
} from "@/lib/events";
import {
  fixturesByDate,
  hasApiKey,
  type Fixture,
} from "@/lib/services/apifootball";

/** Matches the in-memory TTL in apifootball - stale rows still serve. */
export const FIXTURE_STORE_FRESH_MS = 10 * 60 * 1000;

export interface StoredFixtures {
  fixtures: Fixture[];
  fetchedAt: number;
}

function parseStoredRow(row: { payload: string; fetchedAt: number }): StoredFixtures | null {
  try {
    const fixtures = JSON.parse(row.payload) as Fixture[];
    if (!Array.isArray(fixtures) || fixtures.length === 0) return null;
    return { fixtures, fetchedAt: row.fetchedAt };
  } catch {
    return null;
  }
}

function withCurrentStatus(fixtures: Fixture[], now: number): Fixture[] {
  return fixtures.map((fixture) => {
    const status = effectiveEventStatus(
      {
        sport: "football",
        status: fixture.status,
        source: "api",
        startTime: fixture.startTime,
      },
      now
    );
    return status === fixture.status ? fixture : { ...fixture, status };
  });
}

export async function readFixtureStore(date: string): Promise<StoredFixtures | null> {
  if (isNeonDesk()) {
    const { readNeonFixtureCache } = await import("@/lib/db/neon-fixture-cache");
    const row = await readNeonFixtureCache(date);
    return row ? parseStoredRow(row) : null;
  }
  const row = db.select().from(fixtureCache).where(eq(fixtureCache.date, date)).get();
  return row ? parseStoredRow(row) : null;
}

export async function writeFixtureStore(
  date: string,
  fixtures: Fixture[],
  fetchedAt: number = Date.now()
): Promise<void> {
  if (fixtures.length === 0) return;
  const payload = JSON.stringify(fixtures);
  if (isNeonDesk()) {
    const { writeNeonFixtureCache } = await import("@/lib/db/neon-fixture-cache");
    await writeNeonFixtureCache({ date, payload, fetchedAt });
    return;
  }
  db.insert(fixtureCache)
    .values({ date, payload, fetchedAt })
    .onConflictDoUpdate({
      target: fixtureCache.date,
      set: { payload, fetchedAt },
    })
    .run();
}

const refreshInflight = new Map<string, Promise<void>>();

export function refreshFixtureStore(date: string): Promise<void> {
  const existing = refreshInflight.get(date);
  if (existing) return existing;
  const work = (async () => {
    const fixtures = await fixturesByDate(date);
    await writeFixtureStore(date, fixtures);
  })().finally(() => {
    refreshInflight.delete(date);
  });
  refreshInflight.set(date, work);
  return work;
}

function scheduleBackgroundRefresh(date: string): void {
  const work = async () => {
    try {
      await refreshFixtureStore(date);
    } catch (error) {
      console.error("[fixture-store] background refresh failed:", error);
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

/**
 * Store-first fixtures for a UK calendar date. Throws only when there is no
 * stored payload AND the live fetch fails. A stale payload always serves.
 */
export async function getFixturesForDate(date: string): Promise<StoredFixtures> {
  const stored = await readFixtureStore(date).catch(() => null);
  const now = Date.now();

  if (stored) {
    const fixtures = withCurrentStatus(stored.fixtures, now);
    const fresh = now - stored.fetchedAt < FIXTURE_STORE_FRESH_MS;
    if (fresh || date < localCalendarDate()) return { ...stored, fixtures };
    scheduleBackgroundRefresh(date);
    return { ...stored, fixtures };
  }

  const fixtures = await fixturesByDate(date);
  await writeFixtureStore(date, fixtures, now).catch(() => {});
  await pruneFixtureStore(now).catch(() => {});
  return { fixtures, fetchedAt: now };
}

/**
 * Today and tomorrow from the store. One cold miss must not blank the other
 * day. Throws only when every date fails with no payload.
 */
export async function getFixturesForHorizon(now = Date.now()): Promise<{
  fixtures: Fixture[];
  dates: string[];
  fetchedAt: number;
}> {
  const dates = feedHorizonDates(now);
  const settled = await Promise.allSettled(dates.map((date) => getFixturesForDate(date)));
  const fixtures: Fixture[] = [];
  let fetchedAt = 0;
  let firstError: unknown;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      fixtures.push(...result.value.fixtures);
      fetchedAt = Math.max(fetchedAt, result.value.fetchedAt);
    } else if (firstError === undefined) {
      firstError = result.reason;
    }
  }
  if (fixtures.length === 0 && firstError !== undefined) throw firstError;
  return { fixtures: mergeByExternalId(fixtures), dates, fetchedAt };
}

export const FIXTURE_STORE_KEEP_DAYS = 7;

export async function pruneFixtureStore(now: number = Date.now()): Promise<void> {
  const cutoff = localCalendarDate(new Date(now - FIXTURE_STORE_KEEP_DAYS * 86400000));
  if (isNeonDesk()) {
    const { deleteNeonFixtureCacheBefore } = await import("@/lib/db/neon-fixture-cache");
    await deleteNeonFixtureCacheBefore(cutoff);
    return;
  }
  db.delete(fixtureCache).where(lt(fixtureCache.date, cutoff)).run();
}

export async function warmFixtureStore(): Promise<{ warmed: string[]; skipped: string[] }> {
  if (!hasApiKey()) return { warmed: [], skipped: [] };
  const today = localCalendarDate();
  const tomorrow = localCalendarDate(new Date(Date.now() + 86400000));

  const warmed: string[] = [];
  const skipped: string[] = [];
  for (const date of [today, tomorrow]) {
    const stored = await readFixtureStore(date).catch(() => null);
    if (stored && Date.now() - stored.fetchedAt < FIXTURE_STORE_FRESH_MS) {
      skipped.push(date);
      continue;
    }
    await refreshFixtureStore(date);
    warmed.push(date);
  }
  await pruneFixtureStore().catch(() => {});
  return { warmed, skipped };
}
