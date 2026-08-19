import { describe, expect, it } from "vitest";
import {
  eventToPendingSettle,
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

  it("returns true when only a winner is stored (incomplete placings)", () => {
    expect(
      isEventPendingSettle({
        sport: "horse_racing",
        startTime: Date.now() - 60_000,
        goals: JSON.stringify({
          kind: "horse_racing",
          winner: "Horse A",
          runners: [{ horse: "Horse A", position: 1 }],
          fieldSize: 1,
        }),
      })
    ).toBe(true);
  });

  it("returns false when full placings are stored", () => {
    expect(
      isEventPendingSettle({
        sport: "horse_racing",
        startTime: Date.now() - 60_000,
        goals: JSON.stringify({
          kind: "horse_racing",
          winner: "Horse A",
          runners: [
            { horse: "Horse A", position: 1 },
            { horse: "Horse B", position: 2 },
            { horse: "Horse C", position: 3 },
          ],
          fieldSize: 8,
        }),
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

describe("eventToPendingSettle", () => {
  it("uses startTime so a 12-hour API off_time is not shown as 03:10", () => {
    const start = new Date();
    start.setHours(15, 10, 0, 0);
    const pending = eventToPendingSettle({
      id: 144,
      homeTeam: "Novice Stakes",
      awayTeam: "3:10",
      competition: "Southwell (AW)",
      startTime: start.getTime(),
    });
    expect(pending.offTime).toBe("15:10");
    expect(pending.course).toBe("Southwell (AW)");
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
