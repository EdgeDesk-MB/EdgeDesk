import { describe, expect, it } from "vitest";
import {
  ADD_BET_FOOTBALL_IN_PLAY_MS,
  bandLinkableEventsForPicker,
  bandNotTrackedFixtures,
  capEventSearchSections,
  EVENT_SEARCH_IDLE_PAGE,
  bandTrackedEvents,
  filterByOfferCourseScope,
  filterNotTrackedFixtures,
  filterTrackedForAddBet,
  fixtureSelectValue,
  formatEventDayBandLabel,
  formatKnownFixtureOption,
  formatTrackedEventOption,
  groupByDayBand,
  groupByHourBandIfDense,
  isAddBetEventSelectable,
  isFixtureSelectValue,
  isLiveInAddBetEvents,
  isSelectableInAddBetEvents,
  knownFixtureSearchOption,
  knownFromFootballFixtures,
  knownFromRacingFixtures,
  matchesEventSearch,
  parseFixtureSelectValue,
  partsKnownFixtureOption,
  partsTrackedEventOption,
  resolveFootballPlayerOptions,
  resolveRaceRunnerOptions,
  toEventSearchSection,
  trackedEventSearchOption,
  type KnownFixtureOption,
} from "./add-bet-event-options";
import { londonWallToUtcMs, localCalendarDate } from "./events";
import { serializeRacecardRunners } from "./racing";
import { formatClockString } from "./time-format";

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

