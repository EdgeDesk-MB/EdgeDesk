import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(__dirname, "../../app/api");
const stateSource = readFileSync(resolve(__dirname, "neon-desk-state.ts"), "utf8");
const appStateSource = readFileSync(
  resolve(__dirname, "../services/state.ts"),
  "utf8"
);

function routeSource(rel: string): string {
  return readFileSync(resolve(apiRoot, rel), "utf8");
}

function listRouteFiles(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listRouteFiles(resolve(dir, entry.name), next));
    else if (entry.name === "route.ts") out.push(next);
  }
  return out;
}

/** Localhost-only or operator routes. Everything else that mutates via SQLite must gate on Neon. */
const SQLITE_MUTATION_ALLOWLIST = [
  /^admin\//,
  /^cron\//,
  /^data\/demo\//,
];

function isSqliteMutationUngated(rel: string, src: string): boolean {
  if (SQLITE_MUTATION_ALLOWLIST.some((re) => re.test(rel))) return false;
  const importsSqlite = /from ["']@\/lib\/db["']/.test(src);
  const mutates = /export const (POST|PATCH|PUT|DELETE)\b/.test(src);
  const gates = /\bisNeonDesk\b/.test(src);
  return importsSqlite && mutates && !gates;
}

describe("hosted desk cutover", () => {
  it("no longer blocks Boosts, mug plans, effort, reminders, desks, or promo awards", () => {
    const sources = [
      routeSource("boosts/route.ts"),
      routeSource("boosts/[id]/route.ts"),
      routeSource("mug-plans/route.ts"),
      routeSource("mug-plans/[id]/route.ts"),
      routeSource("effort/route.ts"),
      routeSource("reminders/route.ts"),
      routeSource("bets/[id]/award-free-bet/route.ts"),
      routeSource("acca/route.ts"),
      routeSource("acca/[id]/route.ts"),
      routeSource("acca/legs/[id]/route.ts"),
      routeSource("systems/route.ts"),
      routeSource("systems/[id]/route.ts"),
      routeSource("bet-builder/route.ts"),
      routeSource("bet-builder/[id]/route.ts"),
      routeSource("bet-builder/selections/[id]/route.ts"),
      routeSource("racing/overrides/route.ts"),
      routeSource("report/route.ts"),
      routeSource("offers/route.ts"),
      routeSource("offers/[id]/route.ts"),
    ];
    for (const src of sources) {
      expect(src).not.toMatch(/blockHostedDeskMutation/);
    }
  });

  it("writes hosted playbook steps, mistake tags, and clerk-scoped recurrence", () => {
    const patch = routeSource("offers/[id]/route.ts");
    const create = routeSource("offers/route.ts");
    expect(patch).toMatch(/setNeonMistakeTag/);
    expect(patch).toMatch(/rulesAfterPlaybookStep/);
    expect(patch).toMatch(/listNeonDeskBetsForOffer/);
    expect(patch).toMatch(/stopNeonRecurrenceForOffer/);
    expect(create).toMatch(/createNeonOfferSeriesWithInstance/);
    expect(create).not.toMatch(/Recurring offers are not available yet/);
    expect(routeSource("casino/route.ts")).toMatch(
      /createNeonCasinoOfferSeriesWithInstance/
    );
    expect(routeSource("casino/route.ts")).not.toMatch(
      /Recurring casino offers are not available yet/
    );
  });

  it("reads Edge report baselines from Neon on the hosted desk", () => {
    expect(routeSource("report/route.ts")).toMatch(/listNeonAllSnapshots/);
    expect(routeSource("offers/route.ts")).toMatch(/writeNeonEvLock/);
    expect(routeSource("offers/route.ts")).toMatch(/promoAwardsFromTransactions/);
  });

  it("fires hosted weekly and daily digests from the Home poll", () => {
    expect(stateSource).toMatch(/maybeSendNeonWeeklyDigest/);
    expect(stateSource).toMatch(/maybeSendNeonDailyTasksDigest/);
  });

  it("retires match simulation instead of hosting it", () => {
    expect(routeSource("events/route.ts")).toMatch(/status: 410/);
    expect(routeSource("events/route.ts")).not.toMatch(/blockHostedDeskMutation/);
    expect(routeSource("events/simulations/route.ts")).toMatch(/status: 410/);
    expect(routeSource("events/simulations/route.ts")).not.toMatch(/blockHostedDeskMutation/);
  });

  it("never lets a customer mutation write SQLite on the hosted desk", () => {
    const ungated = listRouteFiles(apiRoot).filter((rel) =>
      isSqliteMutationUngated(rel, routeSource(rel))
    );
    expect(ungated).toEqual([]);
  });

  it("offer inbox routes dual-path through the offer-inbox service", () => {
    // The webhook and its settings route must never touch a desk store
    // directly: all reads/writes go through the service, which gates on
    // isNeonDesk and writes Neon clerk-scoped when hosted.
    const webhook = routeSource("offers/inbound/route.ts");
    const settings = routeSource("settings/offer-inbox/route.ts");
    expect(webhook).toMatch(/@\/lib\/services\/offer-inbox/);
    expect(webhook).not.toMatch(/from ["']@\/lib\/db["']/);
    expect(settings).toMatch(/@\/lib\/services\/offer-inbox/);
    expect(settings).not.toMatch(/from ["']@\/lib\/db["']/);
    const service = readFileSync(
      resolve(__dirname, "../services/offer-inbox.ts"),
      "utf8"
    );
    expect(service).toMatch(/isNeonDesk/);
    expect(service).toMatch(/insertNeonDeskOfferForUser/);
    expect(service).toMatch(/recordNeonAlertsForUser/);
  });

  it("day-card stores dual-path Neon and desk routes read the store", () => {
    const racecards = readFileSync(
      resolve(__dirname, "../services/racecard-store.ts"),
      "utf8"
    );
    const fixtures = readFileSync(
      resolve(__dirname, "../services/fixture-store.ts"),
      "utf8"
    );
    expect(racecards).toMatch(/isNeonDesk/);
    expect(fixtures).toMatch(/isNeonDesk/);
    expect(routeSource("fixtures/route.ts")).toMatch(/getFixturesForDate/);
    expect(routeSource("racing/racecards/route.ts")).toMatch(/getRacecardsForDate/);
    expect(routeSource("cron/warm-racecards/route.ts")).toMatch(/warmFixtureStore/);
    expect(routeSource("cron/warm-racecards/route.ts")).toMatch(
      /warmFootballCompetitionCatalog/
    );
    expect(routeSource("cron/warm-racecards/route.ts")).toMatch(/warmFootballOddsStore/);
    expect(routeSource("cron/warm-racecards/route.ts")).toMatch(/warmFootballStandingsStore/);
    const footballOdds = readFileSync(
      resolve(__dirname, "../services/football-odds-store.ts"),
      "utf8"
    );
    const standings = readFileSync(
      resolve(__dirname, "../services/football-standings-store.ts"),
      "utf8"
    );
    expect(footballOdds).toMatch(/isNeonDesk/);
    expect(standings).toMatch(/isNeonDesk/);
    const neonOdds = readFileSync(
      resolve(__dirname, "neon-football-odds-cache.ts"),
      "utf8"
    );
    expect(neonOdds).toMatch(/ensureNeonFootballScoutTables/);
    expect(routeSource("fixtures/twoup-scout/route.ts")).toMatch(/getTwoupScoutForDate/);
    expect(routeSource("fixtures/twoup-scout/route.ts")).toMatch(/twoup_scout/);
    expect(routeSource("fixtures/twoup-scout/route.ts")).toMatch(
      /resolveTwoupScoutPreview/
    );
    expect(routeSource("settings/route.ts")).toMatch(/resolveTwoupScoutPreview/);
    expect(routeSource("state/route.ts")).toMatch(/resolveTwoupScoutPreview/);
    expect(routeSource("admin/releases/route.ts")).toMatch(/writeDeskPreviews/);
    const competitions = readFileSync(
      resolve(__dirname, "../services/football-competition-store.ts"),
      "utf8"
    );
    expect(competitions).toMatch(/isNeonDesk/);
    expect(routeSource("fixtures/route.ts")).toMatch(/peekFootballCompetitionCatalog/);
    expect(routeSource("fixtures/competitions/route.ts")).toMatch(
      /getFootballCompetitionCatalog/
    );
  });

  it("match-tape miss writes Neon on the hosted desk", () => {
    const tape = readFileSync(
      resolve(__dirname, "../services/event-match-tape.ts"),
      "utf8"
    );
    expect(tape).toMatch(/isNeonDesk/);
    expect(tape).toMatch(/updateNeonEvent/);
    expect(tape).toMatch(/fixtureMatchEvents/);
    expect(routeSource("events/[id]/tape/route.ts")).toMatch(/ensureEventMatchTape/);
  });

  it("stores bets.quick_logged as epoch ms (bigint), not int4", () => {
    // Date.now() overflows Postgres integer. The campaign tick writes that
    // stamp; leaving the column on int4 500s POST /api/bets on the hosted desk.
    const schema = readFileSync(resolve(__dirname, "schema.pg.ts"), "utf8");
    expect(schema).toMatch(/quickLogged:\s*epochMs\("quick_logged"\)/);
    expect(schema).not.toMatch(/quickLogged:\s*integer\("quick_logged"\)/);
  });

  it("persists desk settings including hidden competitions on Neon", () => {
    const settings = routeSource("settings/route.ts");
    expect(settings).toMatch(/isNeonDesk/);
    expect(settings).toMatch(/patchNeonDeskSettings/);
    expect(settings).toMatch(/hiddenFootballScopes/);
    expect(settings).toMatch(/hiddenRacingCourses/);
    expect(settings).toMatch(/bookieScopes/);
    expect(settings).toMatch(/isFixtureScopeSettingsPatch/);
    const neonSettings = readFileSync(
      resolve(__dirname, "neon-desk-settings.ts"),
      "utf8"
    );
    expect(neonSettings).toMatch(/deskSettings: JSON\.stringify\(next\)/);
  });

  it("serves hosted Home with ETag revalidation", () => {
    const stateRoute = routeSource("state/route.ts");
    expect(stateRoute).toMatch(/slimAppStateForWire/);
    expect(stateRoute).toMatch(/etagForJsonBody/);
    expect(stateRoute).toMatch(/304/);
  });

  it("builds Home from Neon when the hosted desk flag is on", () => {
    expect(appStateSource).toMatch(/isNeonDesk\(\)/);
    expect(appStateSource).toMatch(/buildNeonDeskAppState/);
  });

  it("does not block the hosted Home snapshot on sequential housekeeping", () => {
    expect(stateSource).toMatch(/scheduleHostedDeskHousekeeping/);
    expect(stateSource).toMatch(/listNeonEventsByIds/);
    expect(stateSource).toMatch(/HOME_HISTORY_LIMIT/);
    expect(stateSource).toMatch(/after\(/);
  });

  it("re-derives hosted settlements after a runner edit", () => {
    const src = routeSource("bets/[id]/route.ts");
    expect(src).toMatch(/resyncNeonSettledBetAgainstEvent/);
    expect(src).toMatch(/resyncSettledBetAgainstEvent/);
    expect(stateSource).toMatch(/resyncNeonStaleSettlements/);
    expect(stateSource).toMatch(/settleOpenNeonDeskBets/);
    expect(stateSource).toMatch(/alignEventRowsWithStoredFixtures/);
    expect(stateSource).toMatch(/awardNeonUnconditionalFreeBetsDue/);
  });

  it("narrates hosted History goals onto Neon, not SQLite", () => {
    const historyRoute = routeSource("history/route.ts");
    expect(historyRoute).toMatch(/isNeonDesk/);
    expect(historyRoute).toMatch(/syncNeonDeskEventHistory/);
    expect(stateSource).toMatch(/syncNeonDeskEventHistory/);
  });

  it("binds the owner Gmail to the canonical Neon desk", () => {
    const alias = readFileSync(
      resolve(__dirname, "neon-desk-alias.ts"),
      "utf8"
    );
    expect(alias).toMatch(/isDeskOwnerEmail\(email\)/);
    expect(alias).toMatch(/deskOwnerUserId\(\)/);
    const scope = readFileSync(resolve(__dirname, "with-desk-scope.ts"), "utf8");
    expect(scope).toMatch(/if \(email\) emailByUserId\.set/);
  });

  it("Racing Desk reads follow the Neon alias, not the raw Clerk id", () => {
    // Clerk dev/prod issue different user ids for the same email. Passing the
    // raw signed-in id down would open the empty twin desk on localhost.
    expect(routeSource("racing/desk/route.ts")).toMatch(/neonClerkUserId/);
    expect(routeSource("racing/desk/route.ts")).toMatch(/lite/);
    expect(routeSource("offers/edge/route.ts")).toMatch(/neonClerkUserId/);
    expect(routeSource("offers/edge/route.ts")).toMatch(/getOfferEdgePlays/);
    expect(routeSource("offers/edge/route.ts")).not.toMatch(/getRacingDesk/);
    const racingDesk = readFileSync(
      resolve(__dirname, "../services/racing-desk.ts"),
      "utf8"
    );
    expect(racingDesk).toMatch(/neonClerkUserId/);
    expect(racingDesk).toMatch(/options\?\.lite/);
  });
});
