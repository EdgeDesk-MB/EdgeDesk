import { describe, expect, it } from "vitest";
import {
  displayFootballCompetitionName,
  filterScopeOptions,
  fixtureMatchesFootballScope,
  footballCompetitionDisplayTitle,
  footballScopeId,
  footballScopeLabel,
  groupFootballByLeague,
  normalizeFavouriteScopeIds,
  partitionHiddenScopeOptions,
  sortFavouriteScopeIdsFirst,
  toggleFavouriteScopeId,
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
  it("leaves England and unique names bare", () => {
    expect(footballScopeLabel("Premier League", "England", true)).toBe("Premier League");
    expect(footballScopeLabel("La Liga", "Spain", false)).toBe("La Liga");
  });

  it("adds the country when the name is shared", () => {
    expect(footballScopeLabel("Premier League", "Hong Kong", true)).toBe(
      "Premier League (Hong Kong)"
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
    expect(footballScopeLabel("Division", "Belarus", false)).toBe("Division");
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
      "Premier League",
      "Premier League (Hong Kong)",
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
      "2. Bundesliga",
      "Bundesliga",
      "Frauen Bundesliga",
    ]);
  });

  it("adds country when stripped names collide across countries", () => {
    const groups = groupFootballByLeague([
      { competition: "1. Division", leagueCountry: "Belarus" },
      { competition: "2. Division", leagueCountry: "Norway" },
    ]);
    expect(groups.map((group) => group.label).sort()).toEqual([
      "Division (Belarus)",
      "Division (Norway)",
    ]);
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
      label: "Premier League (Hong Kong)",
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
    const hits = filterScopeOptions(options, "premier league (hong kong)", "England");
    expect(hits.map((option) => option.id)).toEqual(["hk"]);
  });

  it("uses prefix when the query is not an exact name", () => {
    const hits = filterScopeOptions(options, "premier league 2", "England");
    expect(hits.map((option) => option.id)).toEqual(["pl2"]);
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

  it("keeps favourite rows first without reordering the rest", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(sortFavouriteScopeIdsFirst(rows, new Set(["c", "a"])).map((row) => row.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("partitions hidden scope rows", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(partitionHiddenScopeOptions(rows, new Set(["b"]))).toEqual({
      visible: [{ id: "a" }, { id: "c" }],
      hidden: [{ id: "b" }],
    });
  });
});
