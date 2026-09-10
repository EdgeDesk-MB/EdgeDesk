import { describe, expect, it } from "vitest";
import {
  repairCollapsedFootballFixtureLabel,
  syncFootballBetLabelOnSelectionChange,
} from "./football-bet-label";

describe("syncFootballBetLabelOnSelectionChange", () => {
  it("rewrites the old club when the pick moves", () => {
    expect(
      syncFootballBetLabelOnSelectionChange(
        "2UP Sporting CP @ 2.10",
        "home",
        "away",
        "Sporting CP",
        "Galatasaray"
      )
    ).toBe("2UP Galatasaray @ 2.10");
  });

  it("rewrites a stored team-name selection", () => {
    expect(
      syncFootballBetLabelOnSelectionChange(
        "Sporting CP",
        "Sporting CP",
        "Galatasaray",
        "Sporting CP",
        "Galatasaray"
      )
    ).toBe("Galatasaray");
  });

  it("leaves a fixture title that names both clubs", () => {
    expect(
      syncFootballBetLabelOnSelectionChange(
        "Sporting CP v Galatasaray",
        "home",
        "away",
        "Sporting CP",
        "Galatasaray"
      )
    ).toBe("Sporting CP v Galatasaray");
  });

  it("leaves a fixture title when teams are not filled yet", () => {
    expect(
      syncFootballBetLabelOnSelectionChange(
        "Chelsea v Leeds",
        "Chelsea",
        "Leeds",
        "",
        ""
      )
    ).toBe("Chelsea v Leeds");
  });

  it("leaves the title when the old club is not in it", () => {
    expect(
      syncFootballBetLabelOnSelectionChange(
        "Champions League qualifier",
        "home",
        "away",
        "Sporting CP",
        "Galatasaray"
      )
    ).toBe("Champions League qualifier");
  });
});

describe("repairCollapsedFootballFixtureLabel", () => {
  it("restores a same-club fixture title from the linked event", () => {
    expect(repairCollapsedFootballFixtureLabel("Leeds v Leeds", "Chelsea", "Leeds")).toBe(
      "Chelsea v Leeds"
    );
  });

  it("leaves a real two-club title alone", () => {
    expect(
      repairCollapsedFootballFixtureLabel("Chelsea v Leeds", "Chelsea", "Leeds")
    ).toBe("Chelsea v Leeds");
  });
});
