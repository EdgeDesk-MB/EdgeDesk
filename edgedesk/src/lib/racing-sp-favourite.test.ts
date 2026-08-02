import { describe, expect, it } from "vitest";
import {
  spFavouriteHorses,
  winnerIsSpFavourite,
  withWinnerMarkedSpFavourite,
  type RaceResult,
} from "./racing";

function race(partial: Partial<RaceResult> & Pick<RaceResult, "winner" | "runners">): RaceResult {
  return {
    kind: "horse_racing",
    fieldSize: partial.runners.length,
    ...partial,
  };
}

describe("spFavouriteHorses", () => {
  it("derives joint favourites from the shortest SP", () => {
    const result = race({
      winner: "Alpha",
      runners: [
        { horse: "Alpha", position: 1, spDecimal: 3.5 },
        { horse: "Bravo", position: 2, spDecimal: 3.5 },
        { horse: "Charlie", position: 3, spDecimal: 8 },
      ],
    });
    expect(spFavouriteHorses(result).sort()).toEqual(["Alpha", "Bravo"]);
    expect(winnerIsSpFavourite(result)).toBe(true);
  });

  it("prefers explicit Fav marks over SP decimals", () => {
    const result = race({
      winner: "Longshot",
      runners: [
        { horse: "Shortie", position: 2, spDecimal: 2.0 },
        { horse: "Longshot", position: 1, spDecimal: 12, isSpFavourite: true },
      ],
    });
    expect(spFavouriteHorses(result)).toEqual(["Longshot"]);
    expect(winnerIsSpFavourite(result)).toBe(true);
  });

  it("returns null when SP favourite cannot be known", () => {
    const result = race({
      winner: "Alpha",
      runners: [
        { horse: "Alpha", position: 1 },
        { horse: "Bravo", position: 2 },
      ],
    });
    expect(spFavouriteHorses(result)).toEqual([]);
    expect(winnerIsSpFavourite(result)).toBeNull();
  });
});

describe("withWinnerMarkedSpFavourite", () => {
  it("marks the winner for manual settle without inventing SP prices", () => {
    const base = race({
      winner: "Alpha",
      runners: [
        { horse: "Alpha", position: 1 },
        { horse: "Bravo", position: 2 },
      ],
    });
    const marked = withWinnerMarkedSpFavourite(base, true);
    expect(winnerIsSpFavourite(marked)).toBe(true);
    expect(spFavouriteHorses(marked)).toEqual(["Alpha"]);
  });
});