describe("groupByHourBandIfDense", () => {
  it("stays flat when every item shares one hour", () => {
    const bands = groupByHourBandIfDense([
      { startTime: msOnDay(0, "18:10"), id: "a" },
      { startTime: msOnDay(0, "18:45"), id: "b" },
    ]);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.label).toBe("");
    expect(bands[0]?.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("nests hour labels when items span multiple hours", () => {
    const bands = groupByHourBandIfDense([
      { startTime: msOnDay(0, "14:05"), id: "a" },
      { startTime: msOnDay(0, "14:40"), id: "b" },
      { startTime: msOnDay(0, "16:10"), id: "c" },
    ]);
    expect(bands.map((b) => b.label)).toEqual([
      formatClockString("14:00"),
      formatClockString("16:00"),
    ]);
    expect(bands[0]?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(bands[1]?.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("merges the same hour when live-first sort splits it", () => {
    // Live 15:05, then upcoming 17:00, then upcoming 15:45 (same hour as live).
    const bands = groupByHourBandIfDense([
      { startTime: msOnDay(0, "15:05"), id: "live" },
      { startTime: msOnDay(0, "17:00"), id: "later" },
      { startTime: msOnDay(0, "15:45"), id: "upcoming-same-hour" },
    ]);
    expect(bands.map((b) => b.key)).toEqual(["15:00", "17:00"]);
    expect(bands[0]?.items.map((i) => i.id)).toEqual([
      "live",
      "upcoming-same-hour",
    ]);
    expect(bands[1]?.items.map((i) => i.id)).toEqual(["later"]);
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
    expect(isLiveInAddBetEvents(now + 10 * 60_000, "live", now, undefined, "football")).toBe(
      true
    );
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

  it("labels Live for races inside the grace window", () => {
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

  it("keeps in-play football selectable with a Live chip", () => {
    const now = msOnDay(0, "20:48");
    const kickoff = now - 48 * 60_000;
    expect(
      isAddBetEventSelectable(
        {
          sport: "football",
          status: "live",
          startTime: kickoff,
        },
        now
      )
    ).toBe(true);
    expect(
      isLiveInAddBetEvents(kickoff, "live", now, undefined, "football")
    ).toBe(true);
    expect(
      filterNotTrackedFixtures(
        [
          {
            externalId: "1567409",
            sport: "football",
            competition: "League Cup",
            homeTeam: "Plymouth",
            awayTeam: "Exeter City",
            startTime: kickoff,
            status: "live",
          },
          {
            externalId: "stale-ft",
            sport: "football",
            competition: "League Cup",
            homeTeam: "Old",
            awayTeam: "News",
            startTime: now - ADD_BET_FOOTBALL_IN_PLAY_MS - 60_000,
            status: "live",
          },
        ],
        new Set(),
        now
      ).map((f) => f.externalId)
    ).toEqual(["1567409"]);
    expect(
      formatKnownFixtureOption(
        {
          externalId: "1567409",
          sport: "football",
          competition: "League Cup",
          homeTeam: "Plymouth",
          awayTeam: "Exeter City",
          startTime: kickoff,
          status: "live",
        },
        now
      )
    ).toContain("LIVE");
    expect(
      filterTrackedForAddBet(
        [
          {
            id: 9,
            homeTeam: "Plymouth",
            awayTeam: "Exeter City",
            startTime: kickoff,
            status: "live",
            sport: "football",
          },
        ],
        now
      ).map((e) => e.id)
    ).toEqual([9]);
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
  it("formats football with clock only (day band carries the date)", () => {
    // Pin now before kickoff so the live window never flips the label.
    const now = msOnDay(0, "10:00");
    const start = msOnDay(0, "15:00");
    const parts = partsKnownFixtureOption(
      {
        externalId: "1",
        sport: "football",
        competition: "PL",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startTime: start,
        status: "upcoming",
      },
      now
    );
    expect(parts.title).toBe("Arsenal v Chelsea");
    expect(parts.time).toBe(formatClockString("15:00"));
    expect(parts.time).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const label = formatKnownFixtureOption(
      {
        externalId: "1",
        sport: "football",
        competition: "PL",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startTime: start,
        status: "upcoming",
      },
      now
    );
    expect(label).toBe(`Arsenal v Chelsea · ${formatClockString("15:00")}`);
  });

  it("formats racing as venue with separate clock", () => {
    const start = msOnDay(0, "14:05");
    const fixture = knownFromRacingFixtures([
      {
        externalId: "r1",
        competition: "Redcar",
        raceName: "Handicap",
        course: "Redcar",
        startTime: start,
        status: "upcoming",
        offTime: "14:05",
      },
    ])[0]!;
    const parts = partsKnownFixtureOption(fixture);
    expect(parts.title).toBe("Redcar");
    expect(parts.time).toBe(formatClockString("14:05"));
    expect(formatKnownFixtureOption(fixture)).toMatch(/Redcar ·/);
  });

  it("keeps Live out of the title for tracked football", () => {
    const now = msOnDay(0, "15:02");
    const parts = partsTrackedEventOption(
      {
        id: 1,
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startTime: now - 2 * 60_000,
        status: "live",
        sport: "football",
      },
      now
    );
    expect(parts.title).toBe("Arsenal v Chelsea");
    expect(parts.status).toBe("LIVE");
    expect(parts.time).toBeTruthy();
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

  it("keeps the current selection while the runner card is still empty", () => {
    expect(
      resolveRaceRunnerOptions({
        eventLinked: true,
        currentSelection: "State Man",
      })
    ).toEqual(["State Man"]);
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

describe("event search options", () => {
  const now = msOnDay(0, "09:00");

  const senior = trackedEventSearchOption(
    {
      id: 1,
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      competition: "Premier League",
      startTime: msOnDay(0, "15:00"),
      status: "upcoming",
      sport: "football",
    },
    now
  );
  const u21 = trackedEventSearchOption(
    {
      id: 2,
      homeTeam: "Arsenal U21",
      awayTeam: "Chelsea U21",
      competition: "Premier League 2",
      startTime: msOnDay(0, "13:00"),
      status: "upcoming",
      sport: "football",
    },
    now
  );

  it("values tracked rows by id and fixtures by fixture: prefix", () => {
    expect(senior.value).toBe("1");
    const fixture = knownFixtureSearchOption(
      {
        externalId: "ext-9",
        sport: "football",
        competition: "Premier League",
        homeTeam: "Arsenal",
        awayTeam: "Spurs",
        startTime: msOnDay(0, "17:30"),
        status: "upcoming",
      },
      now
    );
    expect(fixture.value).toBe(fixtureSelectValue("ext-9"));
  });

  it("matches both Arsenal and Arsenal U21 for a shared substring", () => {
    expect(matchesEventSearch(senior.keywords, "Arsenal")).toBe(true);
    expect(matchesEventSearch(u21.keywords, "Arsenal")).toBe(true);
  });

  it("narrows with tokenised AND across words", () => {
    expect(matchesEventSearch(u21.keywords, "arsenal u21")).toBe(true);
    expect(matchesEventSearch(senior.keywords, "arsenal u21")).toBe(false);
    expect(matchesEventSearch(senior.keywords, "arsenal chelsea")).toBe(true);
    expect(matchesEventSearch(senior.keywords, "arsenal spurs")).toBe(false);
  });

  it("is case-insensitive and matches competitions", () => {
    expect(matchesEventSearch(senior.keywords, "PREMIER")).toBe(true);
    expect(matchesEventSearch(senior.keywords, "")).toBe(true);
    expect(matchesEventSearch(senior.keywords, "   ")).toBe(true);
  });

  it("reaches race names and courses for racing fixtures", () => {
    const race = knownFixtureSearchOption(
      {
        externalId: "r1",
        sport: "horse_racing",
        competition: "Goodwood",
        course: "Goodwood",
        raceName: "14:30 Handicap",
        homeTeam: "14:30 Handicap",
        awayTeam: "14:30",
        startTime: msOnDay(0, "14:30"),
        status: "upcoming",
        offTime: "14:30",
      },
      now
    );
    expect(matchesEventSearch(race.keywords, "goodwood")).toBe(true);
    expect(matchesEventSearch(race.keywords, "handicap")).toBe(true);
    expect(matchesEventSearch(race.keywords, "ascot")).toBe(false);
  });

  it("maps banded rows into a searchable section preserving order", () => {
    const section = toEventSearchSection(
      "tracked",
      "Tracked",
      [
        {
          key: "today",
          label: "Today",
          hours: [
            { key: "13:00", label: "13:00", items: [u21] },
            { key: "15:00", label: "15:00", items: [senior] },
          ].map((h) => ({ ...h, items: h.items.map((o) => o.value) })),
        },
      ],
      (value) => ({ value, sport: "football", parts: { title: value, time: "", status: "" }, keywords: value })
    );
    expect(section.key).toBe("tracked");
    expect(section.bands[0]?.hours[0]?.items[0]?.value).toBe("2");
    expect(section.bands[0]?.hours[1]?.items[0]?.value).toBe("1");
  });
});

describe("capEventSearchSections", () => {
  const option = (value: string) => ({
    value,
    sport: "football",
    parts: { title: value, time: "", status: "" },
    keywords: value,
  });

  const section = toEventSearchSection(
    "fixtures",
    "Fixtures",
    [
      {
        key: "today",
        label: "Today",
        hours: [
          { key: "10:00", label: "10:00", items: [option("a"), option("b"), option("c")] },
          { key: "11:00", label: "11:00", items: [option("d"), option("e")] },
        ],
      },
    ],
    (item) => item
  );

  it("keeps banding and counts what is still hidden", () => {
    const first = capEventSearchSections([section], 3);
    expect(first.rendered).toBe(3);
    expect(first.sections[0]?.total).toBe(5);
    expect(first.sections[0]?.bands[0]?.hours).toHaveLength(1);
    expect(first.sections[0]?.bands[0]?.hours[0]?.items.map((row) => row.value)).toEqual([
      "a",
      "b",
      "c",
    ]);

    const next = capEventSearchSections([section], EVENT_SEARCH_IDLE_PAGE);
    expect(next.rendered).toBe(5);
    expect(next.sections[0]?.bands[0]?.hours).toHaveLength(2);
  });
});

describe("resolveFootballPlayerOptions", () => {
  const xi = JSON.stringify({
    homeFormation: "4-3-3",
    awayFormation: "4-4-2",
    home: [{ name: "Saka" }],
    away: [{ name: "Salah" }],
  });

  it("lists the XI on a goalscorer market", () => {
    expect(
      resolveFootballPlayerOptions({
        eventLinked: true,
        sport: "football",
        market: "first_goalscorer",
        lineups: xi,
      })
    ).toEqual(["Saka", "Salah"]);
  });

  it("stays empty for match odds", () => {
    expect(
      resolveFootballPlayerOptions({
        eventLinked: true,
        sport: "football",
        market: "match_odds",
        lineups: xi,
      })
    ).toEqual([]);
  });
});
