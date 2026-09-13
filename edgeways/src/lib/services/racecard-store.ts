/**
 * Durable racecard store (server-only).
 *
 * The Racing Desk and Fixtures used to fetch racecards live from the upstream
 * feed on every in-memory cache miss. On Vercel each serverless instance has
 * its own memory, so cold starts and concurrent users each fired their own
 * upstream burst against a per-second rate limit (429s), and every cold load
 * blocked the desk on the full upstream round trip.
 *
 * This module makes racecards store-first:
 *
 * 1. READ: serve the persisted payload for the date (Neon hosted, SQLite
 *    local). Fresh rows return as-is; stale rows return immediately AND
 *    refresh in the background, so users never wait on the feed.
 * 2. MISS: one live fetch, written straight through to the store so the next
 *    reader on any instance is a database read.
 * 3. WARM: the cron warmer (`/api/cron/warm-racecards`) refreshes today and
 *    tomorrow (racing + football) on a slow cadence, so the store is never
 *    cold.
 *
 * Past dates are immutable: a stored row is served forever and never
 * refetched. Stored cards re-derive upcoming/live/finished from startTime on
 * read, matching what a fresh fetch would produce.
 *
 * Global feed data, not desk data - no clerk scoping (same posture as
 * feed_sync_state).
 */
import "server-only";

import { eq, lt } from "drizzle-orm";
import { db, racecardCache } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { feedHorizonDates, localCalendarDate, mergeByExternalId } from "@/lib/events";
import {
  hasRacingApiKey,
  isRacingTierAccessError,
  racecardsByDate,
  racecardsFree,
  type RacingRacecard,
} from "@/lib/services/theracingapi";

/** Matches the in-memory TTL in theracingapi - stale rows still serve. */
export const RACECARD_STORE_FRESH_MS = 15 * 60 * 1000;

export interface StoredRacecards {
  cards: RacingRacecard[];
  oddsTier: "free" | "standard";
  fetchedAt: number;
}

function parseStoredRow(row: {
  oddsTier: string;
  payload: string;
  fetchedAt: number;
}): StoredRacecards | null {
  try {
    const cards = JSON.parse(row.payload) as RacingRacecard[];
    if (!Array.isArray(cards)) return null;
    return {
      cards,
      oddsTier: row.oddsTier === "standard" ? "standard" : "free",
      fetchedAt: row.fetchedAt,
    };
  } catch {
    return null;
  }
}

/** Re-derive upcoming/live/finished from startTime, as mapRacecard does. */
function withCurrentStatus(cards: RacingRacecard[], now: number): RacingRacecard[] {
  return cards.map((card) => {
    let status: RacingRacecard["status"] = "upcoming";
    if (card.startTime <= now - 90 * 60 * 1000) status = "finished";
    else if (card.startTime <= now) status = "live";
    return card.status === status ? card : { ...card, status };
  });
}

export async function readRacecardStore(date: string): Promise<StoredRacecards | null> {
  if (isNeonDesk()) {
    const { readNeonRacecardCache } = await import("@/lib/db/neon-racecard-cache");
    const row = await readNeonRacecardCache(date);
    return row ? parseStoredRow(row) : null;
  }
  const row = db.select().from(racecardCache).where(eq(racecardCache.date, date)).get();
  return row ? parseStoredRow(row) : null;
}

export async function writeRacecardStore(
  date: string,
  cards: RacingRacecard[],
  oddsTier: "free" | "standard",
  fetchedAt: number = Date.now()
): Promise<void> {
  // A rate-limit `[]` must not become the stored day. The next reader would
  // treat it as a hit and skip the live fetch for 15 minutes.
  if (cards.length === 0) return;
  const payload = JSON.stringify(cards);
  if (isNeonDesk()) {
    const { writeNeonRacecardCache } = await import("@/lib/db/neon-racecard-cache");
    await writeNeonRacecardCache({ date, oddsTier, payload, fetchedAt });
    return;
  }
  db.insert(racecardCache)
    .values({ date, oddsTier, payload, fetchedAt })
    .onConflictDoUpdate({
      target: racecardCache.date,
      set: { oddsTier, payload, fetchedAt },
    })
    .run();
}

/**
 * Live fetch with the free-tier fallback both readers used to inline:
 * standard-with-odds first, plain free cards when the plan tier or an empty
 * standard payload says so. Only today/tomorrow have cards upstream.
 */
async function fetchLiveRacecards(
  date: string
): Promise<{ cards: RacingRacecard[]; oddsTier: "free" | "standard" }> {
  try {
    const { cards, oddsTier } = await racecardsByDate(date);
    if (cards.length > 0) return { cards, oddsTier };
  } catch (error) {
    if (!isRacingTierAccessError(error)) throw error;
  }

  const today = localCalendarDate();
  const tomorrow = localCalendarDate(new Date(Date.now() + 86400000));
  if (date === today) return { cards: await racecardsFree("today"), oddsTier: "free" };
  if (date === tomorrow) return { cards: await racecardsFree("tomorrow"), oddsTier: "free" };
  return { cards: [], oddsTier: "free" };
}

/**
 * Single-flight per date: a stale-read storm (or the cron plus a desk load)
 * shares one upstream fetch instead of stampeding the per-second rate limit.
 */
