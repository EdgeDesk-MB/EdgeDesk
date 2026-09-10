/**
 * Durable exchange 1X2 + O2.5 + BTTS store for 2UP scout (server-only).
 * Store-first: desks read this; cron warms pinned upcoming fixtures.
 * Global feed data, no clerk scoping.
 */
import "server-only";

import { eq, lt } from "drizzle-orm";
import { db, footballOddsCache } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { twoupScoutKey, twoupWindfallFromOdds } from "@/lib/calc/ep/twoup-openness";
import { localCalendarDate } from "@/lib/events";
import {
  pickTwoupScoutWarmFixtures,
  TWOUP_SCOUT_WARM_CAP,
} from "@/lib/events/twoup-scout-fixtures";
import { getFixturesForHorizon } from "@/lib/services/fixture-store";
import { fetchBetfairFootballOdds } from "@/lib/services/exchange/football-odds";
import {
  hasAnyFootballOdds,
  type FootballOddsValues,
} from "@/lib/services/exchange/football-odds-map";
import { betfairConfigured } from "@/lib/services/exchange/betfair";

export const FOOTBALL_ODDS_STORE_FRESH_MS = 12 * 60 * 1000;
export const FOOTBALL_ODDS_STORE_KEEP_DAYS = 3;

export interface StoredFootballOdds {
  home: string;
  away: string;
  startTime: number;
  date: string;
  odds: FootballOddsValues;
  windfallHome?: number;
  windfallAway?: number;
  modelXh?: number;
  modelXa?: number;
  twoUpHome?: number;
  twoUpAway?: number;
  winHome?: number;
  winAway?: number;
  fetchedAt: number;
}

function parseRow(row: {
  home: string;
  away: string;
  startTime: number;
  date: string;
  payload: string;
  fetchedAt: number;
}): StoredFootballOdds | null {
  try {
    const raw = JSON.parse(row.payload) as
      | FootballOddsValues
      | {
          odds?: FootballOddsValues;
          windfallHome?: number;
          windfallAway?: number;
          modelXh?: number;
          modelXa?: number;
          twoUpHome?: number;
          twoUpAway?: number;
          winHome?: number;
          winAway?: number;
        };
    const odds =
      raw && typeof raw === "object" && "odds" in raw && raw.odds
        ? raw.odds
        : (raw as FootballOddsValues);
    if (!odds || typeof odds !== "object" || !hasAnyFootballOdds(odds)) return null;
    const nested = raw && typeof raw === "object" && "odds" in raw ? raw : null;
    return {
      home: row.home,
      away: row.away,
      startTime: row.startTime,
      date: row.date,
      odds,
      windfallHome: nested?.windfallHome,
      windfallAway: nested?.windfallAway,
      modelXh: nested?.modelXh,
      modelXa: nested?.modelXa,
      twoUpHome: nested?.twoUpHome,
      twoUpAway: nested?.twoUpAway,
      winHome: nested?.winHome,
      winAway: nested?.winAway,
      fetchedAt: row.fetchedAt,
    };
  } catch {
    return null;
  }
}

export async function readFootballOddsStore(
  key: string
): Promise<StoredFootballOdds | null> {
  if (isNeonDesk()) {
    const { readNeonFootballOddsCache } = await import("@/lib/db/neon-football-odds-cache");
    const row = await readNeonFootballOddsCache(key);
    return row ? parseRow(row) : null;
  }
  const row = db
    .select()
    .from(footballOddsCache)
    .where(eq(footballOddsCache.fixtureKey, key))
    .get();
  return row ? parseRow(row) : null;
}

export async function readFootballOddsStoreForDate(
  date: string
): Promise<StoredFootballOdds[]> {
  if (isNeonDesk()) {
    const { readNeonFootballOddsCacheForDate } = await import(
      "@/lib/db/neon-football-odds-cache"
    );
    const rows = await readNeonFootballOddsCacheForDate(date);
    return rows.map(parseRow).filter((row): row is StoredFootballOdds => row != null);
  }
  const rows = db
    .select()
    .from(footballOddsCache)
    .where(eq(footballOddsCache.date, date))
    .all();
  return rows.map(parseRow).filter((row): row is StoredFootballOdds => row != null);
}

export async function writeFootballOddsStore(input: {
  home: string;
  away: string;
  startTime: number;
  date: string;
  odds: FootballOddsValues;
  windfallHome?: number;
  windfallAway?: number;
  modelXh?: number;
  modelXa?: number;
  twoUpHome?: number;
  twoUpAway?: number;
  winHome?: number;
  winAway?: number;
  fetchedAt?: number;
}): Promise<void> {
  if (!hasAnyFootballOdds(input.odds)) return;
  const fetchedAt = input.fetchedAt ?? Date.now();
  const fixtureKey = twoupScoutKey({
    homeTeam: input.home,
    awayTeam: input.away,
    startTime: input.startTime,
  });
  const payload = JSON.stringify({
    odds: input.odds,
    windfallHome: input.windfallHome,
    windfallAway: input.windfallAway,
    modelXh: input.modelXh,
    modelXa: input.modelXa,
    twoUpHome: input.twoUpHome,
    twoUpAway: input.twoUpAway,
    winHome: input.winHome,
    winAway: input.winAway,
  });
  if (isNeonDesk()) {
    const { writeNeonFootballOddsCache } = await import("@/lib/db/neon-football-odds-cache");
    await writeNeonFootballOddsCache({
      fixtureKey,
      date: input.date,
      home: input.home,
      away: input.away,
      startTime: input.startTime,
      payload,
      fetchedAt,
    });
    return;
  }
  db.insert(footballOddsCache)
    .values({
      fixtureKey,
      date: input.date,
      home: input.home,
      away: input.away,
      startTime: input.startTime,
      payload,
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: footballOddsCache.fixtureKey,
      set: {
        date: input.date,
        home: input.home,
        away: input.away,
        startTime: input.startTime,
        payload,
        fetchedAt,
      },
    })
    .run();
}

