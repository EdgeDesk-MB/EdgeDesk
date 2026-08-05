/**
 * The Racing API (https://www.theracingapi.com) - UK & Irish horse racing.
 *
 * Free plan: `/v1/racecards/free` (today + tomorrow racecards).
 * Basic plan: `/v1/results/today` (live results for auto-settlement).
 *
 * Auth: HTTP Basic - username + password from your dashboard.
 */

import {
  type RaceResult,
  type RaceRunnerResult,
  runnerPosition,
  serializeRaceResults,
} from "@/lib/racing";
import type { RacingRunnerDetail } from "@/lib/racing-desk/types";
import { parseJockeyName } from "@/lib/racing/runner-display";
import { localCalendarDate, londonWallToUtcMs } from "@/lib/events";

const BASE = "https://api.theracingapi.com";

export interface RacingRacecard {
  externalId: string;
  sport: "horse_racing";
  competition: string;
  raceName: string;
  course: string;
  startTime: number;
  status: "upcoming" | "live" | "finished";
  fieldSize: number;
  offTime: string;
  runners: string[];
  distance?: string;
  going?: string;
  raceClass?: string;
  pattern?: string;
  ratingBand?: string;
  ageBand?: string;
  surface?: string;
  sexRestriction?: string;
  type?: string;
  prize?: string;
  region?: string;
  runnerDetails: RacingRunnerDetail[];
}

interface CacheEntry<T> {
  at: number;
  data: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const RACECARDS_TTL = 15 * 60 * 1000;
// The app-wide state poll (every few seconds, on every page - not just
// Racing Desk) transitively calls resultsToday() via getAppState() ->
// refreshRacingApiEvents()/resolveRacingResultsTier(), every tick. A short
// TTL here means that drip alone burns the whole daily request budget
// within a few hours of the app just being open. Race results don't need
// sub-minute freshness for auto-settlement, so 5 minutes cuts the "always
// on" drain ~3x with no meaningful UX cost.
const RESULTS_TTL = 5 * 60 * 1000;

/** Drop cached `/v1/results/today` so a manual Fetch results hits the API. */
export function clearRacingResultsCache(): void {
  cache.delete("results:today");
}

// The Racing API's real constraint is a per-second rate limit (5 req/s on
// paid plans, 1 req/s free), not a daily cap - and the multi-minute cache
// TTLs above already keep this app's real request rate far below that.
// requestsToday is kept purely as an informational counter for Settings;
// it no longer blocks requests (a hardcoded "200/day" guard was throttling
// the app well before any real limit was at risk, silently degrading
// Racing Desk to demo data).
let budgetDay = "";
let requestsToday = 0;

function trackRequest(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    requestsToday = 0;
  }
  requestsToday += 1;
}

function credentials(): { user: string; pass: string } | null {
  const user = process.env.RACING_API_USERNAME?.trim();
  const pass = process.env.RACING_API_PASSWORD?.trim();
  if (!user || !pass) return null;
  return { user, pass };
}

export function hasRacingApiKey(): boolean {
  return !!credentials();
}

