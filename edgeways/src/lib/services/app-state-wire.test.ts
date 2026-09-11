import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/services/settings-shared";
import {
  etagForJsonBody,
  ifNoneMatchHits,
  slimAppStateForWire,
} from "@/lib/services/app-state-wire";
import type { AppState } from "@/lib/services/state.types";

function sample(partial: Partial<AppState> = {}): AppState {
  return {
    events: [],
    bets: [],
    settledProfit: 1,
    bettingProfit: 1,
    casinoProfit: 0,
    provisionalProfit: 0,
    liveChartProfit: 0,
    retention: { rate: 0.8, sampleSize: 0 },
    effortMeasured: {},
    accaLayDue: [],
    betBuilderLayDue: [],
    mugPlans: [],
    alertsUnread: 0,
    deliveredAlertKeys: [],
    boostsOpen: 0,
    casinoNeedsAction: 0,
    demoMode: false,
    hostedDesk: true,
    livePositions: [],
    liveEventModels: [],
    series: [],
    pnlAdjustments: [],
    casinoSettlements: [],
    planRaces: [],
    planFixtures: [],
    history: [],
    chartHistory: [],
    promoAwards: {},
    apiConfigured: true,
    racingApiConfigured: true,
    racingResultsTier: "free",
    apiUsage: { used: 0, budget: 5000 },
    racingApiUsage: { used: 0 },
    exchangeProvider: "betfair",
    exchangeName: "Betfair",
    exchangeStatus: { provider: "betfair", status: "connected", message: "ok" },
    exchangeProviders: [],
    racingAutopilot: [],
    settings: DEFAULT_SETTINGS,
    balances: {
      total: 0,
      bookies: 0,
      exchanges: 0,
      banks: 0,
      pendingBankCredits: 0,
      inBets: 0,
      bankroll: 0,
      accounts: [],
    },
    offers: [],
    ...partial,
  };
}

describe("slimAppStateForWire", () => {
  it("drops finished tape and keeps live tape", () => {
    const state = sample({
      events: [
        {
          id: 1,
          sport: "football",
          externalId: "1",
          competition: "PL",
          homeTeam: "A",
          awayTeam: "B",
          startTime: 1,
          status: "live",
          homeScore: 1,
          awayScore: 0,
          minute: 10,
          homeLed2: 0,
          awayLed2: 0,
          source: "api",
          goals: "[live]",
          ftHomeScore: null,
          ftAwayScore: null,
          matchEnding: null,
          period: "1H",
          htHomeScore: null,
          htAwayScore: null,
          lineups: "{}",
          tapeFetchedAt: 1,
          simScript: null,
          simStartedAt: null,
          resultPostedAt: null,
          createdAt: 1,
        },
        {
          id: 2,
          sport: "football",
          externalId: "2",
          competition: "PL",
          homeTeam: "C",
          awayTeam: "D",
          startTime: 1,
          status: "finished",
          homeScore: 2,
          awayScore: 1,
          minute: 90,
          homeLed2: 0,
          awayLed2: 0,
          source: "api",
          goals: "[ft]",
          ftHomeScore: 2,
          ftAwayScore: 1,
          matchEnding: "ft",
          period: "FT",
          htHomeScore: 1,
          htAwayScore: 0,
          lineups: "{}",
          tapeFetchedAt: 1,
          simScript: null,
          simStartedAt: null,
          resultPostedAt: 1,
          createdAt: 1,
        },
      ],
    });
    const slim = slimAppStateForWire(state);
    expect(slim.events[0]?.goals).toBe("[live]");
    expect(slim.events[1]?.goals).toBeNull();
    expect(slim.events[1]?.lineups).toBeNull();
  });

  it("keeps racing results on finished races", () => {
    const state = sample({
      events: [
        {
          id: 3,
          sport: "horse_racing",
          externalId: "r1",
          competition: "Ascot",
          homeTeam: "1.20 Ascot",
          awayTeam: "",
          startTime: 1,
          status: "finished",
          homeScore: 0,
          awayScore: 0,
          minute: 0,
          homeLed2: 0,
          awayLed2: 0,
          source: "api",
          goals: '{"winner":"Foo"}',
          ftHomeScore: null,
          ftAwayScore: null,
          matchEnding: null,
          period: null,
          htHomeScore: null,
          htAwayScore: null,
          lineups: null,
          tapeFetchedAt: null,
          simScript: null,
          simStartedAt: null,
          resultPostedAt: 1,
          createdAt: 1,
        },
      ],
    });
    expect(slimAppStateForWire(state).events[0]?.goals).toBe('{"winner":"Foo"}');
  });
});

describe("etag", () => {
  it("is stable for the same body and matches If-None-Match", () => {
    const etag = etagForJsonBody('{"a":1}');
    expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
    expect(etagForJsonBody('{"a":1}')).toBe(etag);
    expect(ifNoneMatchHits(etag, etag)).toBe(true);
    expect(ifNoneMatchHits(`W/${etag}`, etag)).toBe(true);
    expect(ifNoneMatchHits('"other"', etag)).toBe(false);
  });
});
