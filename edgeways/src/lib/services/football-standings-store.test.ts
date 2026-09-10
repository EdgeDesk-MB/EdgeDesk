import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/apifootball", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/apifootball")>();
  return {
    ...actual,
    hasApiKey: vi.fn(() => true),
    leagueStandings: vi.fn(),
  };
});

vi.mock("@/lib/services/football-competition-store", () => ({
  peekFootballCompetitionCatalog: vi.fn(async () => [
    { name: "Premier League", country: "England", leagueId: 39, season: 2026 },
  ]),
}));

async function loadStore() {
  const store = await import("./football-standings-store");
  const api = await import("@/lib/services/apifootball");
  return {
    store,
    leagueStandings: vi.mocked(api.leagueStandings),
  };
}

describe("football-standings-store", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { db, footballStandingsCache } = await import("@/lib/db");
    db.delete(footballStandingsCache).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes through standings and looks up GF/GA by team", async () => {
    const { store, leagueStandings } = await loadStore();
    leagueStandings.mockResolvedValue([
      { name: "Arsenal", gf: 2.1, ga: 1.1, played: 10 },
      { name: "Chelsea", gf: 1.6, ga: 1.4, played: 10 },
    ]);

    const first = await store.getFootballStandingsForScope("England::Premier League");
    expect(first?.leagueAvgGf).toBeCloseTo(1.85);
    expect(store.lookupTeamGoalRates(first!, "Arsenal")?.gf).toBeCloseTo(2.1);
    expect(store.lookupVenueGoalRates(first!, "Arsenal", "Chelsea")).toEqual({
      homeGf: 2.1,
      homeGa: 1.1,
      awayGf: 1.6,
      awayGa: 1.4,
    });
    expect(leagueStandings).toHaveBeenCalledTimes(1);

    const second = await store.getFootballStandingsForScope("England::Premier League");
    expect(second?.leagueAvgGf).toBeCloseTo(1.85);
    expect(leagueStandings).toHaveBeenCalledTimes(1);
  });

  it("prefers home/away splits for a fixture venue", async () => {
    const { store, leagueStandings } = await loadStore();
    leagueStandings.mockResolvedValue([
      {
        name: "Arsenal",
        gf: 2.0,
        ga: 1.0,
        played: 10,
        homeGf: 2.4,
        homeGa: 0.8,
        homePlayed: 5,
        awayGf: 1.6,
        awayGa: 1.2,
        awayPlayed: 5,
      },
      {
        name: "Chelsea",
        gf: 1.5,
        ga: 1.4,
        played: 10,
        homeGf: 1.8,
        homeGa: 1.1,
        homePlayed: 5,
        awayGf: 1.2,
        awayGa: 1.7,
        awayPlayed: 5,
      },
    ]);
    const rates = await store.getFootballStandingsForScope("England::Premier League");
    expect(store.lookupVenueGoalRates(rates!, "Arsenal", "Chelsea")).toEqual({
      homeGf: 2.4,
      homeGa: 0.8,
      awayGf: 1.2,
      awayGa: 1.7,
    });
  });

  it("does not persist an empty table", async () => {
    const { store, leagueStandings } = await loadStore();
    leagueStandings.mockResolvedValue([]);
    await expect(store.getFootballStandingsForScope("England::Premier League")).resolves.toBeNull();
    expect(await store.readFootballStandingsStore("England::Premier League")).toBeNull();
  });
});
