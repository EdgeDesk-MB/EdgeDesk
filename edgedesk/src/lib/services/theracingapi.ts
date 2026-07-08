/**
 * The Racing API (https://www.theracingapi.com) — UK & Irish horse racing.
 *
 * Free plan: `/v1/racecards/free` (today + tomorrow racecards).
 * Basic plan: `/v1/results/today` (live results for auto-settlement).
 *
 * Auth: HTTP Basic — username + password from your dashboard.
 */

import {
  type RaceResult,
  type RaceRunnerResult,
  runnerPosition,
  serializeRaceResults,
} from "@/lib/racing";
import type { RacingRunnerDetail } from "@/lib/racing-desk/types";
import { parseJockeyName } from "@/lib/racing/runner-display";

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
const RESULTS_TTL = 90 * 1000;

const DAILY_BUDGET = 200;
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

function credentials(): { user: string; pass: string } | null {
  const user = process.env.RACING_API_USERNAME?.trim();
  const pass = process.env.RACING_API_PASSWORD?.trim();
  if (!user || !pass) return null;
  return { user, pass };
}

export function hasRacingApiKey(): boolean {
  return !!credentials();
}

export function racingApiUsageToday(): { used: number; budget: number } {
  const today = new Date().toISOString().slice(0, 10);
  return { used: today === budgetDay ? requestsToday : 0, budget: DAILY_BUDGET };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseOffTime(offDt: string | undefined, offTime: string | undefined, date: string): number {
  if (offDt) {
    const ms = Date.parse(offDt);
    if (!Number.isNaN(ms)) return ms;
  }
  const time = (offTime ?? "12:00").trim();
  const ms = Date.parse(`${date}T${time}:00`);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function mapRunner(r: any, index: number): RacingRunnerDetail {
  const spDec = parseFloat(String(r.sp_dec ?? r.sp_decimal ?? ""));
  const spDecimal = Number.isFinite(spDec) && spDec > 1 ? spDec : undefined;
  const spRaw = r.sp ?? r.sp_fraction;
  const lbsNum = parseInt(String(r.lbs ?? r.weight_lbs ?? ""), 10);
  const lbs = Number.isFinite(lbsNum) && lbsNum > 0 ? lbsNum : undefined;
  const jockeyRaw = String(r.jockey ?? r.jockey_name ?? "—");
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
  return {
    horseId: String(r.horse_id ?? r.horse ?? `runner-${index}`),
    name: String(r.horse ?? "").trim(),
    number: String(r.number ?? r.cloth ?? index + 1),
    draw,
    jockey,
    jockeyClaim,
    trainer: String(r.trainer ?? r.trainer_name ?? "—"),
    age: r.age != null ? String(r.age) : undefined,
    weight: lbs != null ? `${lbs}lbs` : r.weight != null ? String(r.weight) : undefined,
    weightLbs: lbs,
    horseColour: r.colour != null ? String(r.colour) : undefined,
    headgear,
    silkUrl: typeof silkUrl === "string" && silkUrl.trim() ? silkUrl.trim() : undefined,
    ofr: r.ofr != null ? String(r.ofr) : undefined,
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
    distance: item.distance ? String(item.distance) : undefined,
    going: item.going ? String(item.going) : undefined,
    raceClass: item.race_class ? String(item.race_class) : undefined,
    type: item.type ? String(item.type) : undefined,
    prize: item.prize ? String(item.prize) : undefined,
    region: item.region ? String(item.region) : undefined,
    runnerDetails,
  };
}

function mapResult(item: any): { raceId: string; result: RaceResult } | null {
  const raceId = String(item.race_id ?? "");
  if (!raceId) return null;

  const runners: RaceRunnerResult[] = (item.runners ?? []).map((r: any) => ({
    horse: String(r.horse ?? "").trim(),
    position: runnerPosition(r.position),
  }));

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
    super(`Racing API ${status} on ${path} — plan tier may not include this endpoint`);
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
  if (!spendBudget()) throw new Error("Racing API daily request budget exhausted");

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

/** Free tier — today and tomorrow basic racecards. */
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

/** Standard tier — today/tomorrow racecards with bookmaker odds. Falls back to free on 401/403. */
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

/** Basic tier — today's results with finishing positions. Returns [] if plan lacks access. */
export async function resultsToday(): Promise<Map<string, RaceResult>> {
  const cacheKey = "results:today";
  const hit = cache.get(cacheKey) as CacheEntry<Map<string, RaceResult>> | undefined;
  if (hit && Date.now() - hit.at < RESULTS_TTL) return hit.data;

  try {
    const json = await apiGet("/v1/results/today?region=gb&region=ire&limit=50");
    const map = new Map<string, RaceResult>();
    for (const item of json.results ?? []) {
      const mapped = mapResult(item);
      if (mapped) map.set(mapped.raceId, mapped.result);
    }
    cache.set(cacheKey, { at: Date.now(), data: map });
    return map;
  } catch (e) {
    if (isRacingTierAccessError(e)) return new Map();
    throw e;
  }
}

export async function racecardsByDate(
  date: string
): Promise<{ cards: RacingRacecard[]; oddsTier: "free" | "standard" }> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
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
    cards: cards.filter((c) => new Date(c.startTime).toISOString().slice(0, 10) === date),
    oddsTier,
  };
}

export async function resultsForRaceIds(raceIds: string[]): Promise<Map<string, RaceResult>> {
  if (raceIds.length === 0) return new Map();
  const today = await resultsToday();
  const out = new Map<string, RaceResult>();
  for (const id of raceIds) {
    const hit = today.get(id);
    if (hit) out.set(id, hit);
  }
  return out;
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
