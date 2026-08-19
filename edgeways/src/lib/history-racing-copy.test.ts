import { describe, expect, it } from "vitest";
import type { RaceResult } from "@/lib/racing";
import {
  formatRacingResultCopy,
  racingResultCopyFromGoals,
} from "./history-racing-copy";

function race(partial: Partial<RaceResult> & Pick<RaceResult, "winner">): RaceResult {
  return {
    kind: "horse_racing",
    runners: [],
    fieldSize: 8,
    ...partial,
  };
}

describe("formatRacingResultCopy", () => {
  it("brackets positions and leaves horse names unemphasised", () => {
    expect(
      formatRacingResultCopy(
        race({
          winner: "Dark Moon Rising",
          runners: [
            { horse: "Dark Moon Rising", position: 1 },
            { horse: "Kahin", position: 2 },
            { horse: "Other", position: 3 },
          ],
        })
      )
    ).toEqual({
      label: "Result",
      parts: [
        { text: "[1st] Dark Moon Rising" },
        { text: " · " },
        { text: "[2nd] Kahin" },
        { text: " · " },
        { text: "[3rd] Other" },
      ],
    });
  });

  it("keeps a winner-only result as 1st", () => {
    expect(
      formatRacingResultCopy(
        race({
          winner: "Dark Moon Rising",
          runners: [{ horse: "Dark Moon Rising", position: 1 }],
        })
      )
    ).toEqual({
      label: "Result",
      parts: [{ text: "[1st] Dark Moon Rising" }],
    });
  });
});

describe("racingResultCopyFromGoals", () => {
  it("rebuilds a winner from legacy History detail when goals are missing", () => {
    expect(
      racingResultCopyFromGoals(null, "York · 16:30 - won by Dark Moon Rising")
    ).toEqual({
      label: "Result",
      parts: [{ text: "[1st] Dark Moon Rising" }],
    });
  });
});
