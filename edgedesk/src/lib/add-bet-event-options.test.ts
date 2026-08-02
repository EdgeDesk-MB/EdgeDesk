import { describe, expect, it } from "vitest";
import {
  bandLinkableEventsForPicker,
  bandNotTrackedFixtures,
  bandTrackedEvents,
  filterByOfferCourseScope,
  filterNotTrackedFixtures,
  filterTrackedForAddBet,
  fixtureSelectValue,
  formatEventDayBandLabel,
  formatKnownFixtureOption,
  formatTrackedEventOption,
  groupByDayBand,
  isFixtureSelectValue,
  isLiveInAddBetEvents,
  isSelectableInAddBetEvents,
  knownFromFootballFixtures,
  knownFromRacingFixtures,
  parseFixtureSelectValue,
  resolveRaceRunnerOptions,
  type KnownFixtureOption,
} from "./add-bet-event-options";
import { londonWallToUtcMs, localCalendarDate } from "./events";
import { serializeRacecardRunners } from "./racing";

function msOnDay(dayOffset: number, hm: string): number {
  const today = localCalendarDate();
  const noon = londonWallToUtcMs(today, "12:00") ?? Date.now();
  const day = localCalendarDate(new Date(noon + dayOffset * 86_400_000));
  return londonWallToUtcMs(day, hm) ?? noon;
}

describe("fixture select values", () => {
  it("round-trips external ids including colons", () => {
    const id = "abc:123:xyz";
    const value = fixtureSelectValue(id);
    expect(isFixtureSelectValue(value)).toBe(true);
    expect(parseFixtureSelectValue(value)).toBe(id);
    expect(parseFixtureSelectValue("12")).toBeNull();
    expect(parseFixtureSelectValue("fixture:")).toBeNull();
  });
});

describe("day band labels", () => {
  it("labels today and tomorrow", () => {
    const now = msOnDay(0, "10:00");
    expect(formatEventDayBandLabel(msOnDay(0, "15:00"), now)).toBe("Today");
    expect(formatEventDayBandLabel(msOnDay(1, "15:00"), now)).toBe("Tomorrow");
    expect(formatEventDayBandLabel(msOnDay(3, "15:00"), now)).not.toMatch(/Today|Tomorrow/);
  });
});

