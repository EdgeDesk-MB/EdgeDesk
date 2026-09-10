import { describe, expect, it } from "vitest";
import {
  twoupBttsRead,
  twoupFailIn,
  twoupFavRead,
  twoupLeanStory,
  twoupOpenness,
  twoupOver25Read,
  twoupScoutKey,
  twoupHasEdgePick,
  twoupIsEdgePick,
  twoupSideTierFromPct,
} from "./twoup-openness";

describe("twoupScoutKey", () => {
  it("normalises team names", () => {
    expect(
      twoupScoutKey({ homeTeam: " Arsenal ", awayTeam: "Chelsea", startTime: 1 })
    ).toBe(twoupScoutKey({ homeTeam: "arsenal", awayTeam: "chelsea", startTime: 1 }));
  });
});

describe("twoupOpenness", () => {
  it("is unknown when Over 2.5 and BTTS are both missing", () => {
    const result = twoupOpenness({
      homeBack: 1.95,
      awayBack: 4.2,
      computeWindfall: false,
    });
    expect(result.tier).toBe("unknown");
    expect(result.score01).toBe(0);
    expect(result.reasons).toEqual([]);
    expect(result.windfallHomePct).toBeUndefined();
  });

  it("still exposes per-side windfall when Over 2.5 and BTTS are missing", () => {
    const result = twoupOpenness({
      homeBack: 1.95,
      awayBack: 4.2,
      windfallHome: 0.03,
      windfallAway: 0.02,
      computeWindfall: false,
    });
    expect(result.tier).toBe("unknown");
    expect(result.windfallHomePct).toBe(3);
    expect(result.windfallAwayPct).toBe(2);
    expect(result.pick).toBe("home");
  });

  it("marks a playbook-strong profile", () => {
    const result = twoupOpenness({
      over25Back: 1.38,
      bttsYesBack: 1.42,
      homeBack: 1.95,
      awayBack: 4.0,
      computeWindfall: false,
    });
    expect(result.tier).toBe("strong");
    expect(result.score01).toBeGreaterThanOrEqual(0.72);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["O2.5 1.38", "BTTS 1.42", "fav 1.95"])
    );
  });

  it("is ok in the good-but-not-ideal band", () => {
    const result = twoupOpenness({
      over25Back: 1.58,
      bttsYesBack: 1.62,
      homeBack: 2.0,
      awayBack: 3.8,
      computeWindfall: false,
    });
    expect(result.tier).toBe("ok");
    expect(result.score01).toBeGreaterThanOrEqual(0.48);
    expect(result.score01).toBeLessThan(0.72);
  });

  it("skips low-scoring Over 2.5 / BTTS", () => {
    const result = twoupOpenness({
      over25Back: 1.95,
      bttsYesBack: 1.9,
      homeBack: 2.0,
      awayBack: 3.8,
      computeWindfall: false,
    });
    expect(result.tier).toBe("skip");
    expect(result.score01).toBeLessThanOrEqual(0.18);
    expect(result.reasons).toEqual(expect.arrayContaining(["low scoring", "BTTS long"]));
  });

  it("skips a blowout favourite", () => {
    const result = twoupOpenness({
      over25Back: 1.35,
      bttsYesBack: 1.4,
      homeBack: 1.28,
      awayBack: 11,
      computeWindfall: false,
    });
    expect(result.tier).toBe("skip");
    expect(result.reasons).toContain("blowout favourite");
  });

  it("skips a favourite that is too long", () => {
    const result = twoupOpenness({
      over25Back: 1.4,
      bttsYesBack: 1.45,
      homeBack: 2.8,
      awayBack: 2.75,
      computeWindfall: false,
    });
    expect(result.tier).toBe("skip");
    expect(result.reasons).toContain("favourite too long");
  });

  it("bumps when both sides score and concede above the league average", () => {
    const closed = twoupOpenness({
      over25Back: 1.48,
      bttsYesBack: 1.52,
      homeBack: 2.05,
      computeWindfall: false,
    });
    const open = twoupOpenness({
      over25Back: 1.48,
      bttsYesBack: 1.52,
      homeBack: 2.05,
      homeGf: 1.8,
      homeGa: 1.6,
      awayGf: 1.5,
      awayGa: 1.7,
      leagueAvgGf: 1.4,
      leagueAvgGa: 1.4,
      computeWindfall: false,
    });
    expect(open.score01).toBeGreaterThan(closed.score01);
    expect(open.reasons).toContain("both score and concede");
  });

  it("cuts a sterile attack or brick-wall defence", () => {
    const open = twoupOpenness({
      over25Back: 1.48,
      bttsYesBack: 1.52,
      homeBack: 2.05,
      homeGf: 1.8,
      homeGa: 1.6,
      awayGf: 1.5,
      awayGa: 1.7,
      leagueAvgGf: 1.4,
      leagueAvgGa: 1.4,
      computeWindfall: false,
    });
    const cut = twoupOpenness({
      over25Back: 1.48,
      bttsYesBack: 1.52,
      homeBack: 2.05,
      homeGf: 0.8,
      homeGa: 0.7,
      awayGf: 1.5,
      awayGa: 1.7,
      leagueAvgGf: 1.4,
      leagueAvgGa: 1.4,
      computeWindfall: false,
    });
    expect(cut.score01).toBeLessThan(open.score01);
    expect(cut.reasons).toContain("one side sterile or tight");
  });

  it("leans away when away G is larger", () => {
    const result = twoupOpenness({
      over25Back: 1.4,
      bttsYesBack: 1.45,
      homeBack: 2.1,
      awayBack: 3.4,
      windfallHome: 0.02,
      windfallAway: 0.07,
      computeWindfall: false,
    });
    expect(result.pick).toBe("away");
    expect(result.windfallAwayPct).toBe(7);
    expect(result.reasons).toContain("lean away");
  });

  it("uses a supplied windfall mass as a percent", () => {
    const result = twoupOpenness({
      over25Back: 1.4,
      bttsYesBack: 1.45,
      homeBack: 2.0,
      windfallHome: 0.086,
      windfallAway: 0.041,
      computeWindfall: false,
    });
    expect(result.windfallPct).toBe(9);
    expect(result.windfallHomePct).toBe(9);
    expect(result.windfallAwayPct).toBe(4);
    expect(result.pick).toBe("home");
    expect(result.reasons).toContain("lean home");
    expect(result.markets.over25).toBe(1.4);
  });

  it("turns two-up over windfall into a 1-in-N rate", () => {
    expect(twoupFailIn(23, 3)).toBe(8);
    expect(twoupFailIn(58, 2)).toBe(29);
  });

  it("explains why the underdog is the 2UP take", () => {
    const story = twoupLeanStory({
      homeTeam: "AEK Athens FC",
      awayTeam: "Lask Linz",
      pick: "away",
      ftaHomePct: 2,
      ftaAwayPct: 3,
      twoUpHomePct: 58,
      twoUpAwayPct: 23,
    });
    expect(story?.takeLine).toBe("Take 2UP on Lask Linz");
    expect(story?.takeFailIn).toBe(8);
    expect(story?.otherFailIn).toBe(29);
    expect(story?.windfallLine).toContain("bookie pays you as a winner");
    expect(story?.windfallLine).toContain("lay still wins");
    expect(story?.contrastLine).toContain("AEK Athens FC go two ahead far more often");
    expect(story?.contrastLine).toContain("1 time in 8");
    expect(story?.contrastLine).toContain("1 time in 29");
  });

  it("reads match-shape prices with the scout cutoffs", () => {
    expect(twoupOver25Read(1.4)).toBe("open");
    expect(twoupOver25Read(1.65)).toBe("mixed");
    expect(twoupOver25Read(2.1)).toBe("closed");
    expect(twoupBttsRead(1.5)).toBe("open");
    expect(twoupBttsRead(1.85)).toBe("closed");
    expect(twoupFavRead(2.18)).toBe("open");
    expect(twoupFavRead(1.4)).toBe("closed");
    expect(twoupFavRead(2.8)).toBe("closed");
  });

  it("bands a side windfall percent into ticks", () => {
    expect(twoupSideTierFromPct(undefined)).toBe("unknown");
    expect(twoupSideTierFromPct(0)).toBe("unknown");
    expect(twoupSideTierFromPct(1)).toBe("skip");
    expect(twoupSideTierFromPct(2)).toBe("thin");
    expect(twoupSideTierFromPct(3)).toBe("ok");
    expect(twoupSideTierFromPct(4)).toBe("strong");
    expect(twoupSideTierFromPct(7)).toBe("strong");
  });

  it("treats Fair and Strong takes as Edge picks", () => {
    expect(twoupIsEdgePick("skip")).toBe(false);
    expect(twoupIsEdgePick("thin")).toBe(false);
    expect(twoupIsEdgePick("ok")).toBe(true);
    expect(twoupIsEdgePick("strong")).toBe(true);
    expect(
      twoupHasEdgePick({
        tier: "skip",
        score01: 0,
        reasons: [],
        markets: {},
        pick: "away",
        windfallHomePct: 2,
        windfallAwayPct: 3,
      })
    ).toBe(true);
    expect(
      twoupHasEdgePick({
        tier: "skip",
        score01: 0,
        reasons: [],
        markets: {},
        pick: "home",
        windfallHomePct: 2,
        windfallAwayPct: 1,
      })
    ).toBe(false);
  });

  it("fits Dixon-Coles G from exchange 1X2 plus O2.5 and BTTS", () => {
    const result = twoupOpenness({
      homeBack: 3.2,
      drawBack: 3.15,
      awayBack: 2.65,
      over25Back: 2.65,
      bttsYesBack: 2.05,
    });
    expect(result.tier).toBe("skip");
    expect(result.windfallPct).toBeGreaterThan(0);
    expect(result.windfallPct).toBeLessThan(25);
    expect(result.twoUpHomePct).toBeGreaterThan(result.windfallHomePct ?? 0);
    expect(result.twoUpAwayPct).toBeGreaterThan(result.windfallAwayPct ?? 0);
  });
});
