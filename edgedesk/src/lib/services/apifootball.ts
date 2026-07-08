/**
 * API-Football (api-sports.io) client with in-memory throttling so the free tier
 * (100 requests/day) isn't burned by dashboard polling. Falls back to demo fixtures
 * when no key is configured.
 */

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
}

interface CacheEntry {
  at: number;
  data: Fixture[];
}

const cache = new Map<string, CacheEntry>();
const FIXTURES_TTL = 10 * 60 * 1000; // fixtures list: 10 min
// Live scores at 60s keeps a full 90-min match around ~100 requests — the free
// tier's whole daily allowance. One live-tracked match per day fits; the budget
// guard below stops us blowing past the cap if more are tracked.
const LIVE_TTL = 60 * 1000;

/** Daily request budget: the free tier allows 100/day. Leave headroom for fixture browsing. */
const DAILY_BUDGET = 95;
let budgetDay = "";
let requestsToday = 0;

function spendBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    requestsToday = 0;
  }
  if (requestsToday >= DAILY_BUDGET) return false;
  requestsToday += 1;
  return true;
}

export function apiUsageToday(): { used: number; budget: number } {
  const today = new Date().toISOString().slice(0, 10);
  return { used: today === budgetDay ? requestsToday : 0, budget: DAILY_BUDGET };
}

function apiKey(): string | undefined {
  return process.env.API_FOOTBALL_KEY || undefined;
}

export function hasApiKey(): boolean {
  return !!apiKey();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapFixture(item: any): Fixture {
  const shortStatus: string = item.fixture?.status?.short ?? "NS";
  const liveStatuses = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"];
  const finishedStatuses = ["FT", "AET", "PEN"];
  const elapsed = item.fixture?.status?.elapsed;
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
  };
}

async function apiGet(pathAndQuery: string): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");
  if (!spendBudget()) throw new Error("API-Football daily request budget exhausted");
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  return res.json();
}

export async function fixturesByDate(date: string): Promise<Fixture[]> {
  const cacheKey = `fixtures:${date}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < FIXTURES_TTL) return hit.data;
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

/** Single fixture by id — works on the free API tier (`ids` batch is pro-only). */
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
 * Goal events (scorer, minute) for one fixture — powers "The bet wins IF" player
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
      // skip — next poll retries
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
  const dates = [0, 1].map((offset) => {
    const d = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
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
      // fall through — a failed search should never block manual tracking
    }
  }
  return null;
}

/** Demo fixtures used when no API key is configured — kickoffs relative to now. */
export function demoFixtures(): Fixture[] {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const mk = (
    id: string,
    competition: string,
    home: string,
    away: string,
    offsetHours: number
  ): Fixture => ({
    externalId: `demo-${id}`,
    sport: "football",
    competition,
    homeTeam: home,
    awayTeam: away,
    startTime: now + offsetHours * hour,
    status: "upcoming",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
  });
  return [
    mk("1", "Premier League", "Arsenal", "Liverpool", 2),
    mk("2", "Premier League", "Man City", "Chelsea", 4),
    mk("3", "Premier League", "Newcastle", "Spurs", 5),
    mk("4", "Championship", "Leeds", "Sunderland", 3),
    mk("5", "La Liga", "Barcelona", "Real Madrid", 6),
    mk("6", "Serie A", "Inter", "Juventus", 7),
    mk("7", "Bundesliga", "Bayern Munich", "Dortmund", 24),
    mk("8", "Ligue 1", "PSG", "Marseille", 26),
  ];
}
