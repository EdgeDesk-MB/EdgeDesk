import { describe, expect, it } from "vitest";
import {
  applyFixtureBoardRail,
  DEFAULT_FIXTURE_BOARD_VIEW,
  fixtureBoardRail,
  mergeFixtureBoardView,
  normalizeFixtureBoardView,
} from "./fixture-board-view";

describe("normalizeFixtureBoardView", () => {
  it("defaults an empty payload", () => {
    expect(normalizeFixtureBoardView(null)).toEqual(DEFAULT_FIXTURE_BOARD_VIEW);
  });

  it("keeps pinned-only, a competition rail, and Live", () => {
    expect(
      normalizeFixtureBoardView({
        sport: "horse_racing",
        football: { rail: "pins", status: "live" },
        racing: { rail: "Ascot", status: "scheduled" },
      })
    ).toEqual({
      sport: "horse_racing",
      football: { rail: "pins", status: "live" },
      racing: { rail: "Ascot", status: "scheduled" },
    });
  });

  it("drops the old Odds toggle from stored views", () => {
    expect(
      normalizeFixtureBoardView({
        football: { rail: "all", status: "all", odds: false },
      }).football
    ).toEqual({ rail: "all", status: "all" });
  });

  it("drops unknown status and the old favourites rail alias", () => {
    expect(
      normalizeFixtureBoardView({
        football: { rail: "favourites", status: "nope" as never },
      }).football
    ).toEqual({ rail: "all", status: "all" });
  });
});

describe("mergeFixtureBoardView", () => {
  it("patches one sport without clearing the other", () => {
    const current = normalizeFixtureBoardView({
      football: { rail: "pins", status: "picks" },
    });
    expect(
      mergeFixtureBoardView(current, {
        sport: "horse_racing",
        racing: { rail: "pins" },
      })
    ).toEqual({
      sport: "horse_racing",
      football: { rail: "pins", status: "picks" },
      racing: { rail: "pins", status: "all" },
    });
  });
});

describe("fixtureBoardRail", () => {
  it("round-trips pinned only and a named scope", () => {
    expect(fixtureBoardRail(true, "England::Premier League")).toBe("pins");
    expect(applyFixtureBoardRail("pins")).toEqual({
      favouritesOnly: true,
      backedOnly: false,
      scopeFilter: "all",
    });
    expect(applyFixtureBoardRail("England::Premier League")).toEqual({
      favouritesOnly: false,
      backedOnly: false,
      scopeFilter: "England::Premier League",
    });
  });

  it("round-trips backed only", () => {
    expect(fixtureBoardRail(false, "all", true)).toBe("backed");
    expect(applyFixtureBoardRail("backed")).toEqual({
      favouritesOnly: false,
      backedOnly: true,
      scopeFilter: "all",
    });
  });
});
