import { describe, expect, it } from "vitest";
import {
  isDeskRacePendingSettle,
  isEventPendingSettle,
} from "@/lib/racing/pending-settle";
import type { RacingDeskRace } from "@/lib/racing-desk/types";

describe("isEventPendingSettle", () => {
  it("returns true for past horse race without results", () => {
    expect(
      isEventPendingSettle({
        sport: "horse_racing",
        startTime: Date.now() - 60_000,
        goals: null,
      })
    ).toBe(true);
  });

  it("returns false when result is stored", () => {
    expect(
      isEventPendingSettle({
        sport: "horse_racing",
        startTime: Date.now() - 60_000,
        goals: JSON.stringify({ kind: "horse_racing", winner: "Horse A", runners: [], fieldSize: 8 }),
      })
    ).toBe(false);
  });

  it("returns false for future races", () => {
    expect(
      isEventPendingSettle({
        sport: "horse_racing",
        startTime: Date.now() + 60_000,
        goals: null,
      })
    ).toBe(false);
  });
});

describe("isDeskRacePendingSettle", () => {
  const base: RacingDeskRace = {
    externalId: "r1",
    course: "York",
    raceName: "Handicap",
    startTime: Date.now() - 60_000,
    offTime: "14:30",
    status: "upcoming",
    fieldSize: 10,
    runners: [],
    openBetCount: 0,
    standardPlaces: 3,
    offerTags: [],
    trackedEventId: 42,
  };

  it("flags tracked past-off races without finished status", () => {
    expect(isDeskRacePendingSettle(base)).toBe(true);
  });

  it("returns false when race is finished", () => {
    expect(isDeskRacePendingSettle({ ...base, status: "finished" })).toBe(false);
  });

  it("returns false when not tracked", () => {
    expect(isDeskRacePendingSettle({ ...base, trackedEventId: undefined })).toBe(false);
  });
});
