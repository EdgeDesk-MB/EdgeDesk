import { describe, expect, it } from "vitest";
import {
  countLiveNavEvents,
  effectiveEventStatus,
  eventShowsScore,
  clampCalendarYmd,
  feedHorizonDates,
  fixtureListDayBounds,
  shiftCalendarYmd,
  footballClockLabel,
  footballPhaseLabel,
  formatEventStatus,
  formatRacingEventStatus,
  formatRacingOffTime,
  mergeByExternalId,
  normaliseRacingApiOffTime,
  withEffectiveFeedStatus,
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

describe("footballClockLabel", () => {
  it("prints HT instead of 45'", () => {
    expect(footballClockLabel({ minute: 45, period: "HT" })).toBe("HT");
    expect(footballClockLabel({ minute: 45, period: "1H" })).toBe("45'");
  });

  it("labels extra time and penalties from the same period field", () => {
    expect(footballClockLabel({ minute: 105, period: "ET" })).toBe("ET 105'");
    expect(footballClockLabel({ minute: 120, period: "P" })).toBe("Pens");
    expect(footballClockLabel({ minute: 90, period: "BT" })).toBe("BT");
  });

  it("prints FT / AET / PEN from the API short, not the minute", () => {
    expect(footballClockLabel({ minute: 90, period: "FT" })).toBe("FT");
    expect(footballClockLabel({ minute: 120, period: "AET" })).toBe("AET");
    expect(footballClockLabel({ minute: 120, period: "PEN" })).toBe("PEN");
    expect(footballClockLabel({ minute: 90, period: "2H" })).toBe("90'");
  });
});

describe("footballPhaseLabel", () => {
  it("does not invent FT from a 90th-minute clock", () => {
    expect(footballPhaseLabel({ minute: 90 })).toBeNull();
    expect(footballPhaseLabel({ minute: 90, matchEnding: "ft" })).toBe("FT");
    expect(footballPhaseLabel({ minute: 45, period: "HT" })).toBe("HT");
  });
});

describe("effectiveEventStatus", () => {
  it("flips API football to live once kick-off has passed", () => {
    expect(
      effectiveEventStatus(
        {
          sport: "football",
          status: "upcoming",
          source: "api",
          startTime: NOW - 60_000,
        },
        NOW
      )
    ).toBe("live");
  });

  it("keeps API football upcoming before kick-off", () => {
    expect(
      effectiveEventStatus(
        {
          sport: "football",
          status: "upcoming",
          source: "api",
          startTime: NOW + 60_000,
        },
        NOW
      )
    ).toBe("upcoming");
  });
});

describe("withEffectiveFeedStatus", () => {
  it("treats football day-cards without source as API-fed", () => {
    expect(
      withEffectiveFeedStatus(
        {
          sport: "football" as const,
          status: "upcoming" as const,
          startTime: NOW - 60_000,
        },
        NOW
      ).status
    ).toBe("live");
  });

  it("does not invent live for a finished match", () => {
    expect(
      withEffectiveFeedStatus(
        {
          sport: "football" as const,
          status: "finished" as const,
          startTime: NOW - 60_000,
        },
        NOW
      ).status
    ).toBe("finished");
  });
});

describe("formatEventStatus", () => {
  it("does not print a football score before kickoff", () => {
    expect(
      formatEventStatus(
        {
          sport: "football",
          status: "upcoming",
          homeScore: 2,
          awayScore: 1,
          minute: 0,
          source: "api",
          startTime: NOW + 3 * 60 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("upcoming");
  });

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

describe("eventShowsScore", () => {
  it("hides a score on an upcoming football match, even if one is stored", () => {
    expect(
      eventShowsScore(
        {
          sport: "football",
          status: "upcoming",
          source: "api",
          startTime: NOW + 2 * 60 * 60_000,
        },
        NOW
      )
    ).toBe(false);
  });

  it("shows a score once the match is live or finished", () => {
    expect(
      eventShowsScore(
        {
          sport: "football",
          status: "live",
          source: "api",
          startTime: NOW - 10 * 60_000,
        },
        NOW
      )
    ).toBe(true);
    expect(
      eventShowsScore(
        {
          sport: "football",
          status: "finished",
          source: "api",
          startTime: NOW - 2 * 60 * 60_000,
        },
        NOW
      )
    ).toBe(true);
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

describe("feedHorizonDates", () => {
  it("returns today and tomorrow in the UK calendar", () => {
    expect(feedHorizonDates(NOW)).toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("bounds the fixture day switcher from lookback through tomorrow", () => {
    expect(fixtureListDayBounds(NOW)).toEqual({
      min: "2026-07-26",
      max: "2026-08-02",
      today: "2026-08-01",
    });
    expect(shiftCalendarYmd("2026-08-01", 1)).toBe("2026-08-02");
    expect(clampCalendarYmd("2026-08-09", "2026-07-26", "2026-08-02")).toBe("2026-08-02");
  });

  it("keeps the last write when the same id appears twice", () => {
    expect(
      mergeByExternalId([
        { externalId: "a", n: 1 },
        { externalId: "b", n: 2 },
        { externalId: "a", n: 3 },
      ])
    ).toEqual([
      { externalId: "a", n: 3 },
      { externalId: "b", n: 2 },
    ]);
  });
});
