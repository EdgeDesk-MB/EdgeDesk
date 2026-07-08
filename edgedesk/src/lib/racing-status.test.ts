import { describe, expect, it } from "vitest";
import {
  parseRacecardRunners,
  racingEventStatusDetail,
  serializeRacecardRunners,
  serializeRaceResults,
} from "@/lib/racing";

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
