import { describe, expect, it } from "vitest";
import {
  filterScopeOptions,
  fixtureMatchesFootballScope,
  footballScopeId,
  footballScopeLabel,
  groupFootballByLeague,
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
