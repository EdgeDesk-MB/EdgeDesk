/**
 * 2UP openness for upcoming fixtures in the desk's pinned competitions.
 */
import "server-only";

import { twoupOpenness, twoupScoutKey, type TwoupOpennessResult } from "@/lib/calc/ep/twoup-openness";
import { localCalendarDate } from "@/lib/events";
import { footballScopeId } from "@/lib/events/fixture-scope";
import { pickTwoupScoutFixtures } from "@/lib/events/twoup-scout-fixtures";
import { getFixturesForDate } from "@/lib/services/fixture-store";
import {
  getFootballOddsForFixture,
  listPinnedFootballScopesForDesk,
  readFootballOddsStore,
  type StoredFootballOdds,
} from "@/lib/services/football-odds-store";
import {
  getFootballStandingsForScope,
  lookupVenueGoalRates,
  type StoredStandingsRates,
} from "@/lib/services/football-standings-store";
import type { Fixture } from "@/lib/services/apifootball";

export interface TwoupScoutItem {
  key: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  openness: TwoupOpennessResult;
}

function opennessFromStored(
  fixture: Fixture,
  stored: StoredFootballOdds | null,
  standings: StoredStandingsRates | null
): TwoupOpennessResult {
  const venue = standings
    ? lookupVenueGoalRates(standings, fixture.homeTeam, fixture.awayTeam)
    : null;
  const modelXg =
    stored?.modelXh != null && stored.modelXa != null
      ? stored.modelXh + stored.modelXa
      : undefined;
  return twoupOpenness({
    over25Back: stored?.odds.over25Back,
    bttsYesBack: stored?.odds.bttsYesBack,
    homeBack: stored?.odds.homeBack,
    drawBack: stored?.odds.drawBack,
    awayBack: stored?.odds.awayBack,
    windfallHome: stored?.windfallHome,
    windfallAway: stored?.windfallAway,
    twoUpHome: stored?.twoUpHome,
    twoUpAway: stored?.twoUpAway,
    winHome: stored?.winHome,
    winAway: stored?.winAway,
    computeWindfall: false,
    homeGf: venue?.homeGf,
    homeGa: venue?.homeGa,
    awayGf: venue?.awayGf,
    awayGa: venue?.awayGa,
    leagueAvgGf: standings?.leagueAvgGf,
    leagueAvgGa: standings?.leagueAvgGa,
    modelXg,
  });
}

export async function getTwoupScoutForDate(date: string): Promise<TwoupScoutItem[]> {
  const scopes = await listPinnedFootballScopesForDesk();
  if (scopes.length === 0) return [];
  const { fixtures } = await getFixturesForDate(date);
  const candidates = pickTwoupScoutFixtures(fixtures, scopes, Date.now(), null);
  const standingsByScope = new Map<string, StoredStandingsRates | null>();
  const items: TwoupScoutItem[] = [];

  for (const fixture of candidates) {
    const scopeId = footballScopeId(fixture.competition, fixture.leagueCountry);
    if (!standingsByScope.has(scopeId)) {
      standingsByScope.set(scopeId, await getFootballStandingsForScope(scopeId).catch(() => null));
    }
    const key = twoupScoutKey({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      startTime: fixture.startTime,
    });
    let stored = await readFootballOddsStore(key).catch(() => null);
    if (!stored) {
      stored = await getFootballOddsForFixture({
        home: fixture.homeTeam,
        away: fixture.awayTeam,
        startTime: fixture.startTime,
        date: localCalendarDate(new Date(fixture.startTime)),
      }).catch(() => null);
    } else {
      void getFootballOddsForFixture({
        home: fixture.homeTeam,
        away: fixture.awayTeam,
        startTime: fixture.startTime,
        date: localCalendarDate(new Date(fixture.startTime)),
      }).catch(() => null);
    }
    items.push({
      key,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      startTime: fixture.startTime,
      openness: opennessFromStored(fixture, stored, standingsByScope.get(scopeId) ?? null),
    });
  }

  return items;
}

export async function getTwoupScoutForFixture(input: {
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  competition?: string | null;
  leagueCountry?: string | null;
}): Promise<TwoupScoutItem | null> {
  const homeTeam = input.homeTeam.trim();
  const awayTeam = input.awayTeam.trim();
  if (!homeTeam || !awayTeam || !Number.isFinite(input.startTime)) return null;

  const fixture: Fixture = {
    externalId: "",
    sport: "football",
    competition: input.competition?.trim() || "",
    homeTeam,
    awayTeam,
    startTime: input.startTime,
    status: "upcoming",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    leagueCountry: input.leagueCountry ?? null,
  };

  let standings: StoredStandingsRates | null = null;
  if (fixture.competition) {
    const scopeId = footballScopeId(fixture.competition, fixture.leagueCountry);
    standings = await getFootballStandingsForScope(scopeId).catch(() => null);
  }

  const stored = await getFootballOddsForFixture({
    home: homeTeam,
    away: awayTeam,
    startTime: input.startTime,
    date: localCalendarDate(new Date(input.startTime)),
  }).catch(() => null);

  return {
    key: twoupScoutKey({
      homeTeam,
      awayTeam,
      startTime: input.startTime,
    }),
    homeTeam,
    awayTeam,
    startTime: input.startTime,
    openness: opennessFromStored(fixture, stored, standings),
  };
}
