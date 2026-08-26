import { describe, expect, it } from "vitest";
import { footballOddsTimeWindow } from "./football-odds";
import {
  betfairBookTrading,
  extractFootballOdds,
  footballOddsToDeskPatch,
  footballMarketKind,
  hasAnyFootballOdds,
  missingFootballOddsFields,
  pickFootballMatchOddsMarket,
  type FootballCatalogueMarket,
  type FootballMarketBook,
} from "./football-odds-map";

const KICKOFF = Date.parse("2026-08-22T14:00:00Z");

function matchOddsMarket(overrides: Partial<FootballCatalogueMarket> = {}): FootballCatalogueMarket {
  return {
    marketId: "1.100",
    marketName: "Match Odds",
    marketStartTime: "2026-08-22T14:00:00.000Z",
    description: { marketType: "MATCH_ODDS" },
    event: { id: "ev1", name: "Everton v Crystal Palace" },
    runners: [
      { selectionId: 1, runnerName: "Everton" },
      { selectionId: 2, runnerName: "Crystal Palace" },
      { selectionId: 3, runnerName: "The Draw" },
    ],
    ...overrides,
  };
}

describe("betfairBookTrading", () => {
  it("reads OPEN, SUSPENDED and CLOSED", () => {
    expect(betfairBookTrading("OPEN")).toBe("open");
    expect(betfairBookTrading("suspended")).toBe("suspended");
    expect(betfairBookTrading("CLOSED")).toBe("closed");
    expect(betfairBookTrading(undefined)).toBe("unknown");
  });
});

describe("footballMarketKind", () => {
  it("reads marketType and falls back to the market name", () => {
    expect(footballMarketKind({ marketId: "1", marketName: "Match Odds" })).toBe("match_odds");
    expect(
      footballMarketKind({
        marketId: "2",
        marketName: "Over/Under 2.5 Goals",
        description: { marketType: "OVER_UNDER_25" },
      })
    ).toBe("over_25");
    expect(
      footballMarketKind({
        marketId: "3",
        marketName: "Both Teams to Score",
      })
    ).toBe("btts");
  });
});

describe("pickFootballMatchOddsMarket", () => {
  it("picks the closest matching kick-off when two Everton games exist", () => {
    const other = matchOddsMarket({
      marketId: "1.101",
      marketStartTime: "2026-08-22T16:30:00.000Z",
      event: { id: "ev2", name: "Everton v Crystal Palace" },
    });
    const picked = pickFootballMatchOddsMarket([other, matchOddsMarket()], {
      homeTeam: "Everton",
      awayTeam: "Crystal Palace",
      startTime: KICKOFF,
    });
    expect(picked?.marketId).toBe("1.100");
  });

  it("ignores a different fixture in the same window", () => {
    const liverpool = matchOddsMarket({
      marketId: "1.200",
      event: { id: "ev3", name: "Everton v Liverpool" },
    });
    expect(
      pickFootballMatchOddsMarket([liverpool], {
        homeTeam: "Everton",
        awayTeam: "Crystal Palace",
        startTime: KICKOFF,
      })
    ).toBeUndefined();
  });
});

describe("extractFootballOdds", () => {
  const markets: FootballCatalogueMarket[] = [
    matchOddsMarket(),
    {
      marketId: "1.102",
      marketName: "Over/Under 2.5 Goals",
      description: { marketType: "OVER_UNDER_25" },
      event: { id: "ev1", name: "Everton v Crystal Palace" },
      runners: [
        { selectionId: 10, runnerName: "Over 2.5 Goals" },
        { selectionId: 11, runnerName: "Under 2.5 Goals" },
      ],
    },
    {
      marketId: "1.103",
      marketName: "Both Teams to Score",
      description: { marketType: "BOTH_TEAMS_TO_SCORE" },
      event: { id: "ev1", name: "Everton v Crystal Palace" },
      runners: [
        { selectionId: 20, runnerName: "Yes" },
        { selectionId: 21, runnerName: "No" },
      ],
    },
  ];

  const books: FootballMarketBook[] = [
    {
      marketId: "1.100",
      runners: [
        {
          selectionId: 1,
          status: "ACTIVE",
          ex: {
            availableToBack: [{ price: 3.2, size: 40 }],
            availableToLay: [{ price: 3.25, size: 55 }],
          },
        },
        {
          selectionId: 2,
          status: "ACTIVE",
          ex: {
            availableToBack: [{ price: 2.64, size: 80 }],
            availableToLay: [{ price: 2.68, size: 70 }],
          },
        },
        {
          selectionId: 3,
          status: "ACTIVE",
          ex: { availableToBack: [{ price: 3.15, size: 60 }] },
        },
      ],
    },
    {
      marketId: "1.102",
      runners: [
        {
          selectionId: 10,
          status: "ACTIVE",
          ex: { availableToBack: [{ price: 1.84, size: 120 }] },
        },
      ],
    },
    {
      marketId: "1.103",
      runners: [
        {
          selectionId: 20,
          status: "ACTIVE",
          ex: { availableToBack: [{ price: 1.72, size: 90 }] },
        },
      ],
    },
  ];

  it("fills match backs/lays, Over 2.5 and BTTS Yes", () => {
    const odds = extractFootballOdds(markets, books, {
      homeTeam: "Everton",
      awayTeam: "Crystal Palace",
    });
    expect(odds).toEqual({
      homeBack: 3.2,
      awayBack: 2.64,
      drawBack: 3.15,
      homeLay: 3.25,
      awayLay: 2.68,
      over25Back: 1.84,
      bttsYesBack: 1.72,
    });
    expect(missingFootballOddsFields(odds)).toEqual([]);
    expect(hasAnyFootballOdds(odds)).toBe(true);
  });

  it("maps prices onto 2UP Desk fields", () => {
    expect(
      footballOddsToDeskPatch({
        homeBack: 3.2,
        drawBack: 3.15,
        awayBack: 2.64,
        homeLay: 3.25,
        awayLay: 2.68,
        over25Back: 1.84,
        bttsYesBack: 1.72,
      })
    ).toEqual({
      oHomeWin: 3.2,
      oDraw: 3.15,
      oAwayWin: 2.64,
      oLayH: 3.25,
      oLayA: 2.68,
      oOver: 1.84,
      oBtts: 1.72,
    });
  });

  it("leaves missing markets out of the patch", () => {
    expect(footballOddsToDeskPatch({ homeBack: 2.1 })).toEqual({ oHomeWin: 2.1 });
    expect(missingFootballOddsFields({ homeBack: 2.1 })).toContain("Over 2.5");
    expect(missingFootballOddsFields({ homeBack: 2.1 })).toContain("BTTS Yes");
  });
});

describe("footballOddsTimeWindow", () => {
  it("opens a two-hour window around kick-off", () => {
    expect(footballOddsTimeWindow(KICKOFF)).toEqual({
      from: "2026-08-22T12:00:00.000Z",
      to: "2026-08-22T16:00:00.000Z",
    });
  });
});
