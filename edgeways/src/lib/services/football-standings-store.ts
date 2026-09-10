/**
 * Durable league GF/GA rates for 2UP scout (server-only).
 * One API-Football standings call per pinned league per day.
 * Global feed data, no clerk scoping.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db, footballStandingsCache } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { footballScopeId } from "@/lib/events/fixture-scope";
import { canonicalizeTeam } from "@/lib/services/exchange/football-match";
import {
  hasApiKey,
  leagueStandings,
  type FootballTeamGoalRates,
} from "@/lib/services/apifootball";
import { peekFootballCompetitionCatalog } from "@/lib/services/football-competition-store";

export const FOOTBALL_STANDINGS_STORE_FRESH_MS = 24 * 60 * 60 * 1000;

export interface StoredTeamRates {
  gf: number;
  ga: number;
  played: number;
  homeGf?: number;
  homeGa?: number;
  homePlayed?: number;
  awayGf?: number;
  awayGa?: number;
  awayPlayed?: number;
}

export interface StoredStandingsRates {
  teams: Record<string, StoredTeamRates>;
  leagueAvgGf: number;
  leagueAvgGa: number;
  fetchedAt: number;
}

function parseRow(row: { payload: string; fetchedAt: number }): StoredStandingsRates | null {
  try {
    const parsed = JSON.parse(row.payload) as StoredStandingsRates;
    if (!parsed?.teams || typeof parsed.teams !== "object") return null;
    return { ...parsed, fetchedAt: row.fetchedAt };
  } catch {
    return null;
  }
}

function ratesFromTeams(teams: FootballTeamGoalRates[]): StoredStandingsRates | null {
  if (teams.length === 0) return null;
  const map: StoredStandingsRates["teams"] = {};
  let gf = 0;
  let ga = 0;
  for (const team of teams) {
    map[canonicalizeTeam(team.name)] = {
      gf: team.gf,
      ga: team.ga,
      played: team.played,
      homeGf: team.homeGf,
      homeGa: team.homeGa,
      homePlayed: team.homePlayed,
      awayGf: team.awayGf,
      awayGa: team.awayGa,
      awayPlayed: team.awayPlayed,
    };
    gf += team.gf;
    ga += team.ga;
  }
  return {
    teams: map,
    leagueAvgGf: gf / teams.length,
    leagueAvgGa: ga / teams.length,
    fetchedAt: Date.now(),
  };
}

export function lookupTeamGoalRates(
  stored: StoredStandingsRates,
  teamName: string
): { gf: number; ga: number } | null {
  const row = stored.teams[canonicalizeTeam(teamName)];
  if (!row) return null;
  return { gf: row.gf, ga: row.ga };
}

/** Home side at home vs away side away. Falls back to season averages. */
export function lookupVenueGoalRates(
  stored: StoredStandingsRates,
  homeTeam: string,
  awayTeam: string
): { homeGf: number; homeGa: number; awayGf: number; awayGa: number } | null {
  const home = stored.teams[canonicalizeTeam(homeTeam)];
  const away = stored.teams[canonicalizeTeam(awayTeam)];
  if (!home || !away) return null;
  return {
    homeGf: home.homeGf ?? home.gf,
    homeGa: home.homeGa ?? home.ga,
    awayGf: away.awayGf ?? away.gf,
    awayGa: away.awayGa ?? away.ga,
  };
}

export async function readFootballStandingsStore(
  scopeId: string
): Promise<StoredStandingsRates | null> {
  if (isNeonDesk()) {
    const { readNeonFootballStandingsCache } = await import(
      "@/lib/db/neon-football-standings-cache"
    );
    const row = await readNeonFootballStandingsCache(scopeId);
    return row ? parseRow(row) : null;
  }
  const row = db
    .select()
    .from(footballStandingsCache)
    .where(eq(footballStandingsCache.scopeId, scopeId))
    .get();
  return row ? parseRow(row) : null;
}

export async function writeFootballStandingsStore(input: {
  scopeId: string;
  leagueId?: number | null;
  season?: number | null;
  rates: StoredStandingsRates;
}): Promise<void> {
  const payload = JSON.stringify(input.rates);
  if (isNeonDesk()) {
    const { writeNeonFootballStandingsCache } = await import(
      "@/lib/db/neon-football-standings-cache"
    );
    await writeNeonFootballStandingsCache({
      scopeId: input.scopeId,
      leagueId: input.leagueId ?? null,
      season: input.season ?? null,
      payload,
      fetchedAt: input.rates.fetchedAt,
    });
    return;
  }
  db.insert(footballStandingsCache)
    .values({
      scopeId: input.scopeId,
      leagueId: input.leagueId ?? null,
      season: input.season ?? null,
      payload,
      fetchedAt: input.rates.fetchedAt,
    })
    .onConflictDoUpdate({
      target: footballStandingsCache.scopeId,
      set: {
        leagueId: input.leagueId ?? null,
        season: input.season ?? null,
        payload,
        fetchedAt: input.rates.fetchedAt,
      },
    })
    .run();
}

const refreshInflight = new Map<string, Promise<StoredStandingsRates | null>>();

export function refreshFootballStandingsStore(input: {
  scopeId: string;
  leagueId: number;
  season: number;
}): Promise<StoredStandingsRates | null> {
  const existing = refreshInflight.get(input.scopeId);
  if (existing) return existing;
  const work = (async () => {
    const teams = await leagueStandings(input.leagueId, input.season);
    const rates = ratesFromTeams(teams);
    if (!rates) return null;
    await writeFootballStandingsStore({
      scopeId: input.scopeId,
      leagueId: input.leagueId,
      season: input.season,
      rates,
    });
    return rates;
  })().finally(() => {
    refreshInflight.delete(input.scopeId);
  });
  refreshInflight.set(input.scopeId, work);
  return work;
}

export async function getFootballStandingsForScope(
  scopeId: string
): Promise<StoredStandingsRates | null> {
  const stored = await readFootballStandingsStore(scopeId).catch(() => null);
  const now = Date.now();
  if (stored && now - stored.fetchedAt < FOOTBALL_STANDINGS_STORE_FRESH_MS) {
    return stored;
  }

  const catalog = await peekFootballCompetitionCatalog();
  const entry = catalog.find(
    (row) => footballScopeId(row.name, row.country) === scopeId
  );
  if (
    entry?.leagueId == null ||
    entry.season == null ||
    !Number.isFinite(entry.leagueId) ||
    !Number.isFinite(entry.season)
  ) {
    return stored;
  }

  if (stored) {
    void refreshFootballStandingsStore({
      scopeId,
      leagueId: entry.leagueId,
      season: entry.season,
    }).catch(() => null);
    return stored;
  }

  return refreshFootballStandingsStore({
    scopeId,
    leagueId: entry.leagueId,
    season: entry.season,
  }).catch(() => null);
}

export async function warmFootballStandingsStore(
  scopeIds: readonly string[]
): Promise<{ warmed: number; skipped: number }> {
  if (!hasApiKey()) return { warmed: 0, skipped: 0 };
  const unique = [...new Set(scopeIds)];
  let warmed = 0;
  let skipped = 0;
  for (const scopeId of unique) {
    const stored = await readFootballStandingsStore(scopeId).catch(() => null);
    if (stored && Date.now() - stored.fetchedAt < FOOTBALL_STANDINGS_STORE_FRESH_MS) {
      skipped += 1;
      continue;
    }
    const next = await getFootballStandingsForScope(scopeId);
    if (next && (!stored || next.fetchedAt !== stored.fetchedAt)) warmed += 1;
    else if (stored) skipped += 1;
  }
  return { warmed, skipped };
}
