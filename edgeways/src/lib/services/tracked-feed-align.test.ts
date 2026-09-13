import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localCalendarDate } from "@/lib/events";
import type { Fixture } from "@/lib/services/apifootball";

vi.mock("@/lib/services/apifootball", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/apifootball")>();
  return {
    ...actual,
    hasApiKey: vi.fn(() => true),
    fixturesByDate: vi.fn(),
    liveFixtures: vi.fn(async () => []),
    peekLiveFixtures: vi.fn(() => null),
    scheduleLiveFixturesRefresh: vi.fn(),
  };
});

function fixture(partial: Partial<Fixture> = {}): Fixture {
  return {
    externalId: "bolton-cardiff",
    sport: "football",
    competition: "Championship",
    homeTeam: "Bolton",
    awayTeam: "Cardiff",
    startTime: Date.now() - 121 * 60 * 1000,
    status: "live",
    homeScore: 0,
    awayScore: 0,
    minute: 57,
    period: "2H",
    ...partial,
  };
}

describe("alignTrackedFootballFixtures", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { db, fixtureCache } = await import("@/lib/db");
    db.delete(fixtureCache).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("replaces a frozen live 0-0 with the stored FT", async () => {
    const { writeFixtureStore } = await import("@/lib/services/fixture-store");
    const { alignTrackedFootballFixtures } = await import(
      "@/lib/services/tracked-feed-align"
    );
    const today = localCalendarDate();
    const startTime = Date.now() - 121 * 60 * 1000;
    await writeFixtureStore(today, [
      fixture({
        startTime,
        status: "finished",
        homeScore: 1,
        awayScore: 0,
        minute: 90,
        period: "FT",
        matchEnding: "ft",
      }),
    ]);

    const aligned = await alignTrackedFootballFixtures(
      [{ externalId: "bolton-cardiff", startTime }],
      [fixture({ startTime })]
    );
    expect(aligned[0]).toMatchObject({
      status: "finished",
      homeScore: 1,
      awayScore: 0,
    });
  });

  it("fills a missed live fetch from the day store", async () => {
    const { writeFixtureStore } = await import("@/lib/services/fixture-store");
    const { alignTrackedFootballFixtures } = await import(
      "@/lib/services/tracked-feed-align"
    );
    const today = localCalendarDate();
    const startTime = Date.now() - 121 * 60 * 1000;
    await writeFixtureStore(today, [
      fixture({
        startTime,
        status: "finished",
        homeScore: 1,
        awayScore: 0,
        minute: 90,
        matchEnding: "ft",
      }),
    ]);

    const aligned = await alignTrackedFootballFixtures(
      [{ externalId: "bolton-cardiff", startTime }],
      []
    );
    expect(aligned).toHaveLength(1);
    expect(aligned[0]).toMatchObject({ homeScore: 1, awayScore: 0, status: "finished" });
  });
});

describe("alignEventRowsWithStoredFixtures", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { db, fixtureCache } = await import("@/lib/db");
    db.delete(fixtureCache).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lifts a poisoned live event row onto the stored FT", async () => {
    const { writeFixtureStore } = await import("@/lib/services/fixture-store");
    const { alignEventRowsWithStoredFixtures } = await import(
      "@/lib/services/tracked-feed-align"
    );
    const today = localCalendarDate();
    const startTime = Date.now() - 121 * 60 * 1000;
    await writeFixtureStore(today, [
      fixture({
        startTime,
        status: "finished",
        homeScore: 1,
        awayScore: 0,
        minute: 90,
        period: "FT",
        matchEnding: "ft",
      }),
    ]);

    const aligned = await alignEventRowsWithStoredFixtures([
      {
        id: 126,
        sport: "football",
        externalId: "bolton-cardiff",
        competition: "Championship",
        homeTeam: "Bolton",
        awayTeam: "Cardiff",
        startTime,
        status: "live",
        homeScore: 0,
        awayScore: 0,
        minute: 57,
        homeLed2: 0,
        awayLed2: 0,
        source: "api",
        goals: null,
        ftHomeScore: null,
        ftAwayScore: null,
        matchEnding: null,
        period: "2H",
        htHomeScore: null,
        htAwayScore: null,
        lineups: null,
        tapeFetchedAt: null,
        simScript: null,
        simStartedAt: null,
        resultPostedAt: null,
        createdAt: startTime,
      },
    ]);
    expect(aligned[0]).toMatchObject({
      status: "finished",
      homeScore: 1,
      awayScore: 0,
      minute: 90,
    });
  });
});
