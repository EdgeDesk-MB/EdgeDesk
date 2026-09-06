/**
 * API-Football (api-sports.io) client. Day lists go through `fixture-store`
 * (durable, cron-warmed). This module is the upstream adapter plus short-TTL
 * live/id/goals polls. In-memory maps only dedupe a single instance.
 */

import { isNeonDesk } from "@/lib/db/desk-backend";
import type { FootballLineupPlayer, FootballLineups } from "@/lib/events/lineups";
import type { MatchTapeEvent, MatchTapeKind } from "@/lib/events/match-tape";
import { localCalendarDate, wallClockKickoffMs } from "@/lib/events";

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
const FIXTURES_TTL = 10 * 60 * 1000; // fixtures list: 10 min
// Live scores at 60s keeps a full 90-min match around ~100 requests - the free
// tier's whole daily allowance. One live-tracked match per day fits; the budget
// guard below stops us blowing past the cap if more are tracked.
const LIVE_TTL = 60 * 1000;

/** Daily request budget: the free tier allows 100/day. Leave headroom for fixture browsing. */
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
  const shortStatus: string = item.fixture?.status?.short ?? "NS";
  const liveStatuses = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"];
  const finishedStatuses = ["FT", "AET", "PEN"];
  const elapsed = item.fixture?.status?.elapsed;
  const isAet = shortStatus === "AET";
  const isPen = shortStatus === "PEN";
  // 90-minute score is in score.fulltime; goals.home/away is the full final (including ET)
  const ftScore = item.score?.fulltime;
  const htScore = item.score?.halftime;
  return {
    externalId: String(item.fixture?.id ?? ""),
    sport: "football",
    competition: item.league?.name ?? "",
    homeTeam: item.teams?.home?.name ?? "?",
    awayTeam: item.teams?.away?.name ?? "?",
    startTime: (item.fixture?.timestamp ?? 0) * 1000,
    status: liveStatuses.includes(shortStatus)
      ? "live"
      : finishedStatuses.includes(shortStatus)
        ? "finished"
        : "upcoming",
    homeScore: item.goals?.home ?? 0,
    awayScore: item.goals?.away ?? 0,
    minute: elapsed ?? (shortStatus === "HT" ? 45 : 0),
    ftHomeScore: (isAet || isPen) ? (ftScore?.home ?? null) : null,
    ftAwayScore: (isAet || isPen) ? (ftScore?.away ?? null) : null,
    matchEnding: isAet ? "aet" : isPen ? "pen" : shortStatus === "FT" ? "ft" : null,
    period: liveStatuses.includes(shortStatus) ? shortStatus : null,
    htHomeScore: typeof htScore?.home === "number" ? htScore.home : null,
    htAwayScore: typeof htScore?.away === "number" ? htScore.away : null,
    homeLogo: item.teams?.home?.logo ? String(item.teams.home.logo) : null,
    awayLogo: item.teams?.away?.logo ? String(item.teams.away.logo) : null,
    leagueCountry: item.league?.country ? String(item.league.country) : null,
    leagueFlag: item.league?.flag ? String(item.league.flag) : null,
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
  if (hit && Date.now() - hit.at < LIVE_TTL) return hit.data;
  const json = await apiGet(`/fixtures?live=all`);
  const data: Fixture[] = (json.response ?? []).map(mapFixture);
  cache.set("live", { at: Date.now(), data });
  return data;
}