describe("groupByDayBand", () => {
  it("keeps ascending day order and groups items", () => {
    const now = msOnDay(0, "09:00");
    const bands = groupByDayBand(
      [
        { startTime: msOnDay(0, "14:00"), id: "a" },
        { startTime: msOnDay(0, "16:00"), id: "b" },
        { startTime: msOnDay(1, "13:00"), id: "c" },
      ],
      now
    );
    expect(bands.map((b) => b.label)).toEqual(["Today", "Tomorrow"]);
    expect(bands[0]?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(bands[1]?.items.map((i) => i.id)).toEqual(["c"]);
  });
});

describe("bandLinkableEventsForPicker", () => {
  it("puts today/tomorrow first, then past days newest-first", () => {
    const now = msOnDay(0, "12:00");
    const bands = bandLinkableEventsForPicker(
      [
        { startTime: msOnDay(-2, "15:00"), id: "older" },
        { startTime: msOnDay(-1, "14:00"), id: "yesterday" },
        { startTime: msOnDay(0, "16:00"), id: "today" },
        { startTime: msOnDay(1, "13:00"), id: "tomorrow" },
      ],
      now
    );
    expect(bands.map((b) => b.items.map((i) => i.id))).toEqual([
      ["today"],
      ["tomorrow"],
      ["yesterday"],
      ["older"],
    ]);
    expect(bands[0]?.label).toBe("Today");
    expect(bands[1]?.label).toBe("Tomorrow");
  });
});

describe("add bet past grace window", () => {
  it("keeps events up to 5 minutes past off-time, then drops them", () => {
    const now = msOnDay(0, "14:00");
    expect(isSelectableInAddBetEvents(now - 4 * 60_000, now)).toBe(true);
    expect(isSelectableInAddBetEvents(now - 5 * 60_000, now)).toBe(false);
    expect(isSelectableInAddBetEvents(now + 60_000, now)).toBe(true);
    expect(isLiveInAddBetEvents(now - 2 * 60_000, "upcoming", now)).toBe(true);
    expect(isLiveInAddBetEvents(now + 10 * 60_000, "upcoming", now)).toBe(false);
  });

  it("drops stale live fixtures from not-tracked and tracked lists", () => {
    const now = msOnDay(0, "14:00");
    const known: KnownFixtureOption[] = [
      {
        externalId: "fresh",
        sport: "horse_racing",
        competition: "Thirsk",
        homeTeam: "14:08",
        awayTeam: "",
        startTime: now - 2 * 60_000,
        status: "live",
        course: "Thirsk",
      },
      {
        externalId: "stale",
        sport: "horse_racing",
        competition: "Newmarket",
        homeTeam: "13:33",
        awayTeam: "",
        startTime: now - 10 * 60_000,
        status: "live",
        course: "Newmarket",
      },
    ];
    expect(filterNotTrackedFixtures(known, new Set(), now).map((f) => f.externalId)).toEqual([
      "fresh",
    ]);
    expect(
      filterTrackedForAddBet(
        [
          {
            id: 1,
            homeTeam: "Goodwood",
            awayTeam: "13:50",
            startTime: now - 10 * 60_000,
            status: "upcoming",
            sport: "horse_racing",
          },
          {
            id: 2,
            homeTeam: "Goodwood",
            awayTeam: "14:05",
            startTime: now + 5 * 60_000,
            status: "upcoming",
            sport: "horse_racing",
          },
        ],
        now
      ).map((e) => e.id)
    ).toEqual([2]);
  });

  it("labels LIVE for races inside the grace window", () => {
    const now = msOnDay(0, "14:00");
    expect(
      formatTrackedEventOption(
        {
          id: 1,
          homeTeam: "Goodwood",
          awayTeam: "13:58",
          competition: "Goodwood",
          startTime: now - 2 * 60_000,
          status: "upcoming",
          sport: "horse_racing",
        },
        now
      )
    ).toContain("LIVE");
    expect(
      formatKnownFixtureOption(
        {
          externalId: "x",
          sport: "horse_racing",
          competition: "Thirsk",
          course: "Thirsk",
          homeTeam: "13:58",
          awayTeam: "",
          startTime: now - 2 * 60_000,
          status: "live",
        },
        now
      )
    ).toContain("LIVE");
  });
});

describe("not tracked filtering", () => {
  it("drops finished and already-tracked external ids", () => {
    const now = msOnDay(0, "12:00");
    const known: KnownFixtureOption[] = [
      {
        externalId: "keep",
        sport: "football",
        competition: "PL",
        homeTeam: "A",
        awayTeam: "B",
        startTime: msOnDay(0, "15:00"),
        status: "upcoming",
      },
      {
        externalId: "tracked",
        sport: "football",
        competition: "PL",
        homeTeam: "C",
        awayTeam: "D",
        startTime: msOnDay(0, "16:00"),
        status: "upcoming",
      },
      {
        externalId: "done",
        sport: "football",
        competition: "PL",
        homeTeam: "E",
        awayTeam: "F",
        startTime: msOnDay(0, "12:00"),
        status: "finished",
      },
    ];
    const filtered = filterNotTrackedFixtures(known, new Set(["tracked"]), now);
    expect(filtered.map((f) => f.externalId)).toEqual(["keep"]);
  });

  it("bands not-tracked after dedupe", () => {
    const now = msOnDay(0, "09:00");
    const known = knownFromFootballFixtures([
      {
        externalId: "t1",
        competition: "PL",
        homeTeam: "A",
        awayTeam: "B",
        startTime: msOnDay(0, "15:00"),
        status: "upcoming",
      },
      {
        externalId: "n1",
        competition: "PL",
        homeTeam: "C",
        awayTeam: "D",
        startTime: msOnDay(1, "15:00"),
        status: "upcoming",
      },
    ]);
    const bands = bandNotTrackedFixtures(known, new Set(["t1"]), now);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.label).toBe("Tomorrow");
    expect(bands[0]?.items[0]?.externalId).toBe("n1");
  });
});

describe("tracked banding", () => {
  it("puts live before upcoming within today", () => {
    const now = msOnDay(0, "16:00");
    const bands = bandTrackedEvents(
      [
        {
          id: 1,
          homeTeam: "Later",
          awayTeam: "Side",
          startTime: msOnDay(0, "18:00"),
          status: "upcoming",
          sport: "football",
        },
        {
          id: 2,
          homeTeam: "Live",
          awayTeam: "Side",
          // Within the 5-minute grace so it stays selectable as LIVE
          startTime: now - 2 * 60_000,
          status: "live",
          sport: "football",
        },
      ],
      now
    );
    expect(bands).toHaveLength(1);
    expect(bands[0]?.items.map((e) => e.id)).toEqual([2, 1]);
  });
});

describe("formatKnownFixtureOption", () => {
  it("formats football like tracked options", () => {
    const start = msOnDay(0, "15:00");
    const label = formatKnownFixtureOption({
      externalId: "1",
      sport: "football",
      competition: "PL",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      startTime: start,
      status: "upcoming",
    });
    expect(label).toContain("Arsenal v Chelsea");
    expect(label).toContain("·");
  });

  it("formats racing as venue · time", () => {
    const start = msOnDay(0, "14:05");
    const label = formatKnownFixtureOption(
      knownFromRacingFixtures([
        {
          externalId: "r1",
          competition: "Redcar",
          raceName: "Handicap",
          course: "Redcar",
          startTime: start,
          status: "upcoming",
          offTime: "14:05",
        },
      ])[0]!
    );
    expect(label).toMatch(/Redcar ·/);
  });
});

