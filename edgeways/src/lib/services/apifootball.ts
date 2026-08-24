/**
 * API-Football (api-sports.io) client with in-memory throttling so the free tier
 * (100 requests/day) isn't burned by dashboard polling. Falls back to demo fixtures
 * when no key is configured.
 */

import { isNeonDesk } from "@/lib/db/desk-backend";
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
 * Hosted (Neon) desks share one durable counter (EDGE-81c) so the cap holds
 * across serverless instances and cold starts; local keeps module state. The
 * in-memory counter is still advanced on the hosted path so `apiUsageToday()`
 * (sync, used by the state snapshot) reflects at least this instance's spend.
 */
async function spendBudget(): Promise<boolean> {
  if (!isNeonDesk()) return spendLocalBudget();
  try {
    const { spendNeonFeedBudget } = await import("@/lib/db/neon-feed-budget");
    const used = await spendNeonFeedBudget(DAILY_BUDGET);
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
    return { used: await neonFeedBudgetUsed(), budget: DAILY_BUDGET };
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
    homeLogo: item.teams?.home?.logo ? String(item.teams.home.logo) : null,
    awayLogo: item.teams?.away?.logo ? String(item.teams.away.logo) : null,
    leagueCountry: item.league?.country ? String(item.league.country) : null,
    leagueFlag: item.league?.flag ? String(item.league.flag) : null,
  };
}

async function apiGet(pathAndQuery: string): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");
  if (!(await spendBudget())) {
    throw new Error("API-Football daily request budget exhausted");
  }
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

/**
 * Goal events (scorer, minute) for one fixture - powers "The bet wins IF" player
 * triggers. Costs one request per fixture per LIVE_TTL, so the state service only
 * calls this for live fixtures that actually have an open trigger bet on them.
 */
export async function fixtureGoalEvents(
  externalId: string,
  homeTeamName: string
): Promise<FixtureGoal[]> {
  const cacheKey = `goals:${externalId}`;
  const hit = goalsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < LIVE_TTL) return hit.data;
  const json = await apiGet(`/fixtures/events?fixture=${externalId}&type=Goal`);
  const normHome = normaliseTeam(homeTeamName);
  const data: FixtureGoal[] = (json.response ?? [])
    .filter((e: any) => e.type === "Goal" && e.detail !== "Missed Penalty")
    .map((e: any) => ({
      minute: (e.time?.elapsed ?? 0) + (e.time?.extra ?? 0),
      side: normaliseTeam(e.team?.name ?? "") === normHome ? ("home" as const) : ("away" as const),
      player: e.player?.name ?? undefined,
      og: e.detail === "Own Goal" || undefined,
    }));
  goalsCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

const goalsCache = new Map<string, { at: number; data: FixtureGoal[] }>();

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
 * Find a real fixture matching two team names among today's and tomorrow's fixtures
 * (both lists are cached, so this costs at most 2 API requests per 10 minutes).
 * Used by "track this match" to import a live-trackable event from a calculator.
 */
export async function searchFixtureByTeams(
  homeTeam: string,
  awayTeam: string
): Promise<Fixture | null> {
  if (!hasApiKey()) return null;
  const dates = [0, 1].map((offset) =>
    localCalendarDate(new Date(Date.now() + offset * 24 * 60 * 60 * 1000))
  );
  for (const date of dates) {
    try {
      const fixtures = await fixturesByDate(date);
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
    startTime: number
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
  });
  return [
    mk("wc0", "FIFA World Cup", "France", "Morocco", k(17, 30)),
    mk("wc1", "FIFA World Cup", "Mexico", "England", k(18, 0)),
    mk("wc2", "FIFA World Cup", "Brazil", "Germany", k(19, 45)),
    mk("wc3", "World Cup - Group Stage", "Spain", "France", k(20, 0)),
    mk("1", "Premier League", "Arsenal", "Liverpool", k(12, 30)),
    mk("2", "Premier League", "Man City", "Chelsea", k(15, 0)),
    mk("3", "Premier League", "Newcastle", "Spurs", k(17, 30)),
    mk("4", "Championship", "Leeds", "Sunderland", k(14, 0)),
    mk("5", "La Liga", "Barcelona", "Real Madrid", k(20, 0)),
    mk("6", "Serie A", "Inter", "Juventus", k(19, 45)),
    mk("7", "Bundesliga", "Bayern Munich", "Dortmund", k(14, 30)),
    mk("8", "Ligue 1", "PSG", "Marseille", k(20, 45)),
  ];
}
