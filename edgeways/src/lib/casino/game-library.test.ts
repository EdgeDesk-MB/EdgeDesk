import { describe, expect, it } from "vitest";
import { SEED_GAMES, matchGamesInText, bestGame, type CasinoGame } from "./game-library";

function game(name: string, rtp: number, id = 0): CasinoGame {
  return { id, name, provider: null, rtp, source: "user", updatedAt: 0 };
}

describe("SEED_GAMES", () => {
  it("has unique names and sane RTP fractions", () => {
    const names = SEED_GAMES.map((g) => g.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const g of SEED_GAMES) {
      expect(g.rtp).toBeGreaterThan(0.8);
      expect(g.rtp).toBeLessThan(1);
    }
  });
});

describe("matchGamesInText", () => {
  const library = [
    game("Fishin' Frenzy", 0.9612, 1),
    game("Fishin' Frenzy The Big Match", 0.951, 2),
    game("Fishin' Frenzy Lure 'Em In", 0.951, 3),
    game("Starburst", 0.9609, 4),
    game("Blood Suckers", 0.98, 5),
  ];

  it("finds games listed in pasted promo text", () => {
    const hits = matchGamesInText(
      "Eligible Games: Fishin' Frenzy The Big Match, Starburst, The Goonies",
      library
    );
    expect(hits.map((g) => g.name).sort()).toEqual([
      "Fishin' Frenzy The Big Match",
      "Starburst",
    ]);
  });

  it("does not credit the shorter name when only the longer variant appears", () => {
    const hits = matchGamesInText("Play Fishin' Frenzy The Big Match today", library);
    expect(hits.map((g) => g.name)).toEqual(["Fishin' Frenzy The Big Match"]);
  });

  it("matches the base game when it appears on its own", () => {
    const hits = matchGamesInText(
      "Fishin' Frenzy and Fishin' Frenzy Lure 'Em In are eligible",
      library
    );
    expect(hits.map((g) => g.name).sort()).toEqual([
      "Fishin' Frenzy",
      "Fishin' Frenzy Lure 'Em In",
    ]);
  });

  it("is apostrophe- and case-insensitive (OCR uses straight quotes)", () => {
    const hits = matchGamesInText("FISHIN' FRENZY LURE 'EM IN", library);
    expect(hits.map((g) => g.name)).toEqual(["Fishin' Frenzy Lure 'Em In"]);
  });

  it("empty text or library → no matches", () => {
    expect(matchGamesInText("", library)).toEqual([]);
    expect(matchGamesInText("Starburst", [])).toEqual([]);
  });
});

describe("bestGame", () => {
  it("picks the highest RTP", () => {
    const best = bestGame([game("A", 0.94), game("B", 0.98), game("C", 0.96)]);
    expect(best?.name).toBe("B");
  });

  it("null on empty", () => {
    expect(bestGame([])).toBeNull();
  });
});
