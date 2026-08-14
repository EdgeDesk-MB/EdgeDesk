import { describe, expect, it } from "vitest";
import { serializeEligibleGames } from "./eligible-games";
import { inheritCasinoStepDefaults, type CasinoStepInheritSource } from "./inherit-step-defaults";

function row(overrides: Partial<CasinoStepInheritSource> = {}): CasinoStepInheritSource {
  return {
    amount: null,
    wageringMultiplier: null,
    rtp: null,
    contributionPct: null,
    spins: null,
    spinValue: null,
    chipCount: null,
    chipValue: null,
    cashbackPct: null,
    game: null,
    eligibleGamesJson: null,
    ...overrides,
  };
}

describe("inheritCasinoStepDefaults", () => {
  it("carries the widest game list, plus RTP and spin value from later siblings", () => {
    const games = serializeEligibleGames(["Starburst", "Blood Suckers"]);
    const d = inheritCasinoStepDefaults([
      row({
        amount: 25,
        rtp: 0.96,
        game: "Starburst",
        eligibleGamesJson: games,
      }),
      row({
        spins: 10,
        spinValue: 0.1,
        rtp: 0.9502,
        game: "Age of the Gods",
        eligibleGamesJson: serializeEligibleGames(["Age of the Gods"]),
      }),
    ]);
    expect(d.amount).toBe(25);
    expect(d.spins).toBe(10);
    expect(d.spinValue).toBeCloseTo(0.1, 10);
    expect(d.rtp).toBeCloseTo(0.9502, 10);
    expect(d.eligibleGameNames).toEqual(["Starburst", "Blood Suckers"]);
  });

  it("falls back to unique recommended game names when no list was stored", () => {
    const d = inheritCasinoStepDefaults([
      row({ game: "Starburst" }),
      row({ game: "Blood Suckers" }),
      row({ game: "Starburst" }),
    ]);
    expect(d.eligibleGameNames).toEqual(["Starburst", "Blood Suckers"]);
  });

  it("empty siblings → empty defaults", () => {
    const d = inheritCasinoStepDefaults([]);
    expect(d.amount).toBeNull();
    expect(d.spinValue).toBeNull();
    expect(d.eligibleGameNames).toEqual([]);
  });
});
