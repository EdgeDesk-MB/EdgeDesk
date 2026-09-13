import { describe, expect, it } from "vitest";
import {
  DESK_SNAPSHOT_VERSION,
  openBetsPastResultWindow,
  parseDeskSnapshot,
  readDeskSnapshot,
  slimDeskSnapshot,
  writeDeskSnapshot,
} from "./desk-snapshot";
import { DEFAULT_SETTINGS } from "./services/settings-shared";
import type { AppState } from "./services/state.types";

function sample(partial: Partial<AppState> = {}): AppState {
  return {
    events: [],
    bets: [],
    settledProfit: 12.5,
    bettingProfit: 10,
    casinoProfit: 2.5,
    provisionalProfit: 1,
    liveChartProfit: 1,
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
    exchangeStatus: {
      provider: "betfair",
      status: "connected",
      message: "ok",
    },
    exchangeProviders: [],
    racingAutopilot: [],
    settings: DEFAULT_SETTINGS,
    balances: {
      total: 100,
      bookies: 40,
      exchanges: 30,
      banks: 20,
      pendingBankCredits: 0,
      inBets: 10,
      bankroll: 90,
      accounts: [],
    },
    offers: [],
    ...partial,
  };
}

describe("parseDeskSnapshot", () => {
  it("reads a current snapshot", () => {
    const state = sample();
    expect(
      parseDeskSnapshot(
        JSON.stringify({ v: DESK_SNAPSHOT_VERSION, at: 1, state }),
        1
      )
    ).toEqual(state);
  });

  it("rejects a snapshot older than the first-paint window", () => {
    const state = sample();
    expect(
      parseDeskSnapshot(
        JSON.stringify({ v: DESK_SNAPSHOT_VERSION, at: 1, state }),
        1 + 31_000
      )
    ).toBeNull();
  });

  it("rejects a missing or foreign payload", () => {
    expect(parseDeskSnapshot(null)).toBeNull();
    expect(parseDeskSnapshot("{")).toBeNull();
    expect(
      parseDeskSnapshot(JSON.stringify({ v: 0, at: 1, state: sample() }), 1)
    ).toBeNull();
    expect(
      parseDeskSnapshot(
        JSON.stringify({ v: DESK_SNAPSHOT_VERSION, at: 1, state: { bets: [] } }),
        1
      )
    ).toBeNull();
  });
});

describe("slimDeskSnapshot", () => {
  it("keeps live tape and drops finished tape", () => {
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
          minute: 12,
          homeLed2: 0,
          awayLed2: 0,
          source: "api",
          goals: "[{}]",
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
          goals: "[{}]",
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
    const slim = slimDeskSnapshot(state);
    expect(slim.events[0]?.goals).toBe("[{}]");
    expect(slim.events[1]?.goals).toBeNull();
    expect(slim.events[1]?.lineups).toBeNull();
  });
});

describe("writeDeskSnapshot", () => {
  it("keeps the same in-memory object when the slim payload is unchanged", () => {
    const state = sample();
    writeDeskSnapshot(state);
    const first = readDeskSnapshot();
    writeDeskSnapshot(state);
    expect(readDeskSnapshot()).toBe(first);
  });
});

describe("openBetsPastResultWindow", () => {
  it("flags a still-open football bet hours after kick-off", () => {
    const kickoff = 1_800_000_000_000;
    const state = sample({
      bets: [
        {
          id: 740,
          eventId: 126,
          status: "open",
          label: "Match odds home",
        } as AppState["bets"][number],
      ],
      events: [
        {
          id: 126,
          sport: "football",
          startTime: kickoff,
          status: "live",
          homeTeam: "Bolton",
          awayTeam: "Cardiff",
        } as AppState["events"][number],
      ],
    });
    expect(openBetsPastResultWindow(state, kickoff + 3 * 60 * 60 * 1000)).toBe(
      true
    );
    expect(openBetsPastResultWindow(state, kickoff + 10 * 60 * 1000)).toBe(
      false
    );
  });

  it("flags a still-open race after the 90-minute live window", () => {
    const off = 1_800_000_000_000;
    const state = sample({
      bets: [
        {
          id: 742,
          eventId: 128,
          status: "open",
          label: "Winner Holy See",
        } as AppState["bets"][number],
      ],
      events: [
        {
          id: 128,
          sport: "horse_racing",
          startTime: off,
          status: "upcoming",
          homeTeam: "Chester",
          awayTeam: "14:05",
        } as AppState["events"][number],
      ],
    });
    expect(openBetsPastResultWindow(state, off + 91 * 60 * 1000)).toBe(true);
  });
});
