import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FootballCompetitionCatalogEntry } from "@/lib/events/fixture-scope";

vi.mock("@/lib/services/apifootball", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/apifootball")>();
  return {
    ...actual,
    hasApiKey: vi.fn(() => true),
    currentLeagues: vi.fn(),
  };
});

const catalog: FootballCompetitionCatalogEntry[] = [
  { name: "Premier League", country: "England" },
  { name: "FA Cup", country: "England" },
];

async function loadStore() {
  const store = await import("@/lib/services/football-competition-store");
  const api = await import("@/lib/services/apifootball");
  return {
    store,
    currentLeagues: vi.mocked(api.currentLeagues),
    hasApiKey: vi.mocked(api.hasApiKey),
  };
}

describe("football-competition-store", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { db, footballCompetitionCatalog } = await import("@/lib/db");
    db.delete(footballCompetitionCatalog).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches live on a cold miss, writes through, then serves the store", async () => {
    const { store, currentLeagues } = await loadStore();
    currentLeagues.mockResolvedValue(catalog);

    const first = await store.getFootballCompetitionCatalog();
    expect(first).toHaveLength(2);
    expect(currentLeagues).toHaveBeenCalledTimes(1);

    const second = await store.getFootballCompetitionCatalog();
    expect(second).toHaveLength(2);
    expect(currentLeagues).toHaveBeenCalledTimes(1);
  });

  it("peek serves the store and never calls the provider", async () => {
    const { store, currentLeagues } = await loadStore();
    expect(await store.peekFootballCompetitionCatalog()).toEqual([]);
    await store.writeFootballCompetitionCatalog(catalog);
    expect(await store.peekFootballCompetitionCatalog()).toHaveLength(2);
    expect(currentLeagues).not.toHaveBeenCalled();
  });

  it("does not persist an empty upstream payload", async () => {
    const { store, currentLeagues } = await loadStore();
    currentLeagues.mockResolvedValue([]);

    await expect(store.getFootballCompetitionCatalog()).resolves.toEqual([]);
    expect(await store.readFootballCompetitionCatalog()).toBeNull();
  });

  it("skips warm when the catalog is still fresh", async () => {
    const { store, currentLeagues } = await loadStore();
    await store.writeFootballCompetitionCatalog(catalog);
    currentLeagues.mockResolvedValue(catalog);

    const result = await store.warmFootballCompetitionCatalog();
    expect(result).toEqual({ warmed: false, skipped: true });
    expect(currentLeagues).not.toHaveBeenCalled();
  });

  it("is a no-op without feed credentials", async () => {
    const { store, currentLeagues, hasApiKey } = await loadStore();
    hasApiKey.mockReturnValue(false);

    const result = await store.warmFootballCompetitionCatalog();
    expect(result).toEqual({ warmed: false, skipped: false });
    expect(currentLeagues).not.toHaveBeenCalled();
  });
});

describe("demoCompetitions", () => {
  it("includes competitions that are not on the demo fixture card", async () => {
    const { demoCompetitions, demoFixtures } = await import("@/lib/services/apifootball");
    const names = demoCompetitions().map((entry) => entry.name);
    expect(names).toContain("FA Cup");
    expect(demoFixtures().some((fixture) => fixture.competition === "FA Cup")).toBe(false);
  });
});
