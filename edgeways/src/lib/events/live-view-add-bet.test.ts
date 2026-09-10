import { describe, expect, it } from "vitest";
import type { Fixture, RacingFixture } from "@/components/events/types";
import {
  liveViewExternalId,
  liveViewFootballAddBetPrefill,
  liveViewRacingAddBetPrefill,
} from "./live-view-add-bet";

const fixture: Fixture = {
  externalId: "fx-1",
  sport: "football",
  competition: "La Liga",
  homeTeam: "Elche",
  awayTeam: "Real Sociedad",
  startTime: Date.parse("2026-09-07T19:30:00.000Z"),
  status: "upcoming",
  homeScore: 0,
  awayScore: 0,
  minute: 0,
};

const race: RacingFixture = {
  externalId: "rac-1",
  sport: "horse_racing",
  competition: "Leicester",
  raceName: "Nursery",
  course: "Leicester",
  startTime: Date.parse("2026-09-08T12:12:00.000Z"),
  status: "upcoming",
  fieldSize: 8,
  offTime: "1:12",
  runners: ["Alpha", "Bravo"],
};

describe("liveViewAddBetPrefill", () => {
  it("links football without a tracked event id", () => {
    const prefill = liveViewFootballAddBetPrefill(fixture);
    expect(prefill.eventId).toBeUndefined();
    expect(prefill.liveExternalId).toBe("fx-1");
    expect(prefill.sport).toBe("football");
    expect(prefill.market).toBe("match_odds");
    expect(prefill.labelSuggestion).toBe("Elche v Real Sociedad");
  });

  it("keeps an already-tracked football id", () => {
    expect(liveViewFootballAddBetPrefill(fixture, 44).eventId).toBe(44);
  });

  it("links racing on liveExternalId and raceExternalId", () => {
    const prefill = liveViewRacingAddBetPrefill(race);
    expect(prefill.eventId).toBeUndefined();
    expect(liveViewExternalId(prefill)).toBe("rac-1");
    expect(prefill.raceExternalId).toBe("rac-1");
    expect(prefill.runners).toEqual(["Alpha", "Bravo"]);
  });
});
