/**
 * Public API-Football adapter. Implementation lives in `apifootball-feed.ts`
 * so this path cannot carry a duplicate `lineupsCache`.
 */
export type { Fixture, FixtureDetail, FixtureGoal, FootballTeamGoalRates } from "./apifootball-feed";
export {
  DAILY_BUDGET,
  apiUsageToday,
  apiUsageTodayAsync,
  currentLeagues,
  demoCompetitions,
  demoFixtures,
  demoFixturesForHorizon,
  fixtureById,
  fixtureDetail,
  fixtureGoalEvents,
  fixtureLineups,
  fixtureMatchEvents,
  fixturesByDate,
  fixturesByIds,
  footballOperation,
  hasApiKey,
  leagueStandings,
  liveFixtures,
  localCalendarDate,
  peekLiveFixtures,
  pingApiFootball,
  scheduleLiveFixturesRefresh,
  searchFixtureByTeams,
} from "./apifootball-feed";
