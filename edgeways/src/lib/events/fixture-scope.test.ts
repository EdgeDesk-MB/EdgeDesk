import { describe, expect, it } from "vitest";
import {
  displayFootballCompetitionName,
  filterScopeOptions,
  fixtureMatchesFootballScope,
  footballCompetitionDisplayTitle,
  footballScopeId,
  footballScopeHeadingParts,
  footballScopeLabel,
  footballAudienceBand,
  groupFootballByLeague,
  groupFootballScopesWithCatalog,
  sortFootballTapeGroups,
  sortGroupsByFirstStart,
  favouriteScopeStub,
  moveFavouriteScopeId,
  normalizeFavouriteScopeIds,
  orderByFavouriteIds,
  partitionHiddenScopeOptions,
  sortFavouriteScopeIdsFirst,
  sortFootballScopeMenu,
  sortGroupsByFavouriteOrder,
  tapeGroupsWithScopeHeaders,
  takeScopeMenuPage,
  toggleFavouriteScopeId,
  collapsedScopeCountCopy,
  countFixtureStatuses,
} from "@/lib/events/fixture-scope";

describe("footballScopeId", () => {
  it("keeps same-named leagues in different countries apart", () => {
    expect(footballScopeId("Premier League", "England")).toBe("England::Premier League");
    expect(footballScopeId("Premier League", "Hong Kong")).toBe(
      "Hong Kong::Premier League"
    );
    expect(footballScopeId("Premier League", "England")).not.toBe(
      footballScopeId("Premier League", "Hong Kong")
    );
  });
});

describe("footballScopeLabel", () => {
  it("puts country before the competition", () => {
    expect(footballScopeLabel("Premier League", "England")).toBe(
      "ENGLAND - Premier League"
    );
    expect(footballScopeLabel("Championship", "England")).toBe("ENGLAND - Championship");
    expect(footballScopeLabel("La Liga", "Spain")).toBe("SPAIN - La Liga");
    expect(footballScopeHeadingParts("Championship", "England")).toEqual({
      country: "ENGLAND",
      name: "Championship",
    });
  });

  it("skips a World prefix and names that already include the country", () => {
    expect(footballScopeLabel("FIFA World Cup", "World")).toBe("FIFA World Cup");
    expect(footballScopeLabel("Hong Kong Premier League", "Hong Kong")).toBe(
      "Hong Kong Premier League"
    );
  });

  it("strips a leading feed tier ordinal when the name stays unique", () => {
    expect(displayFootballCompetitionName("2. Division - Group 1")).toBe(
      "Division - Group 1"
    );
    expect(displayFootballCompetitionName("2. Bundesliga")).toBe("Bundesliga");
    expect(
      footballCompetitionDisplayTitle("2. Bundesliga", "Germany", [
        { competition: "2. Bundesliga", leagueCountry: "Germany" },
      ])
    ).toBe("Bundesliga");
    expect(displayFootballCompetitionName("1. Liga Classic - Group 1")).toBe(
      "Liga Classic - Group 1"
    );
    expect(footballScopeLabel("Division", "Belarus")).toBe("BELARUS - Division");
  });

  it("keeps numbers that are not a leading ordinal", () => {
    expect(displayFootballCompetitionName("Premier League 2")).toBe("Premier League 2");
  });
});

