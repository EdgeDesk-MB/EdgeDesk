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
 *    Any lookback day still open after the result window is included so a
 *    missed FT is written through once.
 *
 * Past dates with a finished snapshot are immutable. A day frozen mid-match
 * (still `live` / not finished, kick-off more than three hours ago) gets
 * one background write-through. Stored rows re-derive upcoming/live from
 * kick-off (same 4h window as `effectiveEventStatus`) so LIVE still shows
 * between cron ticks. Live scores overlay from a warm in-process peek
 * only — never wait on the provider on this read. The 15s desk poll
 * and a background refresh warm that peek. Overlay is not written back.
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
  FIXTURE_LIST_LOOKBACK_DAYS,
  localCalendarDate,
  mergeByExternalId,
} from "@/lib/events";
import { mergeLiveFixtureOverlay } from "@/lib/events/live-fixture-overlay";
import {
  fixturesByDate,
  hasApiKey,
  peekLiveFixtures,
  scheduleLiveFixturesRefresh,
  type Fixture,
} from "@/lib/services/apifootball";

/** Matches the in-memory TTL in apifootball - stale rows still serve. */
export const FIXTURE_STORE_FRESH_MS = 10 * 60 * 1000;

/** Kick-off this old, and not finished, means the day card is missing FT. */
export const FOOTBALL_RESULT_CATCH_UP_MS = 3 * 60 * 60 * 1000;

export function footballDayNeedsResultCatchUp(
  fixtures: readonly Fixture[],
  now: number = Date.now()
): boolean {
  return fixtures.some((fixture) => {
    if ((fixture.sport ?? "football") !== "football") return false;
    if (fixture.status === "finished") return false;
    if (!Number.isFinite(fixture.startTime)) return false;
    return fixture.startTime <= now - FOOTBALL_RESULT_CATCH_UP_MS;
  });
}

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

function dateMayHaveLive(date: string, now: number): boolean {
  const today = localCalendarDate(new Date(now));
  const yesterday = localCalendarDate(new Date(now - 86_400_000));
  return date === today || date === yesterday;
}

function withLiveScores(date: string, fixtures: Fixture[], now: number): Fixture[] {
  const current = withCurrentStatus(fixtures, now);
  if (!dateMayHaveLive(date, now)) return current;
  const peek = peekLiveFixtures();
  if (peek) return mergeLiveFixtureOverlay(current, peek);
  scheduleLiveFixturesRefresh();
  return current;
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
    const fixtures = withLiveScores(date, stored.fixtures, now);
    const fresh = now - stored.fetchedAt < FIXTURE_STORE_FRESH_MS;
    const past = date < localCalendarDate();
    const catchUp = footballDayNeedsResultCatchUp(stored.fixtures, now);
    if (past && !catchUp) return { ...stored, fixtures };
    if (fresh && !catchUp) return { ...stored, fixtures };
    scheduleBackgroundRefresh(date);
    return { ...stored, fixtures };
  }

  const fetched = await fixturesByDate(date);
  await writeFixtureStore(date, fetched, now).catch(() => {});
  await pruneFixtureStore(now).catch(() => {});
  return { fixtures: withLiveScores(date, fetched, now), fetchedAt: now };
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
  const now = Date.now();
  const today = localCalendarDate(new Date(now));
  const tomorrow = localCalendarDate(new Date(now + 86400000));
  const dates = [today, tomorrow];
  for (let daysAgo = 1; daysAgo <= FIXTURE_LIST_LOOKBACK_DAYS; daysAgo += 1) {
    const date = localCalendarDate(new Date(now - daysAgo * 86400000));
    const row = await readFixtureStore(date).catch(() => null);
    if (row && footballDayNeedsResultCatchUp(row.fixtures, now)) {
      dates.push(date);
    }
  }

  const warmed: string[] = [];
  const skipped: string[] = [];
  for (const date of dates) {
    const stored = await readFixtureStore(date).catch(() => null);
    const catchUp = stored
      ? footballDayNeedsResultCatchUp(stored.fixtures, now)
      : false;
    if (stored && !catchUp && now - stored.fetchedAt < FIXTURE_STORE_FRESH_MS) {
      skipped.push(date);
      continue;
    }
    await refreshFixtureStore(date);
    warmed.push(date);
  }
  await pruneFixtureStore().catch(() => {});
  return { warmed, skipped };
}