/** Single fixture by id - works on the free API tier (`ids` batch is pro-only). */
export async function fixtureById(id: string): Promise<Fixture | null> {
  if (!id.trim()) return null;
  const cacheKey = `id:${id}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < LIVE_TTL) return hit.data[0] ?? null;
  const json = await apiGet(`/fixtures?id=${id}`);
  const data: Fixture[] = (json.response ?? []).map(mapFixture);
  cache.set(cacheKey, { at: Date.now(), data });
  return data[0] ?? null;
}

export interface FixtureGoal {
  minute: number;
  side: "home" | "away";
  player?: string;
  og?: boolean;
}

function mapEventKind(type: string | undefined): MatchTapeKind {
  const t = (type ?? "").toLowerCase();
  if (t === "goal") return "goal";
  if (t === "card") return "card";
  if (t === "subst" || t === "substitution") return "subst";
  if (t === "var") return "var";
  return "other";
}

function mapTapeClock(e: { time?: { elapsed?: number; extra?: number } }): {
  minute: number;
  extra?: number;
} {
  const elapsed = e.time?.elapsed ?? 0;
  const extra = e.time?.extra ?? 0;
  const minute = elapsed + extra;
  return extra > 0 ? { minute, extra } : { minute };
}

function mapTapeEvent(e: any, homeTeamName: string): MatchTapeEvent | null {
  const side: "home" | "away" =
    normaliseTeam(e.team?.name ?? "") === normaliseTeam(homeTeamName) ? "home" : "away";
  const kind = mapEventKind(e.type);
  const clock = mapTapeClock(e);
  if (kind === "goal" && e.detail === "Missed Penalty") {
    return {
      kind: "other",
      ...clock,
      side,
      player: e.player?.name || undefined,
      detail: "Missed Penalty",
    };
  }
  const event: MatchTapeEvent = {
    kind,
    ...clock,
    side,
  };
  if (e.player?.name) event.player = String(e.player.name);
  if (e.assist?.name) event.assist = String(e.assist.name);
  if (e.detail) event.detail = String(e.detail);
  if (e.detail === "Own Goal") event.og = true;
  return event;
}

/**
 * Full match tape (goals, cards, subs, VAR). One request per fixture per LIVE_TTL.
 */
export async function fixtureMatchEvents(
  externalId: string,
  homeTeamName: string
): Promise<MatchTapeEvent[]> {
  const cacheKey = `tape:${externalId}`;
  const hit = tapeCache.get(cacheKey);
  if (hit && Date.now() - hit.at < LIVE_TTL) return hit.data;
  const json = await apiGet(`/fixtures/events?fixture=${externalId}`);
  const data: MatchTapeEvent[] = (json.response ?? [])
    .map((e: any) => mapTapeEvent(e, homeTeamName))
    .filter((e: MatchTapeEvent | null): e is MatchTapeEvent => e != null);
  tapeCache.set(cacheKey, { at: Date.now(), data });
  return data;
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

const tapeCache = new Map<string, { at: number; data: MatchTapeEvent[] }>();
const lineupsCache = new Map<string, { at: number; data: FootballLineups | null }>();

function mapLineupPlayers(raw: unknown): FootballLineupPlayer[] {
  if (!Array.isArray(raw)) return [];
  const out: FootballLineupPlayer[] = [];
  for (const row of raw) {
    const player = row?.player;
    const name = player?.name ? String(player.name).trim() : "";
    if (!name) continue;
    const item: FootballLineupPlayer = { name };
    if (typeof player?.number === "number") item.number = player.number;
    if (player?.grid) item.grid = String(player.grid);
    out.push(item);
  }
  return out;
}

/** Confirmed XI. Cached for 15 minutes; callers persist on the event row. */
export async function fixtureLineups(
  externalId: string
): Promise<FootballLineups | null> {
  const cacheKey = `xi:${externalId}`;
  const hit = lineupsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data;
  const json = await apiGet(`/fixtures/lineups?fixture=${externalId}`);
  const rows: any[] = json.response ?? [];
  if (rows.length === 0) {
    lineupsCache.set(cacheKey, { at: Date.now(), data: null });
    return null;
  }
  const home = rows[0];
  const away = rows[1] ?? rows.find((r) => r?.team?.id !== home?.team?.id);
  const homeCoach = home?.coach?.name ? String(home.coach.name).trim() : "";
  const awayCoach = away?.coach?.name ? String(away.coach.name).trim() : "";
  const homeSubs = mapLineupPlayers(home?.substitutes);
  const awaySubs = mapLineupPlayers(away?.substitutes);
  const data: FootballLineups = {
    homeFormation: home?.formation ? String(home.formation) : null,
    awayFormation: away?.formation ? String(away.formation) : null,
    home: mapLineupPlayers(home?.startXI),
    away: mapLineupPlayers(away?.startXI),
    ...(homeCoach ? { homeCoach } : {}),
    ...(awayCoach ? { awayCoach } : {}),
    ...(homeSubs.length > 0 ? { homeSubs } : {}),
    ...(awaySubs.length > 0 ? { awaySubs } : {}),
  };
  const empty = data.home.length === 0 && data.away.length === 0;
  const stored = empty ? null : data;
  lineupsCache.set(cacheKey, { at: Date.now(), data: stored });
  return stored;
}

/** Fetch fixtures by external id(s). Live matches come from the live feed; others use `?id=`. */
export async function fixturesByIds(ids: string[]): Promise<Fixture[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids.filter(Boolean))];
  const liveById = new Map((await liveFixtures()).map((f) => [f.externalId, f]));
  const out: Fixture[] = [];
  for (const id of unique) {
    const live = liveById.get(id);
    if (live) {
      out.push(live);
      continue;
    }
    try {
      const fixture = await fixtureById(id);
      if (fixture) out.push(fixture);
    } catch {
      // skip - next poll retries
    }
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