describe("groupFootballByLeague", () => {
  it("does not mix England with other Premier Leagues", () => {
    const groups = groupFootballByLeague([
      { competition: "Premier League", leagueCountry: "England" },
      { competition: "Premier League", leagueCountry: "Hong Kong" },
      { competition: "Premier League", leagueCountry: "England" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.label).sort()).toEqual([
      "ENGLAND - Premier League",
      "HONG KONG - Premier League",
    ]);
    expect(
      groups.find((group) => group.leagueCountry === "England")?.fixtures
    ).toHaveLength(2);
  });

  it("keeps the tier ordinal when stripping would collide", () => {
    const groups = groupFootballByLeague([
      { competition: "Bundesliga", leagueCountry: "Germany" },
      { competition: "2. Bundesliga", leagueCountry: "Germany" },
      { competition: "2. Frauen Bundesliga", leagueCountry: "Germany" },
    ]);
    expect(groups.map((group) => group.label).sort()).toEqual([
      "GERMANY - 2. Bundesliga",
      "GERMANY - Bundesliga",
      "GERMANY - Frauen Bundesliga",
    ]);
  });

  it("adds country when stripped names collide across countries", () => {
    const groups = groupFootballByLeague([
      { competition: "1. Division", leagueCountry: "Belarus" },
      { competition: "2. Division", leagueCountry: "Norway" },
    ]);
    expect(groups.map((group) => group.label).sort()).toEqual([
      "BELARUS - Division",
      "NORWAY - Division",
    ]);
  });
});

describe("groupFootballScopesWithCatalog", () => {
  it("keeps today's fixtures and adds catalog competitions with no matches", () => {
    const groups = groupFootballScopesWithCatalog(
      [{ competition: "Premier League", leagueCountry: "England" }],
      [
        { name: "Premier League", country: "England" },
        { name: "FA Cup", country: "England" },
        { name: "FIFA World Cup", country: "World" },
      ]
    );
    expect(groups.map((group) => group.id).sort()).toEqual([
      "England::FA Cup",
      "England::Premier League",
      "World::FIFA World Cup",
    ]);
    expect(
      groups.find((group) => group.id === "England::Premier League")?.fixtures
    ).toHaveLength(1);
    expect(groups.find((group) => group.id === "England::FA Cup")?.fixtures).toEqual([]);
  });
});

describe("fixtureMatchesFootballScope", () => {
  it("matches only the selected country", () => {
    const england = footballScopeId("Premier League", "England");
    expect(
      fixtureMatchesFootballScope(
        { competition: "Premier League", leagueCountry: "England" },
        england
      )
    ).toBe(true);
    expect(
      fixtureMatchesFootballScope(
        { competition: "Premier League", leagueCountry: "Hong Kong" },
        england
      )
    ).toBe(false);
  });
});

describe("filterScopeOptions", () => {
  const options = [
    { id: "eng", label: "Premier League", name: "Premier League", country: "England" },
    {
      id: "hk",
      label: "HONG KONG - Premier League",
      name: "Premier League",
      country: "Hong Kong",
    },
    {
      id: "can",
      label: "Canadian Premier League",
      name: "Canadian Premier League",
      country: "Canada",
    },
    {
      id: "pl2",
      label: "Premier League 2 Division One",
      name: "Premier League 2 Division One",
      country: "England",
    },
  ];

  it("treats premier league as England when that row exists", () => {
    const hits = filterScopeOptions(options, "premier league", "England");
    expect(hits.map((option) => option.id)).toEqual(["eng"]);
  });

  it("still finds a country-qualified label", () => {
    const hits = filterScopeOptions(options, "hong kong - premier league", "England");
    expect(hits.map((option) => option.id)).toEqual(["hk"]);
  });

  it("uses prefix when the query is not an exact name", () => {
    const hits = filterScopeOptions(options, "premier league 2", "England");
    expect(hits.map((option) => option.id)).toEqual(["pl2"]);
  });
});

describe("football tape order", () => {
  it("ranks Premier League and Championship ahead of other England sides", () => {
    expect(footballAudienceBand("Premier League", "England")).toBe(0);
    expect(footballAudienceBand("Championship", "England")).toBe(1);
    expect(footballAudienceBand("Premier League 2", "England")).toBeGreaterThan(1);
    expect(footballAudienceBand("2. Bundesliga", "Germany")).toBeGreaterThan(
      footballAudienceBand("Bundesliga", "Germany")
    );
  });

  it("puts UK and top-flight Europe first, then first kick-off", () => {
    const groups = sortFootballTapeGroups(
      [
        {
          competition: "League One",
          leagueCountry: "England",
          label: "League One",
          fixtures: [{ startTime: 100 }],
        },
        {
          competition: "La Liga",
          leagueCountry: "Spain",
          label: "La Liga",
          fixtures: [{ startTime: 400 }],
        },
        {
          competition: "Premier League",
          leagueCountry: "England",
          label: "Premier League",
          fixtures: [{ startTime: 300 }],
        },
        {
          competition: "Serie A",
          leagueCountry: "Italy",
          label: "Serie A",
          fixtures: [{ startTime: 200 }],
        },
      ],
      true
    );
    expect(groups.map((group) => group.competition)).toEqual([
      "Premier League",
      "Serie A",
      "La Liga",
      "League One",
    ]);
  });

  it("orders other competitions by the first kick-off", () => {
    const groups = sortGroupsByFirstStart(
      [
        { label: "Late Cup", fixtures: [{ startTime: 9 }] },
        { label: "Early Cup", fixtures: [{ startTime: 2 }, { startTime: 8 }] },
      ],
      (group) => group.label
    );
    expect(groups.map((group) => group.label)).toEqual(["Early Cup", "Late Cup"]);
  });
});

describe("favourite scope ids", () => {
  it("normalises, dedupes, and drops reserved tokens", () => {
    expect(
      normalizeFavouriteScopeIds([
        " England::Premier League ",
        "England::Premier League",
        "all",
        "favourites",
        "",
        12,
        "Hong Kong::Premier League",
      ])
    ).toEqual(["England::Premier League", "Hong Kong::Premier League"]);
  });

  it("toggles a pin on and off", () => {
    const added = toggleFavouriteScopeId([], "England::Premier League");
    expect(added).toEqual(["England::Premier League"]);
    expect(toggleFavouriteScopeId(added, "England::Premier League")).toEqual([]);
  });

  it("keeps favourite rows in the saved pin order", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(sortFavouriteScopeIdsFirst(rows, ["c", "a"]).map((row) => row.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("moves a pin in front of another without sorting by the day", () => {
    expect(moveFavouriteScopeId(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveFavouriteScopeId(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveFavouriteScopeId(["a", "b", "c"], "a", "b")).toEqual(["b", "a", "c"]);
  });

  it("keeps pins in saved order when today's cards are missing", () => {
    const byId = new Map([["England::Championship", { id: "England::Championship", count: 6 }]]);
    expect(
      orderByFavouriteIds(
        ["Italy::Serie A", "England::Championship"],
        byId,
        favouriteScopeStub
      ).map((row) => row.id)
    ).toEqual(["Italy::Serie A", "England::Championship"]);
    expect(favouriteScopeStub("Italy::Serie A").label).toBe("ITALY - Serie A");
  });

  it("keeps a named pin header when that day has no rows", () => {
    expect(
      tapeGroupsWithScopeHeaders([], {
        scopeFilter: "Spain::La Liga",
        favouritesOnly: false,
        favouriteIds: [],
        stub: favouriteScopeStub,
      }).map((row) => row.id)
    ).toEqual(["Spain::La Liga"]);
  });

  it("keeps every pin header in Pinned only when cards are missing", () => {
    expect(
      tapeGroupsWithScopeHeaders([{ id: "England::Championship" }], {
        scopeFilter: "all",
        favouritesOnly: true,
        favouriteIds: ["Italy::Serie A", "England::Championship"],
        stub: favouriteScopeStub,
      }).map((row) => row.id)
    ).toEqual(["Italy::Serie A", "England::Championship"]);
  });

  it("orders Pinned-only tape groups by the saved pin order", () => {
    expect(
      sortGroupsByFavouriteOrder(
        [{ id: "b" }, { id: "a" }, { id: "c" }],
        ["c", "a"]
      ).map((row) => row.id)
    ).toEqual(["c", "a", "b"]);
  });

  it("orders favourites, then today's cards, then the catalog", () => {
    const rows = [
      { id: "zero-a", count: 0, label: "Alpha Cup" },
      { id: "today-b", count: 2, label: "Bravo League" },
      { id: "fav-c", count: 0, label: "Charlie Cup" },
      { id: "today-a", count: 1, label: "Alpha League" },
    ];
    expect(sortFootballScopeMenu(rows, ["fav-c"]).map((row) => row.id)).toEqual([
      "fav-c",
      "today-a",
      "today-b",
      "zero-a",
    ]);
  });

  it("does not reshuffle pins by today's match count", () => {
    const rows = [
      { id: "fav-b", count: 6, label: "Bravo" },
      { id: "fav-a", count: 0, label: "Alpha" },
    ];
    expect(sortFootballScopeMenu(rows, ["fav-a", "fav-b"]).map((row) => row.id)).toEqual([
      "fav-a",
      "fav-b",
    ]);
  });

  it("pages a long menu and keeps pinned rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }));
    const page = takeScopeMenuPage(rows, 3, new Set(["n8"]));
    expect(page.shown.map((row) => row.id)).toEqual(["n0", "n1", "n8"]);
    expect(page.hidden).toBe(7);
  });

  it("partitions hidden scope rows", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(partitionHiddenScopeOptions(rows, new Set(["b"]))).toEqual({
      visible: [{ id: "a" }, { id: "c" }],
      hidden: [{ id: "b" }],
    });
  });
});

describe("collapsed scope counts", () => {
  it("names live and counts the rest", () => {
    expect(
      countFixtureStatuses([
        { status: "live" },
        { status: "live" },
        { status: "upcoming" },
        { status: "finished" },
      ])
    ).toEqual({ live: 2, scheduled: 1, finished: 1 });
    expect(
      collapsedScopeCountCopy({ live: 2, scheduled: 3, finished: 0 })
    ).toEqual({
      live: "2 Live",
      rest: "3",
      aria: "2 live, 3 scheduled",
    });
    expect(
      collapsedScopeCountCopy({ live: 0, scheduled: 5, finished: 0 })
    ).toEqual({ live: null, rest: "5", aria: "5 scheduled" });
    expect(
      collapsedScopeCountCopy({ live: 2, scheduled: 0, finished: 0 })
    ).toEqual({ live: "2 Live", rest: null, aria: "2 live" });
  });
});
