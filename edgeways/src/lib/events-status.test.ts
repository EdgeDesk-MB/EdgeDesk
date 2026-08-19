import { describe, expect, it } from "vitest";
import {
  countLiveNavEvents,
  formatEventStatus,
  formatRacingEventStatus,
  formatRacingOffTime,
  normaliseRacingApiOffTime,
} from "./events";

const NOW = Date.parse("2026-08-01T14:00:00+01:00");

describe("normaliseRacingApiOffTime", () => {
  it("reads am/pm-less afternoon off-times as afternoon", () => {
    expect(normaliseRacingApiOffTime("3:10")).toBe("15:10");
    expect(normaliseRacingApiOffTime("2:15")).toBe("14:15");
    expect(formatRacingOffTime("1:50")).toBe("13:50");
  });

  it("keeps late-morning, midday, and explicit 24-hour labels", () => {
    expect(normaliseRacingApiOffTime("11:30")).toBe("11:30");
    expect(normaliseRacingApiOffTime("12:20")).toBe("12:20");
    expect(normaliseRacingApiOffTime("15:10")).toBe("15:10");
  });
});

describe("formatRacingEventStatus", () => {
  it("shows Live once the off-time has passed, even if DB status is still upcoming", () => {
    expect(
      formatRacingEventStatus(
        {
          status: "upcoming",
          sport: "horse_racing",
          startTime: NOW - 10 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("Live");
  });

  it("keeps Upcoming before the off", () => {
    expect(
      formatRacingEventStatus(
        {
          status: "upcoming",
          sport: "horse_racing",
          startTime: NOW + 30 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("Upcoming");
  });

  it("shows result wording when finished", () => {
    expect(
      formatRacingEventStatus(
        { status: "finished", sport: "horse_racing", startTime: NOW - 60_000 },
        { winner: "Valedictory" },
        NOW
      )
    ).toBe("Won by Valedictory");
  });
});

describe("formatEventStatus", () => {
  it("uses the same Live label for racing in the tracker", () => {
    expect(
      formatEventStatus(
        {
          sport: "horse_racing",
          status: "upcoming",
          homeScore: 0,
          awayScore: 0,
          minute: 0,
          startTime: NOW - 5 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("Live");
  });
});

describe("countLiveNavEvents", () => {
  const liveFootball = {
    sport: "football",
    status: "live",
    startTime: NOW - 57 * 60_000,
  };
  const finishedRace = {
    sport: "horse_racing",
    status: "finished",
    startTime: NOW - 2 * 60 * 60_000,
  };
  const liveRace = {
    sport: "horse_racing",
    status: "upcoming",
    startTime: NOW - 5 * 60_000,
  };

  it("pulses Tracked Events for any live sport, including football", () => {
    expect(countLiveNavEvents([liveFootball, finishedRace], "all", NOW)).toBe(1);
  });

  it("does not pulse Racing Desk for a live football match with only finished races", () => {
    expect(countLiveNavEvents([liveFootball, finishedRace], "racing", NOW)).toBe(0);
  });

  it("pulses Racing Desk when a tracked horse race is live", () => {
    expect(countLiveNavEvents([liveFootball, liveRace], "racing", NOW)).toBe(1);
  });

  it("treats greyhounds as racing for the Racing Desk pulse", () => {
    expect(
      countLiveNavEvents(
        [{ sport: "greyhounds", status: "live", startTime: NOW - 60_000 }],
        "racing",
        NOW
      )
    ).toBe(1);
  });
});
