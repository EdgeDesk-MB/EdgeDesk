import { describe, expect, it } from "vitest";
import {
  buildRaceResultDialogHeader,
  formatPositionOrdinal,
  parseRaceDisplayMeta,
  parseRacecardRunners,
  racingEventStatusDetail,
  serializeRacecardRunners,
  serializeRaceResults,
  withPreservedRaceDisplayMeta,
} from "@/lib/racing";

describe("formatPositionOrdinal", () => {
  it("formats common finishing places", () => {
    expect(formatPositionOrdinal(1)).toBe("1st");
    expect(formatPositionOrdinal(2)).toBe("2nd");
    expect(formatPositionOrdinal(3)).toBe("3rd");
    expect(formatPositionOrdinal(4)).toBe("4th");
    expect(formatPositionOrdinal(11)).toBe("11th");
    expect(formatPositionOrdinal(21)).toBe("21st");
  });

  it("returns null for unplaced", () => {
    expect(formatPositionOrdinal(0)).toBeNull();
  });
});

describe("racingEventStatusDetail", () => {
  it("shows awaiting result when no card or result", () => {
    expect(racingEventStatusDetail(null)).toBe("Awaiting result");
  });

  it("includes runner count from pending racecard", () => {
    const goals = serializeRacecardRunners(["Alpha", "Beta", "Gamma"]);
    expect(parseRacecardRunners(goals)).toHaveLength(3);
    expect(racingEventStatusDetail(goals)).toBe("3 runners · awaiting result");
  });

  it("shows winner when result is stored", () => {
    const goals = serializeRaceResults({
      winner: "Fast Horse",
      runners: [{ horse: "Fast Horse", position: 1 }],
      fieldSize: 8,
    });
    expect(racingEventStatusDetail(goals)).toBe("Won by Fast Horse");
  });
});

describe("race result dialog header", () => {
  it("builds course title, start, and meta without exchange lays", () => {
    const goals = serializeRacecardRunners(
      Array.from({ length: 18 }, (_, i) => `Horse ${i + 1}`),
      {
        type: "Hurdle",
        prize: "€10,500",
        going: "Good To Yielding",
        fieldSize: 18,
      }
    );
    const header = buildRaceResultDialogHeader({
      competition: "Galway",
      homeTeam: "Adare Manor Opportunity Handicap Hurdle",
      startTime: new Date(2026, 7, 2, 13, 50).getTime(),
      goals,
    });
    expect(header.title).toBe("Galway: Adare Manor Opportunity Handicap Hurdle");
    expect(header.startLabel).toMatch(/^02\/08,/);
    expect(header.metaParts).toEqual([
      "Hurdle",
      "Prize €10,500",
      "Going: Good To Yielding",
      "18 runners · 3 places",
    ]);
    expect(header.metaParts.join(" · ")).not.toMatch(/Betfair/i);
  });

  it("preserves card meta onto a finished result", () => {
    const card = serializeRacecardRunners(["A", "B", "C", "D", "E", "F", "G", "H"], {
      type: "Flat",
      prize: "£25,000",
      going: "Good",
      fieldSize: 8,
    });
    const merged = withPreservedRaceDisplayMeta(
      {
        winner: "A",
        runners: [{ horse: "A", position: 1 }],
        fieldSize: 1,
      },
      card
    );
    expect(parseRaceDisplayMeta(serializeRaceResults(merged))).toMatchObject({
      type: "Flat",
      prize: "£25,000",
      going: "Good",
      fieldSize: 8,
    });
  });
});
