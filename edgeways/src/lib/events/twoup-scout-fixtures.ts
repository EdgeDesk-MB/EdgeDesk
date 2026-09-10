import { footballScopeId } from "@/lib/events/fixture-scope";

export const TWOUP_SCOUT_WARM_CAP = 40;

export type TwoupScoutFixture = {
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  status: "upcoming" | "live" | "finished";
  competition: string;
  leagueCountry?: string | null;
};

export function pickTwoupScoutFixtures<T extends TwoupScoutFixture>(
  fixtures: T[],
  scopeIds: readonly string[],
  now: number = Date.now(),
  cap: number | null = TWOUP_SCOUT_WARM_CAP
): T[] {
  const scopes = new Set(scopeIds);
  if (scopes.size === 0) return [];
  const picked = fixtures
    .filter((fixture) => fixture.status === "upcoming" && fixture.startTime > now)
    .filter((fixture) =>
      scopes.has(footballScopeId(fixture.competition, fixture.leagueCountry))
    )
    .sort((a, b) => a.startTime - b.startTime || a.homeTeam.localeCompare(b.homeTeam));
  return cap == null || cap < 0 ? picked : picked.slice(0, cap);
}
