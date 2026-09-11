/**
 * API-Football (api-sports.io) client implementation.
 * Import from `@/lib/services/apifootball`, not this file.
 */

import { isNeonDesk } from "@/lib/db/desk-backend";
import type { FootballCompetitionCatalogEntry } from "@/lib/events/fixture-scope";
import type { FootballLineups } from "@/lib/events/lineups";
import type { MatchTapeEvent } from "@/lib/events/match-tape";
import { feedHorizonDates, localCalendarDate, wallClockKickoffMs } from "@/lib/events";
import { LIVE_TTL_MS } from "@/lib/live-poll-rules";
import {
  mapFixtureScores,
  mapLineupsPayload,
  mapTapeEvents,
  mergeMatchTapes,
  tapeContextFromFixtureItem,
  tapeLooksShortOfScore,
  type TapeMapContext,
} from "@/lib/services/apifootball-map";

const BASE = "https://v3.football.api-sports.io";

export interface Fixture {
  externalId: string;
  sport: "football";
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  status: "upcoming" | "live" | "finished";
  homeScore: number;
  awayScore: number;
  minute: number;
  /** 90-minute score — only set when matchEnding is "aet" or "pen" */
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
  /** How the match ended; null while live or unknown */
  matchEnding?: "ft" | "aet" | "pen" | null;
  /** API-Football `fixture.status.short` — HT, 1H, 2H, ET, P, … */
  period?: string | null;
  /** Half-time score from `score.halftime` when published */
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  /** Club crest or national team badge URL from API-Football */
  homeLogo?: string | null;
  awayLogo?: string | null;
  /** League country name from API-Football */
  leagueCountry?: string | null;
  /** Country flag image URL from API-Football (`league.flag`) */
  leagueFlag?: string | null;
}

interface CacheEntry {
  at: number;
  data: Fixture[];
}

const cache = new Map<string, CacheEntry>();
const FIXTURES_TTL = 10 * 60 * 1000; // fixtures list: 10 min (store-first day cards)

/** Fallback daily cap when admin `feed_caps` is unset (local SQLite / first boot). */
export const DAILY_BUDGET = 95;
let budgetDay = "";
let requestsToday = 0;

function spendLocalBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    requestsToday = 0;
  }
  if (requestsToday >= DAILY_BUDGET) return false;
  requestsToday += 1;
  return true;
}

/**
 * Operator-tunable cap (admin → Feed health) with a 60s cache so the per-request
 * budget claim stays one round-trip. Falls back to DAILY_BUDGET when the
 * settings read fails — never fails open above the safe default.
 */
let capCache: { at: number; value: number } | null = null;

async function footballDailyCap(): Promise<number> {
  if (!isNeonDesk()) return DAILY_BUDGET;
  if (capCache && Date.now() - capCache.at < 60_000) return capCache.value;
  try {
    const { readFeedCaps } = await import("@/lib/admin/feed-caps");
    const caps = await readFeedCaps();
    capCache = { at: Date.now(), value: caps.football };
    return caps.football;
  } catch {
    return DAILY_BUDGET;
  }
}

/**
 * Hosted (Neon) desks share one durable counter (EDGE-81c) so the cap holds
 * across serverless instances and cold starts; local keeps module state. The
 * in-memory counter is still advanced on the hosted path so `apiUsageToday()`
 * (sync, used by the state snapshot) reflects at least this instance's spend.
 */
async function spendBudget(): Promise<boolean> {
  if (!isNeonDesk()) return spendLocalBudget();
  try {
    const cap = await footballDailyCap();
    const { spendNeonFeedBudget } = await import("@/lib/db/neon-feed-budget");
    const used = await spendNeonFeedBudget(cap);
    if (used == null) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (today !== budgetDay) {
      budgetDay = today;
      requestsToday = 0;
    }
    requestsToday = Math.max(requestsToday + 1, used);
    return true;
  } catch {
    // Neon unreachable: fall back to the per-instance guard rather than
    // letting the cap fail open.
    return spendLocalBudget();
  }
}

export function apiUsageToday(): { used: number; budget: number } {
  const today = new Date().toISOString().slice(0, 10);
  return { used: today === budgetDay ? requestsToday : 0, budget: DAILY_BUDGET };
}

