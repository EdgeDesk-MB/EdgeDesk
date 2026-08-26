import { describe, expect, it } from "vitest";
import { serializeRaceResults } from "@/lib/racing";
import {
  formatAlertRacePosition,
  settlementEventResultLabel,
} from "./settlement-result";

describe("formatAlertRacePosition", () => {
  it("formats 1st without using Won", () => {
    expect(formatAlertRacePosition(1)).toBe("Finished 1st");
  });

  it("formats other places", () => {
    expect(formatAlertRacePosition(2)).toBe("Finished 2nd");
    expect(formatAlertRacePosition(4)).toBe("Finished 4th");
  });

  it("returns null for unknown", () => {
    expect(formatAlertRacePosition(0)).toBeNull();
  });
});

describe("settlementEventResultLabel", () => {
  it("returns finishing position for a racing selection", () => {
    const goals = serializeRaceResults({
      winner: "Malbay Madness (IRE)",
      runners: [
        { horse: "Malbay Madness (IRE)", position: 1 },
        { horse: "Trasna Na Pairce (IRE)", position: 4 },
      ],
      fieldSize: 2,
    });
    expect(
      settlementEventResultLabel({
        selection: "Trasna Na Pairce",
        sport: "horse_racing",
        event: { sport: "horse_racing", status: "finished", goals },
      })
    ).toBe("Finished 4th");
  });

  it("returns FT score for football", () => {
    expect(
      settlementEventResultLabel({
        selection: "home",
        sport: "football",
        event: {
          sport: "football",
          status: "finished",
          homeScore: 2,
          awayScore: 1,
        },
      })
    ).toBe("2–1");
  });

  it("returns live score for early-payout style settles", () => {
    expect(
      settlementEventResultLabel({
        selection: "home",
        sport: "football",
        event: {
          sport: "football",
          status: "live",
          homeScore: 2,
          awayScore: 0,
        },
      })
    ).toBe("2–0");
  });

  it("returns null when the event or selection result is missing", () => {
    expect(
      settlementEventResultLabel({
        selection: "Unknown Horse",
        sport: "horse_racing",
        event: { sport: "horse_racing", status: "finished", goals: null },
      })
    ).toBeNull();
    expect(
      settlementEventResultLabel({
        selection: "home",
        event: null,
      })
    ).toBeNull();
  });
});