const refreshInflight = new Map<string, Promise<StoredFootballOdds | null>>();

export function refreshFootballOddsStore(input: {
  home: string;
  away: string;
  startTime: number;
  date: string;
}): Promise<StoredFootballOdds | null> {
  const key = twoupScoutKey({
    homeTeam: input.home,
    awayTeam: input.away,
    startTime: input.startTime,
  });
  const existing = refreshInflight.get(key);
  if (existing) return existing;
  const work = (async () => {
    const result = await fetchBetfairFootballOdds({
      homeTeam: input.home,
      awayTeam: input.away,
      startTime: input.startTime,
    });
    if (!hasAnyFootballOdds(result.odds)) return null;
    const fetchedAt = Date.now();
    const windfall = twoupWindfallFromOdds(result.odds);
    await writeFootballOddsStore({
      home: input.home,
      away: input.away,
      startTime: input.startTime,
      date: input.date,
      odds: result.odds,
      windfallHome: windfall?.home,
      windfallAway: windfall?.away,
      modelXh: windfall?.lh,
      modelXa: windfall?.la,
      twoUpHome: windfall?.pH2,
      twoUpAway: windfall?.pA2,
      winHome: windfall?.pWinH,
      winAway: windfall?.pWinA,
      fetchedAt,
    });
    return {
      home: input.home,
      away: input.away,
      startTime: input.startTime,
      date: input.date,
      odds: result.odds,
      windfallHome: windfall?.home,
      windfallAway: windfall?.away,
      modelXh: windfall?.lh,
      modelXa: windfall?.la,
      twoUpHome: windfall?.pH2,
      twoUpAway: windfall?.pA2,
      winHome: windfall?.pWinH,
      winAway: windfall?.pWinA,
      fetchedAt,
    };
  })().finally(() => {
    refreshInflight.delete(key);
  });
  refreshInflight.set(key, work);
  return work;
}

export function enqueueFootballOddsRefresh(input: {
  home: string;
  away: string;
  startTime: number;
  date: string;
}): void {
  const work = async () => {
    try {
      await refreshFootballOddsStore(input);
    } catch (error) {
      console.error("[football-odds-store] background refresh failed:", error);
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

export async function getFootballOddsForFixture(input: {
  home: string;
  away: string;
  startTime: number;
  date: string;
}): Promise<StoredFootballOdds | null> {
  const key = twoupScoutKey({
    homeTeam: input.home,
    awayTeam: input.away,
    startTime: input.startTime,
  });
  const stored = await readFootballOddsStore(key).catch(() => null);
  const now = Date.now();
  if (stored) {
    if (now - stored.fetchedAt < FOOTBALL_ODDS_STORE_FRESH_MS) return stored;
    enqueueFootballOddsRefresh(input);
    return stored;
  }
  return refreshFootballOddsStore(input).catch(() => null);
}

export async function pruneFootballOddsStore(now: number = Date.now()): Promise<void> {
  const cutoff = localCalendarDate(new Date(now - FOOTBALL_ODDS_STORE_KEEP_DAYS * 86400000));
  if (isNeonDesk()) {
    const { deleteNeonFootballOddsCacheBefore } = await import(
      "@/lib/db/neon-football-odds-cache"
    );
    await deleteNeonFootballOddsCacheBefore(cutoff);
    return;
  }
  db.delete(footballOddsCache).where(lt(footballOddsCache.date, cutoff)).run();
}

export async function listPinnedFootballScopesForWarm(): Promise<string[]> {
  if (isNeonDesk()) {
    const { listNeonFavouriteFootballScopes } = await import("@/lib/db/neon-desk-settings");
    return listNeonFavouriteFootballScopes();
  }
  const { getAppSettings } = await import("@/lib/services/settings");
  return getAppSettings().favouriteFootballScopes;
}

export async function listPinnedFootballScopesForDesk(): Promise<string[]> {
  if (isNeonDesk()) {
    const { getNeonDeskSettings } = await import("@/lib/db/neon-desk-settings");
    return (await getNeonDeskSettings()).favouriteFootballScopes;
  }
  const { getAppSettings } = await import("@/lib/services/settings");
  return getAppSettings().favouriteFootballScopes;
}

export async function warmFootballOddsStore(): Promise<{
  warmed: number;
  skipped: number;
}> {
  if (!betfairConfigured()) return { warmed: 0, skipped: 0 };
  const scopes = await listPinnedFootballScopesForWarm();
  if (scopes.length === 0) return { warmed: 0, skipped: 0 };
  const { fixtures } = await getFixturesForHorizon();
  const candidates = pickTwoupScoutWarmFixtures(
    fixtures,
    scopes,
    localCalendarDate()
  );
  let warmed = 0;
  let skipped = 0;
  for (const fixture of candidates) {
    const key = twoupScoutKey({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      startTime: fixture.startTime,
    });
    const stored = await readFootballOddsStore(key).catch(() => null);
    if (stored && Date.now() - stored.fetchedAt < FOOTBALL_ODDS_STORE_FRESH_MS) {
      skipped += 1;
      continue;
    }
    const date = localCalendarDate(new Date(fixture.startTime));
    const next = await refreshFootballOddsStore({
      home: fixture.homeTeam,
      away: fixture.awayTeam,
      startTime: fixture.startTime,
      date,
    }).catch(() => null);
    if (next) warmed += 1;
  }
  await pruneFootballOddsStore().catch(() => {});
  return { warmed, skipped };
}

export { TWOUP_SCOUT_WARM_CAP };
