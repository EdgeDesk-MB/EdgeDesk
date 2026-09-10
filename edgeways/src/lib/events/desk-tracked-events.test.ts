import { describe, expect, it } from "vitest";
import { filterEventsForDesk } from "@/lib/events/desk-tracked-events";
import type { BetRow, EventRow } from "@/lib/db/schema";

function event(id: number): EventRow {
  return {
    id,
    sport: "horse_racing",
    externalId: `race-${id}`,
    competition: "Lingfield",
    homeTeam: "Race",
    awayTeam: "14:10",
    startTime: 1,
    status: "upcoming",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: null,
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
    resultPostedAt: null,
    createdAt: 1,
  };
}

function bet(partial: Pick<BetRow, "eventId" | "status">): Pick<BetRow, "eventId" | "status"> {
  return partial;
}

describe("filterEventsForDesk", () => {
  const events = [event(1), event(2), event(3)];

  it("hides the shared feed until this desk follows a fixture", () => {
    expect(filterEventsForDesk(events, [], [])).toEqual([]);
  });

  it("shows followed fixtures and hides the rest", () => {
    expect(filterEventsForDesk(events, [2], []).map((e) => e.id)).toEqual([2]);
  });

  it("keeps a fixture with an open bet even after unfollow", () => {
    expect(
      filterEventsForDesk(events, [], [bet({ eventId: 3, status: "open" })]).map((e) => e.id)
    ).toEqual([3]);
  });

  it("does not keep a settled bet on the tracked list", () => {
    expect(
      filterEventsForDesk(events, [], [bet({ eventId: 3, status: "won" })])
    ).toEqual([]);
  });
});
