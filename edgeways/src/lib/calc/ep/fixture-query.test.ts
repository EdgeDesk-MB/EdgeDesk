import { describe, expect, it } from "vitest";
import {
  EP_DESK_PATH,
  TWOUP_DESK_PATH,
  epDeskFixtureHref,
  epDeskFixtureSearch,
  parseEpDeskFixtureQuery,
  parseEpDeskTab,
} from "./fixture-query";

describe("parseEpDeskFixtureQuery", () => {
  it("requires both teams", () => {
    expect(parseEpDeskFixtureQuery({ home: "Everton" })).toBeNull();
    expect(parseEpDeskFixtureQuery({ away: "Crystal Palace" })).toBeNull();
  });

  it("reads names, kick-off and tab", () => {
    expect(
      parseEpDeskFixtureQuery({
        home: " Everton ",
        away: "Crystal Palace",
        start: "1724328000000",
        tab: "dutch",
      })
    ).toEqual({
      home: "Everton",
      away: "Crystal Palace",
      startTime: 1724328000000,
      tab: "dutch",
    });
  });

  it("drops a bad start and an unknown tab", () => {
    expect(
      parseEpDeskFixtureQuery({
        home: "Everton",
        away: "Crystal Palace",
        start: "nope",
        tab: "mystery",
      })
    ).toEqual({
      home: "Everton",
      away: "Crystal Palace",
      startTime: undefined,
      tab: "dutch",
    });
  });

  it("decodes the same values URLSearchParams emits", () => {
    const search = epDeskFixtureSearch({
      home: "Brighton & Hove Albion",
      away: "Atlético Madrid",
      startTime: 1724328000000,
    });
    const params = new URLSearchParams(search);
    expect(parseEpDeskFixtureQuery({
      home: params.get("home"),
      away: params.get("away"),
      start: params.get("start"),
      tab: params.get("tab"),
    })).toEqual({
      home: "Brighton & Hove Albion",
      away: "Atlético Madrid",
      startTime: 1724328000000,
      tab: "dutch",
    });
  });
});

describe("epDeskFixtureHref", () => {
  it("builds a handoff URL onto /early-payout", () => {
    expect(EP_DESK_PATH).toBe("/early-payout");
    expect(TWOUP_DESK_PATH).toBe("/early-payout");
    expect(
      epDeskFixtureHref({
        home: "Everton",
        away: "Crystal Palace",
        startTime: 1724328000000,
        tab: "dutch",
      })
    ).toBe(`${TWOUP_DESK_PATH}?home=Everton&away=Crystal+Palace&tab=dutch&start=1724328000000`);
    expect(parseEpDeskTab("live")).toBe("live");
  });
});
