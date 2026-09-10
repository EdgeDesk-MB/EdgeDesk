/**
 * Finished football names: one weight step up for the winner, one down
 * for the loser. Draws and anything not FT stay on the surface default.
 */

export type FixtureNameWeight = "lighter" | "base" | "bolder";

export function footballFinishedNameWeight(
  side: "home" | "away",
  input: {
    status?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
  }
): FixtureNameWeight {
  if (input.status !== "finished") return "base";
  const home = input.homeScore ?? 0;
  const away = input.awayScore ?? 0;
  if (home === away) return "base";
  const homeWon = home > away;
  if (side === "home") return homeWon ? "bolder" : "lighter";
  return homeWon ? "lighter" : "bolder";
}

/** Fixture tape names start at `font-medium`. */
export function fixtureTapeNameWeightClass(weight: FixtureNameWeight): string {
  if (weight === "bolder") return "font-semibold";
  if (weight === "lighter") return "font-normal";
  return "font-medium";
}

/** Match-events header names start at `font-semibold`. */
export function matchTapeNameWeightClass(weight: FixtureNameWeight): string {
  if (weight === "bolder") return "font-bold";
  if (weight === "lighter") return "font-medium";
  return "font-semibold";
}
