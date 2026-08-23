import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeRaceContext } from "./types";

const RACE_DATE = "2026-08-23";
const RACE_START = Date.parse("2026-08-23T14:00:00Z");
const NOW = Date.parse("2026-08-23T10:00:00Z");

const CATALOGUE_TTL_MS = 5 * 60 * 1000;
const BOOK_TTL_MS = 30 * 1000;

type BetfairMethod = "listMarketCatalogue" | "listMarketBook";

interface FakeBetfair {
  fetch: ReturnType<typeof vi.fn>;
  calls: Record<BetfairMethod | "login", number>;
  /** Bodies posted per method, so cache keys can be asserted on the real request. */
  bodies: Record<BetfairMethod, Array<Record<string, unknown>>>;
  fail: Set<BetfairMethod>;
}

/**
 * Stand in for the Betfair REST layer: interactive login then listMarketCatalogue
 * / listMarketBook. Adding a method to `fail` makes it answer 503 so the service
 * sees a real upstream failure rather than a thrown fetch.
 */
function fakeBetfair(responses: {
  catalogue: (body: Record<string, unknown>) => unknown;
  book: (body: Record<string, unknown>) => unknown;
}): FakeBetfair {
  const calls: FakeBetfair["calls"] = { login: 0, listMarketCatalogue: 0, listMarketBook: 0 };
  const bodies: FakeBetfair["bodies"] = { listMarketCatalogue: [], listMarketBook: [] };
  const fail = new Set<BetfairMethod>();

  const fetchMock = vi.fn(async (url: string, init?: { body?: string }) => {
    const href = String(url);
    if (href.includes("identitysso")) {
      calls.login += 1;
      return { ok: true, status: 200, json: async () => ({ token: "session-token" }) };
    }

    const method: BetfairMethod = href.includes("listMarketCatalogue")
      ? "listMarketCatalogue"
      : "listMarketBook";
    calls[method] += 1;
    const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    bodies[method].push(body);

    if (fail.has(method)) {
      return { ok: false, status: 503, text: async () => "upstream unavailable" };
    }
    const data = method === "listMarketCatalogue" ? responses.catalogue(body) : responses.book(body);
    return { ok: true, status: 200, json: async () => data };
  });

  return { fetch: fetchMock, calls, bodies, fail };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("BETFAIR_APP_KEY", "test-app-key");
  vi.stubEnv("BETFAIR_USERNAME", "test-user");
  vi.stubEnv("BETFAIR_PASSWORD", "test-pass");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("racing lay odds cache", () => {
  const race: ExchangeRaceContext = {
    externalId: "race-1",
    course: "Ascot",
    raceName: "Silver Handicap",
    startTime: RACE_START,
    offTime: "15:00",
    runners: [{ horseId: "h1", name: "Demo Runner" }],
  };

  const catalogue = [
    {
      marketId: "1.100",
      marketName: "5f Handicap",
      marketStartTime: "2026-08-23T14:00:00.000Z",
      event: { id: "ev1", name: "Ascot" },
      runners: [{ selectionId: 11, runnerName: "Demo Runner" }],
    },
  ];

  const book = (layPrice: number) => [
    {
      marketId: "1.100",
      status: "OPEN",
      runners: [
        {
          selectionId: 11,
          status: "ACTIVE",
          ex: {
            availableToLay: [{ price: layPrice, size: 120 }],
            availableToBack: [{ price: layPrice - 0.2, size: 90 }],
          },
        },
      ],
    },
  ];

  function setup(layPrice = 5.2) {
    const betfair = fakeBetfair({ catalogue: () => catalogue, book: () => book(layPrice) });
    vi.stubGlobal("fetch", betfair.fetch);
    return betfair;
  }

  it("serves a second call inside both TTLs without touching upstream", async () => {
    const betfair = setup();
    const { fetchBetfairLayOdds } = await import("./betfair");

    const first = await fetchBetfairLayOdds([race], RACE_DATE);
    expect(first[0]?.quotes[0]?.layDecimal).toBe(5.2);
    expect(betfair.calls.listMarketCatalogue).toBe(1);
    expect(betfair.calls.listMarketBook).toBe(1);

    vi.setSystemTime(NOW + 20_000);
    const second = await fetchBetfairLayOdds([race], RACE_DATE);

    expect(betfair.calls.listMarketCatalogue).toBe(1);
    expect(betfair.calls.listMarketBook).toBe(1);
    expect(second).toEqual(first);
    expect(second[0]?.stale).toBeUndefined();
  });

  it("refetches market books after 30s but keeps the catalogue for 5 min", async () => {
    const betfair = setup();
    const { fetchBetfairLayOdds } = await import("./betfair");

    await fetchBetfairLayOdds([race], RACE_DATE);
    vi.setSystemTime(NOW + BOOK_TTL_MS + 1);
    await fetchBetfairLayOdds([race], RACE_DATE);

    expect(betfair.calls.listMarketBook).toBe(2);
    expect(betfair.calls.listMarketCatalogue).toBe(1);

    vi.setSystemTime(NOW + CATALOGUE_TTL_MS + 1);
    await fetchBetfairLayOdds([race], RACE_DATE);

    expect(betfair.calls.listMarketCatalogue).toBe(2);
    expect(betfair.calls.listMarketBook).toBe(3);
  });

  it("serves the stale price and marks it when the exchange fails after TTL", async () => {
    const betfair = setup();
    const { fetchBetfairLayOdds } = await import("./betfair");

    await fetchBetfairLayOdds([race], RACE_DATE);

    betfair.fail.add("listMarketCatalogue");
    betfair.fail.add("listMarketBook");
    vi.setSystemTime(NOW + CATALOGUE_TTL_MS + 1);
    const stale = await fetchBetfairLayOdds([race], RACE_DATE);

    expect(stale[0]?.quotes[0]?.layDecimal).toBe(5.2);
    expect(stale[0]?.source).toBe("live");
    expect(stale[0]?.stale).toBe(true);
    expect(stale[0]?.error).toBeUndefined();
  });

  it("reports the upstream error unchanged when nothing is cached", async () => {
    const betfair = setup();
    betfair.fail.add("listMarketCatalogue");
    const { fetchBetfairLayOdds } = await import("./betfair");

    const result = await fetchBetfairLayOdds([race], RACE_DATE);

    expect(result[0]?.quotes).toEqual([]);
    expect(result[0]?.source).toBe("estimated");
    expect(result[0]?.error).toContain("503");
    expect(result[0]?.stale).toBeUndefined();
  });

  it("keys the day catalogue by date so another day refetches", async () => {
    const betfair = setup();
    const { fetchBetfairLayOdds } = await import("./betfair");

    await fetchBetfairLayOdds([race], RACE_DATE);
    await fetchBetfairLayOdds([race], "2026-08-24");

    expect(betfair.calls.listMarketCatalogue).toBe(2);
    const windows = betfair.bodies.listMarketCatalogue.map(
      (body) => (body.filter as { marketStartTime: { from: string } }).marketStartTime.from
    );
    expect(windows).toEqual(["2026-08-23T00:00:00.000Z", "2026-08-24T00:00:00.000Z"]);
  });

  it("never shares a market book between two markets", async () => {
    const betfair = fakeBetfair({
      catalogue: () => [
        ...catalogue,
        {
          marketId: "1.200",
          marketName: "7f Maiden",
          marketStartTime: "2026-08-23T14:00:00.000Z",
          event: { id: "ev2", name: "Newbury" },
          runners: [{ selectionId: 21, runnerName: "Other Runner" }],
        },
      ],
      book: (body) =>
        (body.marketIds as string[]).map((marketId) => ({
          marketId,
          status: "OPEN",
          runners: [
            {
              selectionId: marketId === "1.100" ? 11 : 21,
              status: "ACTIVE",
              ex: { availableToLay: [{ price: marketId === "1.100" ? 5.2 : 9.8, size: 50 }] },
            },
          ],
        })),
    });
    vi.stubGlobal("fetch", betfair.fetch);
    const { fetchBetfairLayOdds } = await import("./betfair");

    const other: ExchangeRaceContext = {
      externalId: "race-2",
      course: "Newbury",
      raceName: "Maiden Stakes",
      startTime: RACE_START,
      offTime: "15:00",
      runners: [{ horseId: "h2", name: "Other Runner" }],
    };

    const result = await fetchBetfairLayOdds([race, other], RACE_DATE);

    expect(result[0]?.marketId).toBe("1.100");
    expect(result[0]?.quotes[0]?.layDecimal).toBe(5.2);
    expect(result[1]?.marketId).toBe("1.200");
    expect(result[1]?.quotes[0]?.layDecimal).toBe(9.8);
  });
});

describe("football odds cache", () => {
  const query = {
    homeTeam: "Everton",
    awayTeam: "Crystal Palace",
    startTime: Date.parse("2026-08-23T14:00:00Z"),
    matchOddsOnly: true,
  };

  const matchOdds = [
    {
      marketId: "1.300",
      marketName: "Match Odds",
      marketStartTime: "2026-08-23T14:00:00.000Z",
      description: { marketType: "MATCH_ODDS" },
      event: { id: "ev-fb", name: "Everton v Crystal Palace" },
      runners: [
        { selectionId: 1, runnerName: "Everton" },
        { selectionId: 2, runnerName: "Crystal Palace" },
        { selectionId: 3, runnerName: "The Draw" },
      ],
    },
  ];

  const book = (homeBack: number) => [
    {
      marketId: "1.300",
      status: "OPEN",
      runners: [
        {
          selectionId: 1,
          status: "ACTIVE",
          ex: {
            availableToBack: [{ price: homeBack, size: 40 }],
            availableToLay: [{ price: homeBack + 0.05, size: 55 }],
          },
        },
      ],
    },
  ];

  function setup(homeBack = 3.2) {
    const betfair = fakeBetfair({ catalogue: () => matchOdds, book: () => book(homeBack) });
    vi.stubGlobal("fetch", betfair.fetch);
    return betfair;
  }

  it("serves a second poll inside both TTLs without touching upstream", async () => {
    const betfair = setup();
    const { fetchBetfairFootballOdds } = await import("./football-odds");

    const first = await fetchBetfairFootballOdds(query);
    expect(first.status).toBe("live");
    expect(first.odds.homeBack).toBe(3.2);
    expect(betfair.calls.listMarketCatalogue).toBe(1);
    expect(betfair.calls.listMarketBook).toBe(1);

    vi.setSystemTime(NOW + 20_000);
    const second = await fetchBetfairFootballOdds(query);

    expect(betfair.calls.listMarketCatalogue).toBe(1);
    expect(betfair.calls.listMarketBook).toBe(1);
    expect(second).toEqual(first);
    expect(second.stale).toBeUndefined();
  });

  it("refetches prices after 30s and the catalogue after 5 min", async () => {
    const betfair = setup();
    const { fetchBetfairFootballOdds } = await import("./football-odds");

    await fetchBetfairFootballOdds(query);
    vi.setSystemTime(NOW + BOOK_TTL_MS + 1);
    await fetchBetfairFootballOdds(query);

    expect(betfair.calls.listMarketBook).toBe(2);
    expect(betfair.calls.listMarketCatalogue).toBe(1);

    vi.setSystemTime(NOW + CATALOGUE_TTL_MS + 1);
    await fetchBetfairFootballOdds(query);

    expect(betfair.calls.listMarketCatalogue).toBe(2);
  });

  it("serves the stale price and marks it when the exchange fails after TTL", async () => {
    const betfair = setup();
    const { fetchBetfairFootballOdds } = await import("./football-odds");

    await fetchBetfairFootballOdds(query);

    betfair.fail.add("listMarketCatalogue");
    betfair.fail.add("listMarketBook");
    vi.setSystemTime(NOW + CATALOGUE_TTL_MS + 1);
    const stale = await fetchBetfairFootballOdds(query);

    expect(stale.status).toBe("live");
    expect(stale.odds.homeBack).toBe(3.2);
    expect(stale.stale).toBe(true);
  });

  it("returns the upstream error unchanged when nothing is cached", async () => {
    const betfair = setup();
    betfair.fail.add("listMarketCatalogue");
    const { fetchBetfairFootballOdds } = await import("./football-odds");

    const result = await fetchBetfairFootballOdds(query);

    expect(result.status).toBe("error");
    expect(result.error).toContain("503");
    expect(result.odds).toEqual({});
    expect(result.stale).toBeUndefined();
  });

  it("never shares a catalogue entry between two kick-off windows", async () => {
    const betfair = setup();
    const { fetchBetfairFootballOdds } = await import("./football-odds");

    await fetchBetfairFootballOdds(query);
    await fetchBetfairFootballOdds({
      ...query,
      startTime: Date.parse("2026-08-23T19:45:00Z"),
    });

    expect(betfair.calls.listMarketCatalogue).toBe(2);
  });
});