export function racingApiUsageToday(): { used: number } {
  const today = new Date().toISOString().slice(0, 10);
  return { used: today === budgetDay ? requestsToday : 0 };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseOffTime(offDt: string | undefined, offTime: string | undefined, date: string): number {
  if (offDt) {
    const ms = Date.parse(offDt);
    if (!Number.isNaN(ms)) return ms;
  }
  const time = (offTime ?? "12:00").trim();
  const londonMs = londonWallToUtcMs(date, time);
  if (londonMs != null) return londonMs;
  const ms = Date.parse(`${date}T${time}:00`);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function mapRunner(r: any, index: number): RacingRunnerDetail {
  const spDec = parseFloat(String(r.sp_dec ?? r.sp_decimal ?? ""));
  const spDecimal = Number.isFinite(spDec) && spDec > 1 ? spDec : undefined;
  const spRaw = r.sp ?? r.sp_fraction;
  const lbsNum = parseInt(String(r.lbs ?? r.weight_lbs ?? ""), 10);
  const lbs = Number.isFinite(lbsNum) && lbsNum > 0 ? lbsNum : undefined;
  const jockeyRaw = String(r.jockey ?? r.jockey_name ?? "-");
  const { name: jockey, claimLbs: jockeyClaim } = parseJockeyName(jockeyRaw);
  const drawRaw = r.draw ?? r.stall;
  const draw =
    drawRaw != null && String(drawRaw).trim() !== "" ? String(drawRaw).trim() : undefined;
  const headgearRaw = r.headgear ?? r.headgear_run;
  const headgear =
    headgearRaw != null && String(headgearRaw).trim() !== ""
      ? String(headgearRaw).trim()
      : undefined;
  const silkUrl = r.silk_url ?? r.silk ?? r.silks_url;
  const lastRunRaw = r.last_run ?? r.lastRun;
  const lastRunNum = parseInt(String(lastRunRaw ?? ""), 10);
  const lastRunDays =
    Number.isFinite(lastRunNum) && lastRunNum >= 0 ? lastRunNum : undefined;
  const sexRaw = r.sex_code ?? r.sex;
  const sex =
    sexRaw != null && String(sexRaw).trim() !== "" ? String(sexRaw).trim() : undefined;
  const ofrRaw = r.ofr ?? r.or;
  const ofr =
    ofrRaw != null && String(ofrRaw).trim() !== "" && String(ofrRaw).trim() !== "-"
      ? String(ofrRaw).trim()
      : undefined;
  return {
    horseId: String(r.horse_id ?? r.horse ?? `runner-${index}`),
    name: String(r.horse ?? "").trim(),
    number: String(r.number ?? r.cloth ?? index + 1),
    draw,
    jockey,
    jockeyClaim,
    trainer: String(r.trainer ?? r.trainer_name ?? "-"),
    age: r.age != null ? String(r.age) : undefined,
    weight: lbs != null ? `${lbs}lbs` : r.weight != null ? String(r.weight) : undefined,
    weightLbs: lbs,
    horseColour: r.colour != null ? String(r.colour) : undefined,
    sex,
    headgear,
    silkUrl: typeof silkUrl === "string" && silkUrl.trim() ? silkUrl.trim() : undefined,
    ofr,
    lastRunDays,
    form: r.form ? String(r.form) : undefined,
    spDecimal,
    spFraction: spRaw != null ? String(spRaw) : undefined,
    nonRunner: Boolean(r.non_runner || r.status === "NR"),
    oddsList: r.odds,
  };
}

function mapRacecard(item: any, now: number): RacingRacecard {
  const startTime = parseOffTime(item.off_dt, item.off_time, item.date ?? "");
  const runnerDetails: RacingRunnerDetail[] = (item.runners ?? [])
    .map((r: any, i: number) => mapRunner(r, i))
    .filter((r: RacingRunnerDetail) => r.name);
  const runners = runnerDetails.filter((r) => !r.nonRunner).map((r) => r.name);
  const fieldSize = Number(item.field_size) || runners.length;

  let status: RacingRacecard["status"] = "upcoming";
  if (startTime <= now - 90 * 60 * 1000) status = "finished";
  else if (startTime <= now) status = "live";

  const distanceF = item.distance_f ?? item.distance_fur;
  const distance =
    item.distance != null && String(item.distance).trim() !== ""
      ? String(item.distance)
      : distanceF != null && String(distanceF).trim() !== ""
        ? `${String(distanceF).replace(/f$/i, "")}f`
        : undefined;

  return {
    externalId: String(item.race_id ?? `${item.course}-${item.off_time}-${item.race_name}`),
    sport: "horse_racing",
    competition: String(item.course ?? ""),
    raceName: String(item.race_name ?? "Race"),
    course: String(item.course ?? ""),
    startTime,
    status,
    fieldSize,
    offTime: String(item.off_time ?? ""),
    runners,
    distance,
    going: item.going ? String(item.going) : undefined,
    raceClass: item.race_class ? String(item.race_class) : undefined,
    pattern: item.pattern ? String(item.pattern) : undefined,
    ratingBand: item.rating_band ? String(item.rating_band) : undefined,
    ageBand: item.age_band ? String(item.age_band) : undefined,
    surface: item.surface ? String(item.surface) : undefined,
    sexRestriction: item.sex_restriction ? String(item.sex_restriction) : undefined,
    type: item.type ? String(item.type) : undefined,
    prize: item.prize ? String(item.prize) : undefined,
    region: item.region ? String(item.region) : undefined,
    runnerDetails,
  };
}

function mapResult(item: any): { raceId: string; result: RaceResult } | null {
  const raceId = String(item.race_id ?? "");
  if (!raceId) return null;

  const runners: RaceRunnerResult[] = (item.runners ?? []).map((r: any) => {
    const spDec = parseFloat(String(r.sp_dec ?? r.sp_decimal ?? ""));
    const spDecimal = Number.isFinite(spDec) && spDec > 1 ? spDec : undefined;
    const spRaw = r.sp ?? r.sp_fraction;
    const spLabel =
      spRaw != null && String(spRaw).trim() !== "" ? String(spRaw).trim() : undefined;
    const favMarked = /\bj?fav\b/i.test(String(spLabel ?? ""));
    return {
      horse: String(r.horse ?? "").trim(),
      position: runnerPosition(r.position),
      ...(spDecimal != null ? { spDecimal } : {}),
      ...(spLabel != null ? { spLabel } : {}),
      ...(favMarked ? { isSpFavourite: true as const } : {}),
    };
  });

  const winner =
    runners.find((r) => r.position === 1)?.horse ??
    runners.find((r) => String(r.position) === "1")?.horse ??
    "";

  if (!winner) return null;

  return {
    raceId,
    result: {
      kind: "horse_racing",
      winner,
      runners,
      fieldSize: Number(item.field_size) || runners.length,
    },
  };
}

export class RacingApiTierError extends Error {
  constructor(status: number, path: string) {
    super(`Racing API ${status} on ${path} - plan tier may not include this endpoint`);
    this.name = "RacingApiTierError";
  }
}

export function isRacingTierAccessError(error: unknown): boolean {
  if (error instanceof RacingApiTierError) return true;
  const msg = String(error).toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("auth failed") ||
    msg.includes("plan tier") ||
    msg.includes("standard plan")
  );
}

async function apiGet(path: string): Promise<any> {
  const creds = credentials();
  if (!creds) throw new Error("RACING_API_USERNAME / RACING_API_PASSWORD not configured");
  trackRequest();

  const token = Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Basic ${token}` },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new RacingApiTierError(res.status, path);
  }
  if (!res.ok) throw new Error(`Racing API ${res.status}`);
  return res.json();
}

/** Free tier - today and tomorrow basic racecards. */
export async function racecardsFree(day: "today" | "tomorrow" = "today"): Promise<RacingRacecard[]> {
  const cacheKey = `racecards:free:${day}`;
  const hit = cache.get(cacheKey) as CacheEntry<RacingRacecard[]> | undefined;
  if (hit && Date.now() - hit.at < RACECARDS_TTL) return hit.data;

  const json = await apiGet(`/v1/racecards/free?day=${day}&region_codes=gb&region_codes=ire`);
  const now = Date.now();
  const cards: RacingRacecard[] = (json.racecards ?? []).map((r: any) => mapRacecard(r, now));
  cache.set(cacheKey, { at: Date.now(), data: cards });
  return cards;
}

/** Standard tier - today/tomorrow racecards with bookmaker odds. Falls back to free on 401/403. */
export async function racecardsStandard(
  day: "today" | "tomorrow" = "today"
): Promise<RacingRacecard[] | null> {
  const cacheKey = `racecards:standard:${day}`;
  const hit = cache.get(cacheKey) as CacheEntry<RacingRacecard[]> | undefined;
  if (hit && Date.now() - hit.at < RACECARDS_TTL) return hit.data;

  try {
    const json = await apiGet(
      `/v1/racecards/standard?day=${day}&region_codes=gb&region_codes=ire`
    );
    const now = Date.now();
    const cards: RacingRacecard[] = (json.racecards ?? []).map((r: any) => mapRacecard(r, now));
    cache.set(cacheKey, { at: Date.now(), data: cards });
    return cards;
  } catch (e) {
    if (isRacingTierAccessError(e)) return null;
    throw e;
  }
}

/** Racing API access for `/v1/results/today` (Basic tier). */
export type RacingResultsTier = "basic" | "free" | "none";

export interface ResultsTodayPayload {
  results: Map<string, RaceResult>;
  /** True when credentials exist but the plan cannot call results (Free tier). */
  tierBlocked: boolean;
  tier: RacingResultsTier;
}

interface ResultsCacheData {
  results: Map<string, RaceResult>;
  tierBlocked: boolean;
  tier: RacingResultsTier;
}

const TIER_TTL = 30 * 60 * 1000;
let resultsTierCache: { at: number; tier: RacingResultsTier } | null = null;

function rememberResultsTier(tier: RacingResultsTier) {
  resultsTierCache = { at: Date.now(), tier };
}

/** Last known results-tier status (sync). Prefer `resolveRacingResultsTier` when a probe is OK. */
export function getCachedRacingResultsTier(): RacingResultsTier {
  if (!hasRacingApiKey()) return "none";
  return resultsTierCache?.tier ?? "free";
}

/**
 * Resolve whether the configured Racing API plan includes results (Basic).
 * Cached for 30 minutes after a successful probe.
 */
export async function resolveRacingResultsTier(): Promise<RacingResultsTier> {
  if (!hasRacingApiKey()) return "none";
  if (resultsTierCache && Date.now() - resultsTierCache.at < TIER_TTL) {
    return resultsTierCache.tier;
  }
  const payload = await resultsToday();
  return payload.tier;
}

/** Basic tier - today's results with finishing positions. */
export async function resultsToday(): Promise<ResultsTodayPayload> {
  const cacheKey = "results:today";
  const hit = cache.get(cacheKey) as CacheEntry<ResultsCacheData> | undefined;
  if (hit && Date.now() - hit.at < RESULTS_TTL) {
    rememberResultsTier(hit.data.tier);
    return {
      results: hit.data.results,
      tierBlocked: hit.data.tierBlocked,
      tier: hit.data.tier,
    };
  }

  if (!hasRacingApiKey()) {
    rememberResultsTier("none");
    return { results: new Map(), tierBlocked: false, tier: "none" };
  }

  try {
    // API validates limit ≤ 100; page with skip so a full GB/IRE card is covered.
    const pageSize = 100;
    const map = new Map<string, RaceResult>();
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;
    while (skip < total) {
      const json = await apiGet(
        `/v1/results/today?region=gb&region=ire&limit=${pageSize}&skip=${skip}`
      );
      const page = json.results ?? [];
      total = Number(json.total);
      if (!Number.isFinite(total) || total < 0) total = skip + page.length;
      for (const item of page) {
        const mapped = mapResult(item);
        if (mapped) map.set(mapped.raceId, mapped.result);
      }
      if (page.length === 0) break;
      skip += page.length;
      if (page.length < pageSize) break;
    }
    const data: ResultsCacheData = { results: map, tierBlocked: false, tier: "basic" };
    cache.set(cacheKey, { at: Date.now(), data });
    rememberResultsTier("basic");
    return { results: map, tierBlocked: false, tier: "basic" };
  } catch (e) {
    if (isRacingTierAccessError(e)) {
      const data: ResultsCacheData = {
        results: new Map(),
        tierBlocked: true,
        tier: "free",
      };
      cache.set(cacheKey, { at: Date.now(), data });
      rememberResultsTier("free");
      return { results: new Map(), tierBlocked: true, tier: "free" };
    }
    throw e;
  }
}

export async function racecardsByDate(
  date: string
): Promise<{ cards: RacingRacecard[]; oddsTier: "free" | "standard" }> {
  const today = localCalendarDate();
  const tomorrow = localCalendarDate(new Date(Date.now() + 86400000));
  const cards: RacingRacecard[] = [];
  let oddsTier: "free" | "standard" = "free";

  if (date === today) {
    const standard = await racecardsStandard("today");
    if (standard?.length) {
      cards.push(...standard);
      oddsTier = "standard";
    } else {
      cards.push(...(await racecardsFree("today")));
    }
  } else if (date === tomorrow) {
    const standard = await racecardsStandard("tomorrow");
    if (standard?.length) {
      cards.push(...standard);
      oddsTier = "standard";
    } else {
      cards.push(...(await racecardsFree("tomorrow")));
    }
  }

  return {
    cards: cards.filter((c) => localCalendarDate(new Date(c.startTime)) === date),
    oddsTier,
  };
}

export async function resultsForRaceIds(
  raceIds: string[]
): Promise<{ results: Map<string, RaceResult>; tierBlocked: boolean; tier: RacingResultsTier }> {
  if (raceIds.length === 0) {
    const tier = getCachedRacingResultsTier();
    return { results: new Map(), tierBlocked: tier === "free", tier };
  }
  const today = await resultsToday();
  const out = new Map<string, RaceResult>();
  for (const id of raceIds) {
    const hit = today.results.get(id);
    if (hit) out.set(id, hit);
  }
  return { results: out, tierBlocked: today.tierBlocked, tier: today.tier };
}

/** Optional premium odds history from The Racing API. */
export async function fetchRunnerOddsHistory(
  raceId: string,
  horseId: string
): Promise<{ horse: string; history: Array<{ price: number; capturedAt?: string }> } | null> {
  try {
    const json = await apiGet(`/v1/odds/${encodeURIComponent(raceId)}/${encodeURIComponent(horseId)}`);
    const history = (json.odds ?? [])
      .map((o: any) => ({
        price: parseFloat(String(o.decimal ?? o.price ?? "")),
        capturedAt: o.timestamp ?? o.time,
      }))
      .filter((o: { price: number }) => Number.isFinite(o.price) && o.price > 1);
    return {
      horse: String(json.horse ?? ""),
      history,
    };
  } catch {
    return null;
  }
}

/** Demo racecards when no API key is configured. */
export function demoRacecards(): RacingRacecard[] {
  const now = Date.now();
  const base = new Date();
  base.setHours(14, 30, 0, 0);
  if (base.getTime() < now) base.setDate(base.getDate() + 1);

  const runnerDetails: RacingRunnerDetail[] = [
    { horseId: "h1", name: "Constitution Hill", number: "1", jockey: "Nico de Boinville", trainer: "N Henderson", form: "1111", spDecimal: 2.5, spFraction: "6/4", nonRunner: false },
    { horseId: "h2", name: "State Man", number: "2", jockey: "P Townend", trainer: "W Mullins", form: "1212", spDecimal: 4.0, spFraction: "3/1", nonRunner: false },
    { horseId: "h3", name: "Galopin Des Champs", number: "3", jockey: "M Walsh", trainer: "W Mullins", form: "1121", spDecimal: 6.5, spFraction: "11/2", nonRunner: false },
    { horseId: "h4", name: "Bravemansgame", number: "4", jockey: "H Cobden", trainer: "P Nicholls", form: "2113", spDecimal: 9.0, spFraction: "8/1", nonRunner: false },
    { horseId: "h5", name: "Shishkin", number: "5", jockey: "B Frost", trainer: "N Henderson", form: "1312", spDecimal: 12.0, spFraction: "11/1", nonRunner: false },
    { horseId: "h6", name: "Jonbon", number: "6", jockey: "A Coleman", trainer: "N Henderson", form: "1221", spDecimal: 15.0, spFraction: "14/1", nonRunner: false },
    { horseId: "h7", name: "Langer Dan", number: "7", jockey: "H Skelton", trainer: "D Skelton", form: "2134", spDecimal: 21.0, spFraction: "20/1", nonRunner: false },
    { horseId: "h8", name: "Telescope", number: "8", jockey: "J McGrath", trainer: "A King", form: "4521", spDecimal: 34.0, spFraction: "33/1", nonRunner: false },
  ];

  return [
    {
      externalId: "demo-race-1",
      sport: "horse_racing",
      competition: "Lingfield",
      raceName: "Demo Handicap Hurdle",
      course: "Lingfield",
      startTime: base.getTime(),
      status: "upcoming",
      fieldSize: 8,
      offTime: "14:30",
      runners: runnerDetails.map((r) => r.name),
      distance: "2m 3f",
      going: "Good to Soft",
      raceClass: "Class 2",
      type: "Hurdle",
      prize: "£25,000",
      region: "GB",
      runnerDetails,
    },
    {
      externalId: "demo-race-2",
      sport: "horse_racing",
      competition: "Kempton",
      raceName: "Extra Place Handicap Chase",
      course: "Kempton",
      startTime: base.getTime() + 45 * 60 * 1000,
      status: "upcoming",
      fieldSize: 6,
      offTime: "15:15",
      runners: ["Edwardstone", "Elixir d'Ainay", "Protektorat", "Fakir d'Oudairies", "L'Homme Presse", "Ga Law"],
      distance: "3m",
      going: "Soft",
      raceClass: "Class 3",
      type: "Chase",
      prize: "£18,000",
      region: "GB",
      runnerDetails: [
        { horseId: "k1", name: "Edwardstone", number: "1", jockey: "B Frost", trainer: "A King", form: "1211", spDecimal: 3.5, nonRunner: false },
        { horseId: "k2", name: "Elixir d'Ainay", number: "2", jockey: "P Townend", trainer: "W Mullins", form: "1122", spDecimal: 5.0, nonRunner: false },
        { horseId: "k3", name: "Protektorat", number: "3", jockey: "H Skelton", trainer: "D Skelton", form: "2311", spDecimal: 7.5, nonRunner: false },
        { horseId: "k4", name: "Fakir d'Oudairies", number: "4", jockey: "M Walsh", trainer: "W Mullins", form: "1223", spDecimal: 11.0, nonRunner: false },
        { horseId: "k5", name: "L'Homme Presse", number: "5", jockey: "Nico de Boinville", trainer: "N Henderson", form: "2132", spDecimal: 17.0, nonRunner: false },
        { horseId: "k6", name: "Ga Law", number: "6", jockey: "H Cobden", trainer: "P Nicholls", form: "3421", spDecimal: 26.0, nonRunner: false },
      ],
    },
  ];
}

export function raceResultToGoals(result: RaceResult): string {
  return serializeRaceResults(result);
}