describe("resolveRaceRunnerOptions", () => {
  it("returns empty when no event is linked", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: false,
        pendingRunners: ["A", "B"],
      })
    ).toEqual([]);
  });

  it("prefers fetched (desk odds order) over pending cloth order", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        pendingRunners: ["Yazin", "State Man"],
        trackedGoals: serializeRacecardRunners(["Other"]),
        fetchedRunners: ["State Man", "Yazin"],
      })
    ).toEqual(["State Man", "Yazin"]);
  });

  it("uses pending runners before the desk fetch lands", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        pendingRunners: ["Yazin", "State Man"],
        trackedGoals: serializeRacecardRunners(["Other"]),
      })
    ).toEqual(["Yazin", "State Man"]);
  });

  it("prefers fetched (odds-sorted) runners over tracked card order", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        trackedGoals: serializeRacecardRunners(["Constitution Hill", "State Man"]),
        fetchedRunners: ["State Man", "Constitution Hill"],
      })
    ).toEqual(["State Man", "Constitution Hill"]);
  });

  it("uses tracked racecard goals when nothing else is available", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        trackedGoals: serializeRacecardRunners(["Constitution Hill", "State Man"]),
      })
    ).toEqual(["Constitution Hill", "State Man"]);
  });

  it("falls back to fetched runners", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        fetchedRunners: ["Galopin Des Champs", "Fact To File"],
      })
    ).toEqual(["Galopin Des Champs", "Fact To File"]);
  });

  it("keeps an edit selection that is missing from the card", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        pendingRunners: ["Yazin", "State Man"],
        currentSelection: "Legacy Pick",
      })
    ).toEqual(["Legacy Pick", "Yazin", "State Man"]);
  });

  it("capitalises lowercase runner names", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        pendingRunners: ["forceonmyown", "sir allen"],
      })
    ).toEqual(["Forceonmyown", "Sir Allen"]);
  });

  it("reorders tracked card runners to match odds order hint", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        trackedGoals: serializeRacecardRunners(["Outsider", "Favourite", "Second"]),
        oddsOrder: ["Favourite", "Second", "Outsider"],
      })
    ).toEqual(["Favourite", "Second", "Outsider"]);
  });
});

describe("knownFromRacingFixtures", () => {
  it("orders runners favourite-first from runnerDetails", () => {
    const [opt] = knownFromRacingFixtures([
      {
        externalId: "r1",
        competition: "Ascot",
        raceName: "1:50",
        course: "Ascot",
        startTime: Date.now(),
        status: "upcoming",
        offTime: "13:50",
        runners: ["Outsider", "Favourite"],
        runnerDetails: [
          { name: "Outsider", spDecimal: 21 },
          { name: "Favourite", spDecimal: 2.5 },
          { name: "NR", spDecimal: 3, nonRunner: true },
        ],
      },
    ]);
    expect(opt.runners).toEqual(["Favourite", "Outsider"]);
  });
});

describe("filterByOfferCourseScope", () => {
  const fixtures: KnownFixtureOption[] = [
    {
      externalId: "a",
      sport: "horse_racing",
      competition: "Goodwood",
      course: "Goodwood",
      homeTeam: "1:50",
      awayTeam: "",
      startTime: msOnDay(0, "13:50"),
      status: "upcoming",
    },
    {
      externalId: "b",
      sport: "horse_racing",
      competition: "Ascot",
      course: "Ascot",
      homeTeam: "14:00",
      awayTeam: "",
      startTime: msOnDay(0, "14:00"),
      status: "upcoming",
    },
    {
      externalId: "c",
      sport: "horse_racing",
      competition: "goodwood",
      homeTeam: "15:05",
      awayTeam: "",
      startTime: msOnDay(0, "15:05"),
      status: "upcoming",
    },
  ];

  it("keeps only races at the scoped course (case-insensitive)", () => {
    expect(filterByOfferCourseScope(fixtures, "Goodwood").map((f) => f.externalId)).toEqual([
      "a",
      "c",
    ]);
  });

  it("returns all items for regional UK & IRE scope", () => {
    expect(filterByOfferCourseScope(fixtures, "uk_ire")).toHaveLength(3);
    expect(filterByOfferCourseScope(fixtures, null)).toHaveLength(3);
  });

  it("keeps races at any of several scoped courses", () => {
    expect(
      filterByOfferCourseScope(fixtures, "Galway, Goodwood").map((f) => f.externalId)
    ).toEqual(["a", "c"]);
  });
});