/** Hosted usage straight from Neon; falls back to this instance's counter. */
export async function apiUsageTodayAsync(): Promise<{
  used: number;
  budget: number;
}> {
  if (!isNeonDesk()) return apiUsageToday();
  try {
    const { neonFeedBudgetUsed } = await import("@/lib/db/neon-feed-budget");
    const used = await neonFeedBudgetUsed();
    return { used, budget: await footballDailyCap() };
  } catch {
    return apiUsageToday();
  }
}

function apiKey(): string | undefined {
  return process.env.API_FOOTBALL_KEY || undefined;
}

export function hasApiKey(): boolean {
  return !!apiKey();
}

/**
 * Budget-free health check for the admin panel: the /status endpoint does
 * not count against API-Football's daily quota, so this never touches
 * spendBudget(). Returns the raw status payload (account, subscription,
 * provider-side request counters).
 */
export async function pingApiFootball(): Promise<{
  plan: string | null;
  requestsUsed: number | null;
  requestsLimit: number | null;
}> {
  const key = apiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");
  const res = await fetch(`${BASE}/status`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const json: any = await res.json();
  const err = formatApiErrors(json?.errors);
  if (err) throw new Error(err);
  const response = json?.response;
  return {
    plan: response?.subscription?.plan ? String(response.subscription.plan) : null,
    requestsUsed:
      typeof response?.requests?.current === "number"
        ? response.requests.current
        : null,
    requestsLimit:
      typeof response?.requests?.limit_day === "number"
        ? response.requests.limit_day
        : null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapFixture(item: any): Fixture {
  const scores = mapFixtureScores(item);
  return {
    externalId: String(item.fixture?.id ?? ""),
    sport: "football",
    competition: item.league?.name ?? "",
    homeTeam: item.teams?.home?.name ?? "?",
    awayTeam: item.teams?.away?.name ?? "?",
    startTime: (item.fixture?.timestamp ?? 0) * 1000,
    ...scores,
    homeLogo: item.teams?.home?.logo ? String(item.teams.home.logo) : null,
    awayLogo: item.teams?.away?.logo ? String(item.teams.away.logo) : null,
    leagueCountry: item.league?.country ? String(item.league.country) : null,
    leagueFlag: item.league?.flag ? String(item.league.flag) : null,
  };
}

export type FixtureDetail = {
  fixture: Fixture;
  events: MatchTapeEvent[];
  lineups: FootballLineups | null;
  /** Nested `events` was present on the id payload (including `[]`). */
  eventsFromPayload: boolean;
  homeTeamId: number | null;
};

const detailCache = new Map<string, { at: number; data: FixtureDetail }>();
const footballTapeMemo = new Map<string, { at: number; data: MatchTapeEvent[] }>();
const footballXiMemo = new Map<string, { at: number; data: FootballLineups | null }>();

function rememberFixture(fixture: Fixture): void {
  cache.set(`id:${fixture.externalId}`, { at: Date.now(), data: [fixture] });
}

function rememberTape(externalId: string, events: MatchTapeEvent[]): void {
  footballTapeMemo.set(`tape:${externalId}`, { at: Date.now(), data: events });
}

function rememberLineups(externalId: string, lineups: FootballLineups | null): void {
  footballXiMemo.set(`xi:${externalId}`, { at: Date.now(), data: lineups });
}

function cacheNestedPayload(
  item: any,
  fixture: Fixture,
  homeTeamName?: string
): Omit<FixtureDetail, "fixture"> {
  const ctx = tapeContextFromFixtureItem(item, homeTeamName ?? fixture.homeTeam);
  const eventsFromPayload = Array.isArray(item.events);
  const events = eventsFromPayload ? mapTapeEvents(item.events, ctx) : [];
  const lineups = mapLineupsPayload(item.lineups);
  rememberFixture(fixture);
  if (eventsFromPayload) rememberTape(fixture.externalId, events);
  if (lineups) rememberLineups(fixture.externalId, lineups);
  return {
    events,
    lineups,
    eventsFromPayload,
    homeTeamId: ctx.homeTeamId ?? null,
  };
}

/**
 * Operation label for spend attribution (admin → Feeds → Spend by source).
 * Derived from the request path so every caller of apiGet is covered without
 * threading context through the service layer.
 */
export function footballOperation(pathAndQuery: string): string {
  if (pathAndQuery.startsWith("/fixtures?date=")) return "fixtures-by-date";
  if (pathAndQuery.startsWith("/fixtures?live=")) return "live-fixtures";
  if (pathAndQuery.startsWith("/fixtures?id=")) return "fixture-by-id";
  if (pathAndQuery.startsWith("/fixtures/events")) return "match-events";
  if (pathAndQuery.startsWith("/fixtures/lineups")) return "lineups";
  if (pathAndQuery.startsWith("/standings")) return "standings";
  if (pathAndQuery.startsWith("/leagues")) return "leagues-catalog";
  return "other";
}

/** Hosted desks log one attribution row per spent request; local desks have no shared pool. */
async function logFootballSpend(pathAndQuery: string): Promise<void> {
  if (!isNeonDesk()) return;
  try {
    const { logFeedUsageEvent } = await import("@/lib/db/neon-feed-budget");
    await logFeedUsageEvent("football", footballOperation(pathAndQuery));
  } catch {
    // best-effort: attribution must never block the feed
  }
}

async function apiGet(pathAndQuery: string): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");
  if (!(await spendBudget())) {
    throw new Error("API-Football daily request budget exhausted");
  }
  await logFootballSpend(pathAndQuery);
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  const json = await res.json();
  const err = formatApiErrors(json?.errors);
  if (err) throw new Error(err);
  return json;
}

/** API-Football returns HTTP 200 with `errors` when rate-limited or invalid. */
function formatApiErrors(errors: unknown): string | null {
  if (errors == null) return null;
  if (typeof errors === "string" && errors.trim()) return errors.trim();
  if (Array.isArray(errors)) {
    const parts = errors.map(String).filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  if (typeof errors === "object") {
    const parts = Object.values(errors as Record<string, unknown>)
      .map(String)
      .filter((s) => s && s !== "undefined");
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

/** Calendar date in the operator's local timezone (API-Football dates are local-day oriented). */
export { localCalendarDate } from "@/lib/events";

function mapLeague(item: any): FootballCompetitionCatalogEntry | null {
  const name = typeof item?.league?.name === "string" ? item.league.name.trim() : "";
  if (!name) return null;
  const country =
    typeof item?.country?.name === "string" && item.country.name.trim()
      ? String(item.country.name).trim()
      : null;
  const flag =
    typeof item?.country?.flag === "string" && item.country.flag.trim()
      ? String(item.country.flag).trim()
      : typeof item?.league?.flag === "string" && item.league.flag.trim()
        ? String(item.league.flag).trim()
        : null;
  const leagueIdRaw = item?.league?.id;
  const leagueId =
    typeof leagueIdRaw === "number" && Number.isFinite(leagueIdRaw)
      ? leagueIdRaw
      : typeof leagueIdRaw === "string" && Number.isFinite(Number(leagueIdRaw))
        ? Number(leagueIdRaw)
        : null;
  const seasons = Array.isArray(item?.seasons) ? item.seasons : [];
  const current =
    seasons.find((row: { current?: boolean }) => row?.current) ?? seasons[seasons.length - 1];
  const seasonRaw = current?.year;
  const season =
    typeof seasonRaw === "number" && Number.isFinite(seasonRaw)
      ? seasonRaw
      : typeof seasonRaw === "string" && Number.isFinite(Number(seasonRaw))
        ? Number(seasonRaw)
        : null;
  return { name, country, flag, leagueId, season };
}

/**
 * Current-season competitions from API-Football `/leagues?current=true`.
 * The feed names these `league` (type League or Cup). World Cup is a Cup
 * with country World. Desk copy still says competitions.
 */
export async function currentLeagues(): Promise<FootballCompetitionCatalogEntry[]> {
  const json = await apiGet("/leagues?current=true");
  const mapped: FootballCompetitionCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const item of json.response ?? []) {
    const entry = mapLeague(item);
    if (!entry) continue;
    const id = `${entry.country ?? ""}::${entry.name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    mapped.push(entry);
  }
  return mapped;
}

export type FootballTeamGoalRates = {
  name: string;
  gf: number;
  ga: number;
  played: number;
  homeGf?: number;
  homeGa?: number;
  homePlayed?: number;
  awayGf?: number;
  awayGa?: number;
  awayPlayed?: number;
};

/** League table GF/GA per game. Empty when the competition has no table. */
export async function leagueStandings(
  leagueId: number,
  season: number
): Promise<FootballTeamGoalRates[]> {
  if (!Number.isFinite(leagueId) || !Number.isFinite(season)) return [];
  const json = await apiGet(`/standings?league=${leagueId}&season=${season}`);
  const tables = json.response ?? [];
  const out: FootballTeamGoalRates[] = [];
  for (const block of tables) {
    const groups = block?.league?.standings;
    const rows = Array.isArray(groups) ? groups.flat() : [];
    for (const row of rows) {
      const name = typeof row?.team?.name === "string" ? row.team.name.trim() : "";
      const played = Number(row?.all?.played ?? 0);
      const gf = Number(row?.all?.goals?.for ?? 0);
      const ga = Number(row?.all?.goals?.against ?? 0);
      if (!name || !Number.isFinite(played) || played <= 0) continue;
      if (!Number.isFinite(gf) || !Number.isFinite(ga)) continue;
      const homePlayed = Number(row?.home?.played ?? 0);
      const homeGf = Number(row?.home?.goals?.for ?? NaN);
      const homeGa = Number(row?.home?.goals?.against ?? NaN);
      const awayPlayed = Number(row?.away?.played ?? 0);
      const awayGf = Number(row?.away?.goals?.for ?? NaN);
      const awayGa = Number(row?.away?.goals?.against ?? NaN);
      const homeSplit =
        Number.isFinite(homePlayed) &&
        homePlayed > 0 &&
        Number.isFinite(homeGf) &&
        Number.isFinite(homeGa);
      const awaySplit =
        Number.isFinite(awayPlayed) &&
        awayPlayed > 0 &&
        Number.isFinite(awayGf) &&
        Number.isFinite(awayGa);
      out.push({
        name,
        gf: gf / played,
        ga: ga / played,
        played,
        ...(homeSplit
          ? { homeGf: homeGf / homePlayed, homeGa: homeGa / homePlayed, homePlayed }
          : {}),
        ...(awaySplit
          ? { awayGf: awayGf / awayPlayed, awayGa: awayGa / awayPlayed, awayPlayed }
          : {}),
      });
    }
  }
  return out;
}

/** Upstream day fetch. Desk/API callers must use `getFixturesForDate`. */
export async function fixturesByDate(date: string): Promise<Fixture[]> {
  const cacheKey = `fixtures:${date}`;
  const hit = cache.get(cacheKey);
  // Never trust an empty cache entry - rate-limit responses used to look like
  // success with `response: []` and poisoned the list for FIXTURES_TTL.
  if (hit && hit.data.length > 0 && Date.now() - hit.at < FIXTURES_TTL) {
    return hit.data;
  }
  const json = await apiGet(`/fixtures?date=${date}`);
  const data: Fixture[] = (json.response ?? []).map(mapFixture);
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export async function liveFixtures(): Promise<Fixture[]> {
  const hit = cache.get("live");
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.data;
  const json = await apiGet(`/fixtures?live=all`);
  const data: Fixture[] = [];
  for (const item of json.response ?? []) {
    const fixture = mapFixture(item);
    data.push(fixture);
    cacheNestedPayload(item, fixture);
  }
  cache.set("live", { at: Date.now(), data });
  return data;
}

/** In-process live list only. Never hits the provider. */
export function peekLiveFixtures(): Fixture[] | null {
  const hit = cache.get("live");
  if (!hit || Date.now() - hit.at >= LIVE_TTL_MS) return null;
  return hit.data;
}

/** Warm the live list after the day card has already been served. */
export function scheduleLiveFixturesRefresh(): void {
  if (peekLiveFixtures()) return;
  const work = async () => {
    try {
      await liveFixtures();
    } catch (error) {
      console.error("[apifootball] live refresh failed:", error);
    }
  };
  void (async () => {
    try {
      const { after } = await import("next/server");
      after(work);
    } catch {
      void work();
    }
  })();
}

/**
 * One `/fixtures?id=` call. The id payload includes score, events and
 * lineups, so the match modal does not spend three quota hits.
 */
export async function fixtureDetail(
  id: string,
  homeTeamName?: string
): Promise<FixtureDetail | null> {
  if (!id.trim()) return null;
  const hit = detailCache.get(id);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.data;
  const json = await apiGet(`/fixtures?id=${id}`);
  const item = (json.response ?? [])[0];
  if (!item) return null;
  const fixture = mapFixture(item);
  const nested = cacheNestedPayload(item, fixture, homeTeamName);
  const data: FixtureDetail = { fixture, ...nested };
  detailCache.set(id, { at: Date.now(), data });
  return data;
}

/** Single fixture by id - works on the free API tier (`ids` batch is pro-only). */
export async function fixtureById(id: string): Promise<Fixture | null> {
  const detail = await fixtureDetail(id);
  return detail?.fixture ?? null;
}

export interface FixtureGoal {
  minute: number;
  side: "home" | "away";
  player?: string;
  og?: boolean;
}

async function fetchEventsEndpoint(
  externalId: string,
  ctx: TapeMapContext
): Promise<MatchTapeEvent[]> {
  const json = await apiGet(`/fixtures/events?fixture=${externalId}`);
  return mapTapeEvents(json.response ?? [], ctx);
}

/**
 * Full match tape. Prefers events already on `/fixtures?id=` or `live=all`,
 * then fills from `/fixtures/events` only when that payload omitted events
 * or the tape is short of the published score (missing first half).
 */
export async function fixtureMatchEvents(
  externalId: string,
  homeTeamName: string
): Promise<MatchTapeEvent[]> {
  const cacheKey = `tape:${externalId}`;
  const hit = footballTapeMemo.get(cacheKey);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) {
    const detail = detailCache.get(externalId);
    const fixture = detail?.data.fixture ?? cache.get(`id:${externalId}`)?.data[0];
    if (
      !fixture ||
      !tapeLooksShortOfScore(hit.data, fixture.homeScore, fixture.awayScore)
    ) {
      return hit.data;
    }
  }

  let events: MatchTapeEvent[] = hit?.data ?? [];
  const detail = await fixtureDetail(externalId, homeTeamName);
  const ctx: TapeMapContext = {
    homeTeamName: homeTeamName || detail?.fixture.homeTeam || "",
    homeTeamId: detail?.homeTeamId ?? null,
  };
  if (detail?.eventsFromPayload) {
    events = detail.events;
    const short = tapeLooksShortOfScore(
      events,
      detail.fixture.homeScore,
      detail.fixture.awayScore
    );
    if (short) {
      events = mergeMatchTapes(events, await fetchEventsEndpoint(externalId, ctx));
    }
  } else {
    events = await fetchEventsEndpoint(externalId, ctx);
  }
  rememberTape(externalId, events);
  return events;
}

/**
 * Goal events only. Wrapper over {@link fixtureMatchEvents} so trigger settlement
 * keeps the old shape. Same quota as a full-tape fetch (one request, cached).
 */
export async function fixtureGoalEvents(
  externalId: string,
  homeTeamName: string
): Promise<FixtureGoal[]> {
  const tape = await fixtureMatchEvents(externalId, homeTeamName);
  return tape
    .filter((e) => e.kind === "goal")
    .map((e) => ({
      minute: e.minute,
      side: e.side,
      player: e.player,
      og: e.og || undefined,
    }));
}

/** Confirmed XI. Cached for 15 minutes; callers persist on the event row. */
export async function fixtureLineups(
  externalId: string
): Promise<FootballLineups | null> {
  const cacheKey = `xi:${externalId}`;
  const hit = footballXiMemo.get(cacheKey);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data;
  const detail = detailCache.get(externalId);
  if (detail && Date.now() - detail.at < LIVE_TTL_MS && detail.data.lineups) {
    return detail.data.lineups;
  }
  const json = await apiGet(`/fixtures/lineups?fixture=${externalId}`);
  const stored = mapLineupsPayload(json.response ?? []);
  rememberLineups(externalId, stored);
  return stored;
}

/** Fetch fixtures by external id(s). Live matches come from the live feed; others use `?id=`. */
export async function fixturesByIds(ids: string[]): Promise<Fixture[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids.filter(Boolean))];
  const liveById = new Map((await liveFixtures()).map((f) => [f.externalId, f]));
  const out: Fixture[] = [];
  const missing: string[] = [];
  for (const id of unique) {
    const live = liveById.get(id);
    if (live) out.push(live);
    else missing.push(id);
  }
  const fetched = await Promise.all(
    missing.map(async (id) => {
      try {
        return await fixtureById(id);
      } catch {
        return null;
      }
    })
  );
  for (const fixture of fetched) {
    if (fixture) out.push(fixture);
  }
  return out;
}

const normaliseTeam = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function teamsMatch(a: string, b: string): boolean {
  const na = normaliseTeam(a);
  const nb = normaliseTeam(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Find a real fixture matching two team names among today's and tomorrow's
 * store-first fixture lists. Used by "track this match".
 */
export async function searchFixtureByTeams(
  homeTeam: string,
  awayTeam: string
): Promise<Fixture | null> {
  if (!hasApiKey()) return null;
  const dates = [0, 1].map((offset) =>
    localCalendarDate(new Date(Date.now() + offset * 24 * 60 * 60 * 1000))
  );
  const { getFixturesForDate } = await import("@/lib/services/fixture-store");
  for (const date of dates) {
    try {
      const { fixtures } = await getFixturesForDate(date);
      const hit = fixtures.find(
        (f) =>
          f.status !== "finished" &&
          teamsMatch(f.homeTeam, homeTeam) &&
          teamsMatch(f.awayTeam, awayTeam)
      );
      if (hit) return hit;
    } catch {
      // fall through - a failed search should never block manual tracking
    }
  }
  return null;
}

/** Demo fixtures used when no API key is configured - realistic UK kickoff times. */
export function demoFixtures(): Fixture[] {
  const k = wallClockKickoffMs;
  const mk = (
    id: string,
    competition: string,
    home: string,
    away: string,
    startTime: number,
    leagueCountry?: string
  ): Fixture => ({
    externalId: `demo-${id}`,
    sport: "football",
    competition,
    homeTeam: home,
    awayTeam: away,
    startTime,
    status: "upcoming",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    leagueCountry: leagueCountry ?? null,
  });
  return [
    mk("wc0", "FIFA World Cup", "France", "Morocco", k(17, 30), "World"),
    mk("wc1", "FIFA World Cup", "Mexico", "England", k(18, 0), "World"),
    mk("wc2", "FIFA World Cup", "Brazil", "Germany", k(19, 45), "World"),
    mk("wc3", "World Cup - Group Stage", "Spain", "France", k(20, 0), "World"),
    mk("1", "Premier League", "Arsenal", "Liverpool", k(12, 30), "England"),
    mk("2", "Premier League", "Man City", "Chelsea", k(15, 0), "England"),
    mk("3", "Premier League", "Newcastle", "Spurs", k(17, 30), "England"),
    mk("4", "Championship", "Leeds", "Sunderland", k(14, 0), "England"),
    mk("5", "La Liga", "Barcelona", "Real Madrid", k(20, 0), "Spain"),
    mk("6", "Serie A", "Inter", "Juventus", k(19, 45), "Italy"),
    mk("7", "Bundesliga", "Bayern Munich", "Dortmund", k(14, 30), "Germany"),
    mk("8", "Ligue 1", "PSG", "Marseille", k(20, 45), "France"),
  ];
}

/** Sample cards for today and tomorrow when the football feed is off. */
export function demoFixturesForHorizon(now = Date.now()): Fixture[] {
  return feedHorizonDates(now).flatMap((date, index) =>
    demoFixtures().map((fixture) => ({
      ...fixture,
      externalId: `${fixture.externalId}-${date}`,
      startTime: fixture.startTime + index * 86_400_000,
    }))
  );
}

/** Extra catalog rows so demo desks can star competitions with no matches today. */
export function demoCompetitions(): FootballCompetitionCatalogEntry[] {
  const fromFixtures = demoFixtures().map((fixture) => ({
    name: fixture.competition,
    country: fixture.leagueCountry ?? null,
    flag: fixture.leagueFlag ?? null,
  }));
  return [
    ...fromFixtures,
    { name: "FA Cup", country: "England" },
    { name: "EFL Cup", country: "England" },
    { name: "UEFA Champions League", country: "World" },
    { name: "Scottish Premiership", country: "Scotland" },
  ];
}