const refreshInflight = new Map<string, Promise<void>>();

export function refreshRacecardStore(date: string): Promise<void> {
  const existing = refreshInflight.get(date);
  if (existing) return existing;
  const work = (async () => {
    const live = await fetchLiveRacecards(date);
    await writeRacecardStore(date, live.cards, live.oddsTier);
  })().finally(() => {
    refreshInflight.delete(date);
  });
  refreshInflight.set(date, work);
  return work;
}

/**
 * Refresh without blocking the response (next/server `after`). Outside a
 * request context (scripts, tests) `after` throws on registration, so the
 * inline fallback runs the work instead - it cannot double-run because the
 * callback only starts once registration succeeds.
 */
function scheduleBackgroundRefresh(date: string): void {
  const work = async () => {
    try {
      await refreshRacecardStore(date);
    } catch (error) {
      console.error("[racecard-store] background refresh failed:", error);
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
 * Store-first racecards for a UK calendar date. Throws only when there is no
 * stored payload AND the live fetch fails - callers keep their existing
 * error handling for that case. A stale payload always serves, so an
 * upstream 429 or outage never blanks the desk once the day has been fetched.
 */
export async function getRacecardsForDate(date: string): Promise<StoredRacecards> {
  const stored = await readRacecardStore(date).catch(() => null);
  const now = Date.now();

  if (stored) {
    const cards = withCurrentStatus(stored.cards, now);
    const fresh = now - stored.fetchedAt < RACECARD_STORE_FRESH_MS;
    if (fresh || date < localCalendarDate()) return { ...stored, cards };
    scheduleBackgroundRefresh(date);
    return { ...stored, cards };
  }

  const live = await fetchLiveRacecards(date);
  await writeRacecardStore(date, live.cards, live.oddsTier, now).catch(() => {});
  // Cold misses are rare (about one per date per instance), so this is a cheap
  // place to keep local SQLite bounded - hosted gets pruned by the cron warmer.
  await pruneRacecardStore(now).catch(() => {});
  return { cards: live.cards, oddsTier: live.oddsTier, fetchedAt: now };
}

/**
 * Today and tomorrow from the store. Racing has no cards beyond tomorrow.
 * One cold miss must not blank the other day.
 */
export async function getRacecardsForHorizon(now = Date.now()): Promise<{
  cards: RacingRacecard[];
  dates: string[];
  oddsTier: "free" | "standard";
  fetchedAt: number;
}> {
  const dates = feedHorizonDates(now);
  const settled = await Promise.allSettled(dates.map((date) => getRacecardsForDate(date)));
  const cards: RacingRacecard[] = [];
  let fetchedAt = 0;
  let oddsTier: "free" | "standard" = "free";
  let firstError: unknown;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      cards.push(...result.value.cards);
      fetchedAt = Math.max(fetchedAt, result.value.fetchedAt);
      if (result.value.oddsTier === "standard") oddsTier = "standard";
    } else if (firstError === undefined) {
      firstError = result.reason;
    }
  }
  if (cards.length === 0 && firstError !== undefined) throw firstError;
  return { cards: mergeByExternalId(cards), dates, oddsTier, fetchedAt };
}

/**
 * Days of racecard history kept for browsing back on the desk. Older rows are
 * pruned by the cron warmer so the table stays at a handful of ~150 KB rows
 * rather than growing by one row per day forever.
 */
export const RACECARD_STORE_KEEP_DAYS = 7;

/** Drop rows older than the retention window. Dates sort lexicographically. */
export async function pruneRacecardStore(now: number = Date.now()): Promise<void> {
  const cutoff = localCalendarDate(new Date(now - RACECARD_STORE_KEEP_DAYS * 86400000));
  if (isNeonDesk()) {
    const { deleteNeonRacecardCacheBefore } = await import("@/lib/db/neon-racecard-cache");
    await deleteNeonRacecardCacheBefore(cutoff);
    return;
  }
  db.delete(racecardCache).where(lt(racecardCache.date, cutoff)).run();
}

/**
 * Cron warmer: keep today and tomorrow fresh so the first desk load of the
 * day is a database read, not an upstream fetch. No-op without feed
 * credentials (demo mode has no upstream to warm from).
 */
export async function warmRacecardStore(): Promise<{ warmed: string[]; skipped: string[] }> {
  if (!hasRacingApiKey()) return { warmed: [], skipped: [] };
  const today = localCalendarDate();
  const tomorrow = localCalendarDate(new Date(Date.now() + 86400000));

  const warmed: string[] = [];
  const skipped: string[] = [];
  for (const date of [today, tomorrow]) {
    const stored = await readRacecardStore(date).catch(() => null);
    if (stored && Date.now() - stored.fetchedAt < RACECARD_STORE_FRESH_MS) {
      skipped.push(date);
      continue;
    }
    // A rate-limited or upstream-down date must not stop the other date (or
    // pruning below) from warming - each date's upstream call is independent.
    try {
      await refreshRacecardStore(date);
      warmed.push(date);
    } catch (error) {
      console.error(`[racecard-store] warm failed for ${date}:`, error);
    }
  }
  await pruneRacecardStore().catch(() => {});
  return { warmed, skipped };
}
