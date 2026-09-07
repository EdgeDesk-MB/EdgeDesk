import { describe, expect, it } from "vitest";
import { withRacingCardResult } from "./racing-card-result";
import type { RaceResult } from "@/lib/racing";

const result: RaceResult = {
  kind: "horse_racing",
  winner: "River Wharfe",
  fieldSize: 2,
  runners: [
    { horse: "River Wharfe", position: 1, spLabel: "6/4 Fav" },
    { horse: "Second", position: 2, spDecimal: 4.5 },
  ],
};

describe("withRacingCardResult", () => {
  it("leaves a card untouched when there is no result", () => {
    const card = { externalId: "r1", raceName: "Novice" };
    expect(withRacingCardResult(card, undefined)).toBe(card);
  });

  it("marks the card finished and keeps placings", () => {
    const next = withRacingCardResult({ externalId: "r1" }, result);
    expect(next.status).toBe("finished");
    expect(next.winner).toBe("River Wharfe");
    expect(next.result?.runners.map((r) => r.horse)).toEqual([
      "River Wharfe",
      "Second",
    ]);
  });
});
