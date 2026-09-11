import { footballScopeId } from "@/lib/events/fixture-scope";
import { localCalendarDate } from "@/lib/events";

export const TWOUP_SCOUT_WARM_CAP = 40;
/** Stale-but-present prices can wait; missing pinned rows must not. */
export const SCOUT_ODDS_STALE_ENQUEUE_CAP = 6;

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
  cap: number | null = TWOUP_SCOUT_WARM_CAP,
  includeLive = false
): T[] {
  const scopes = new Set(scopeIds);
  if (scopes.size === 0) return [];
  const picked = fixtures
    .filter((fixture) =>
      fixture.status === "live"
        ? includeLive
        : fixture.status === "upcoming" && fixture.startTime > now
    )
    .filter((fixture) =>
      scopes.has(footballScopeId(fixture.competition, fixture.leagueCountry))
    )
    .sort((a, b) => a.startTime - b.startTime || a.homeTeam.localeCompare(b.homeTeam));
  return cap == null || cap < 0 ? picked : picked.slice(0, cap);
}

/** Today’s pinned upcoming first (uncapped), then later days to fill `cap`. */
export function pickTwoupScoutWarmFixtures<T extends TwoupScoutFixture>(
  fixtures: T[],
  scopeIds: readonly string[],
  today: string,
  now: number = Date.now(),
  cap: number = TWOUP_SCOUT_WARM_CAP
): T[] {
  const onToday = fixtures.filter(
    (fixture) => localCalendarDate(new Date(fixture.startTime)) === today
  );
  const later = fixtures.filter(
    (fixture) => localCalendarDate(new Date(fixture.startTime)) !== today
  );
  const todayPick = pickTwoupScoutFixtures(onToday, scopeIds, now, null);
  const remaining = Math.max(0, cap - todayPick.length);
  return [
    ...todayPick,
    ...pickTwoupScoutFixtures(later, scopeIds, now, remaining),
  ];
}

export type ScoutOddsFreshness = "fresh" | "stale" | "missing";

/**
 * Page-load refresh: every pinned row with no store price, then a few stale
 * ones. Earlier kick-offs must not starve later 20:00 pins.
 */
export function pickScoutOddsRefreshTargets<T extends { key: string }>(
  items: T[],
  freshness: (key: string) => ScoutOddsFreshness,
  staleCap: number = SCOUT_ODDS_STALE_ENQUEUE_CAP
): T[] {
  const missing: T[] = [];
  const stale: T[] = [];
  for (const item of items) {
    const state = freshness(item.key);
    if (state === "missing") missing.push(item);
    else if (state === "stale") stale.push(item);
  }
  return [...missing, ...stale.slice(0, Math.max(0, staleCap))];
}
