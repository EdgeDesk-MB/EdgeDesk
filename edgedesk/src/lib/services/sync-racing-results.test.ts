import { describe, expect, it } from "vitest";
import { eventInRacingSyncWindow, eventNeedsRaceResult } from "./sync-racing-results";
import { racingSyncToast } from "@/lib/racing/sync-toast";
import type { EventRow } from "@/lib/db/schema";

function raceEvent(overrides: Partial<EventRow> = {}): EventRow {
  const now = Date.now();
  return {
    id: 1,
    externalId: "race-1",
    sport: "horse_racing",
    homeTeam: "Ascot",
    awayTeam: "14:30 Handicap",
    competition: "Ascot",
    startTime: now - 30 * 60 * 1000,
    status: "live",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    homeLed2: 0,
    awayLed2: 0,
    goals: null,
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    simScript: null,
    simStartedAt: null,
    source: "api",
    createdAt: now,
    ...overrides,
  };
}

describe("eventNeedsRaceResult / sync window", () => {
  it("needs a result when horse racing has externalId and no goals", () => {
    expect(eventNeedsRaceResult(raceEvent())).toBe(true);
    expect(eventNeedsRaceResult(raceEvent({ goals: null }))).toBe(true);
    expect(eventNeedsRaceResult(raceEvent({ externalId: null }))).toBe(false);
    expect(eventNeedsRaceResult(raceEvent({ sport: "football" }))).toBe(false);
  });

  it("is in sync window from 2 min before off until 6 hours after", () => {
    const now = Date.now();
    expect(eventInRacingSyncWindow(raceEvent({ startTime: now + 60_000 }), now)).toBe(true);
    expect(eventInRacingSyncWindow(raceEvent({ startTime: now + 3 * 60_000 }), now)).toBe(false);
    expect(eventInRacingSyncWindow(raceEvent({ startTime: now - 5 * 60 * 60_000 }), now)).toBe(
      true
    );
    expect(eventInRacingSyncWindow(raceEvent({ startTime: now - 7 * 60 * 60_000 }), now)).toBe(
      false
    );
  });
});

describe("racingSyncToast", () => {
  it("explains Free tier when blocked", () => {
    const toast = racingSyncToast({ updated: 0, pending: 2, tierBlocked: true, tier: "free" });
    expect(toast.kind).toBe("info");
    expect(toast.description).toMatch(/Set placings/i);
  });

  it("explains lag when Basic but results not published", () => {
    const toast = racingSyncToast({ updated: 0, pending: 1, tier: "basic" });
    expect(toast.description).toMatch(/not published yet/i);
  });

  it("celebrates successful sync", () => {
    const toast = racingSyncToast({ updated: 2, pending: 0, tier: "basic" });
    expect(toast.kind).toBe("success");
    expect(toast.title).toMatch(/Updated 2/);
  });
});

describe("incomplete race results", () => {
  it("needs a result when only winner is stored (manual Set winner)", () => {
    const winnerOnly = JSON.stringify({
      kind: "horse_racing",
      winner: "Hatteen",
      runners: [{ horse: "Hatteen", position: 1 }],
      fieldSize: 1,
    });
    expect(eventNeedsRaceResult(raceEvent({ goals: winnerOnly }))).toBe(true);
    expect(eventNeedsRaceResult(raceEvent({ goals: winnerOnly }), true)).toBe(true);
  });

  it("does not need a result when full placings exist", () => {
    const full = JSON.stringify({
      kind: "horse_racing",
      winner: "Alpha",
      runners: [
        { horse: "Alpha", position: 1 },
        { horse: "Hatteen", position: 2 },
        { horse: "Beta", position: 3 },
      ],
      fieldSize: 8,
    });
    expect(eventNeedsRaceResult(raceEvent({ goals: full }))).toBe(false);
    expect(eventNeedsRaceResult(raceEvent({ goals: full }), true)).toBe(true);
  });
});
