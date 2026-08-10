import { describe, expect, it } from "vitest";
import { serializeRaceResults } from "@/lib/racing";
import {
  deriveDeskLegAutoResult,
  toBinaryDeskResult,
} from "./leg-auto-result";

const raceBody = {
  winner: "Malbay Madness (IRE)",
  runners: [
    { horse: "Malbay Madness (IRE)", position: 1 },
    { horse: "Shinnhill (IRE)", position: 2 },
    { horse: "Chanceawetmorning (IRE)", position: 3 },
    { horse: "Trasna Na Pairce (IRE)", position: 4 },
    { horse: "Tribal Moon (IRE)", position: 5 },
  ],
  fieldSize: 7,
  type: "Hurdle",
};

describe("deriveDeskLegAutoResult — horse racing", () => {
  const finished = {
    sport: "horse_racing",
    status: "finished",
    goals: serializeRaceResults(raceBody),
  };

  it("win market: non-winner → lost (Trasna Na Pairce 4th)", () => {
    expect(
      deriveDeskLegAutoResult(
        {
          sport: "horse_racing",
          market: "win",
          selection: "Trasna Na Pairce",
        },
        finished
      )
    ).toBe("lost");
  });

  it("win market: winner matches with country suffix stripped", () => {
    expect(
      deriveDeskLegAutoResult(
        {
          sport: "horse_racing",
          market: "win",
          selection: "Malbay Madness",
        },
        finished
      )
    ).toBe("won");
  });

  it("place market: 2nd of 7 hurdle → won", () => {
    expect(
      deriveDeskLegAutoResult(
        {
          sport: "horse_racing",
          market: "place",
          selection: "Shinnhill",
        },
        finished
      )
    ).toBe("won");
  });

  it("each_way: placed but not win → placed", () => {
    expect(
      deriveDeskLegAutoResult(
        {
          sport: "horse_racing",
          market: "each_way",
          selection: "Shinnhill (IRE)",
        },
        finished
      )
    ).toBe("placed");
  });

  it("waits when place market has winner-only (incomplete) result", () => {
    const incomplete = {
      winner: "Malbay Madness (IRE)",
      runners: [{ horse: "Malbay Madness (IRE)", position: 1 }],
      fieldSize: 7,
    };
    expect(
      deriveDeskLegAutoResult(
        { sport: "horse_racing", market: "place", selection: "Shinnhill" },
        {
          sport: "horse_racing",
          status: "finished",
          goals: serializeRaceResults(incomplete),
        }
      )
    ).toBeNull();
  });
});

describe("deriveDeskLegAutoResult — football", () => {
  const finished = {
    sport: "football",
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    homeLed2: 0,
    awayLed2: 0,
  };

  it("match_odds home win", () => {
    expect(
      deriveDeskLegAutoResult(
        { market: "match_odds", selection: "home" },
        finished
      )
    ).toBe("won");
    expect(
      deriveDeskLegAutoResult(
        { market: "match_odds", selection: "away" },
        finished
      )
    ).toBe("lost");
  });

  it("btts and over/under from the same score", () => {
    expect(
      deriveDeskLegAutoResult({ market: "btts", selection: "yes" }, finished)
    ).toBe("won");
    expect(
      deriveDeskLegAutoResult(
        { market: "over_under_2_5", selection: "over" },
        finished
      )
    ).toBe("won");
  });

  it("draw_no_bet voids on draw", () => {
    expect(
      deriveDeskLegAutoResult(
        { market: "draw_no_bet", selection: "home" },
        { ...finished, homeScore: 1, awayScore: 1 }
      )
    ).toBe("void");
  });

  it("ignores unfinished events", () => {
    expect(
      deriveDeskLegAutoResult(
        { market: "match_odds", selection: "home" },
        { ...finished, status: "live" }
      )
    ).toBeNull();
  });
});

describe("toBinaryDeskResult", () => {
  it("maps placed → won for Acca/BB place markets", () => {
    expect(toBinaryDeskResult("placed")).toBe("won");
    expect(toBinaryDeskResult("lost")).toBe("lost");
  });
});
