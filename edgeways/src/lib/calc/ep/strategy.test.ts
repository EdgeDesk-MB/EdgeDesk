import { describe, expect, it } from "vitest";
import {
  dutchDist,
  dutchDistMixed,
  epProbsW,
  equalizedStakes,
  fitModel,
  scenariosW,
  scoreGrid,
  stripMargin,
} from "./engine";
import { dutchVsLayNote, generousOfferNote, rankEpStructures } from "./strategy";

const gridFn = (lh: number, la: number, rho: number) => {
  const g = scoreGrid(lh, la, rho, 12);
  return (nh: number, na: number) => g[nh]?.[na] ?? 0;
};

describe("dutchDistMixed", () => {
  it("matches dutchDist when thresholds are equal", () => {
    const { probs } = stripMargin([3.2, 3.15, 2.65]);
    const fit = fitModel(probs[0], probs[1], probs[2], 1 / 2.65, 1 / 2.05);
    const wfn = gridFn(fit.lh, fit.la, fit.rho);
    const scen = scenariosW(wfn);
    const stakes = equalizedStakes(3.0, 2.5, 3.15, "total", 100);
    const same = dutchDist(scen, 3.0, 2.5, 3.15, stakes.SH, stakes.SA, stakes.SD, 2);
    const mixed = dutchDistMixed(
      scen,
      3.0,
      2.5,
      3.15,
      stakes.SH,
      stakes.SA,
      stakes.SD,
      2,
      2
    );
    expect(mixed.EV).toBeCloseTo(same.EV, 9);
  });

  it("outsider 1UP mixed can beat pure 2UP when dog rarely leads by 2", () => {
    // Heavy favourite home - away 2UP trigger is rare; 1UP on away is more realistic
    const { probs } = stripMargin([1.5, 4.2, 7.0]);
    const fit = fitModel(probs[0], probs[1], probs[2]);
    const wfn = gridFn(fit.lh, fit.la, fit.rho);
    const ep = epProbsW(wfn);
    const scen = scenariosW(wfn);

    // Soft-ish home 2UP, tighter away 2UP, softer away 1UP
    const oH2 = 1.55;
    const oA2 = 8.0;
    const oA1 = 4.5;
    const oD = 4.2;
    const s22 = equalizedStakes(oH2, oA2, oD, "total", 100);
    const s21 = equalizedStakes(oH2, oA1, oD, "total", 100);
    const pure = dutchDist(scen, oH2, oA2, oD, s22.SH, s22.SA, s22.SD, 2);
    const mixed = dutchDistMixed(scen, oH2, oA1, oD, s21.SH, s21.SA, s21.SD, 2, 1);

    // Away 1UP probability should materially exceed away 2UP
    expect(ep.pA1).toBeGreaterThan(ep.pA2 + 0.05);
    // Mixed is not always better on EV (price-dependent) - but it must be a distinct structure
    expect(mixed.EV).not.toBeCloseTo(pure.EV, 2);
  });
});

describe("rankEpStructures", () => {
  it("returns dutch and lay candidates sorted by EV", () => {
    const { probs } = stripMargin([3.2, 3.15, 2.65]);
    const fit = fitModel(probs[0], probs[1], probs[2], 1 / 2.65, 1 / 2.05);
    const wfn = gridFn(fit.lh, fit.la, fit.rho);
    const ranked = rankEpStructures({
      scen: scenariosW(wfn),
      ep: epProbsW(wfn),
      oH2: 3.0,
      oA2: 2.5,
      oH1: 1.9,
      oA1: 1.7,
      oDraw: 3.15,
      oLayH: 3.25,
      oLayA: 3.2,
      commission: 0,
      stakeMode: "total",
      stakeAmt: 100,
      rounding: 0.01,
      homeName: "Mexico",
      awayName: "England",
    });
    expect(ranked.length).toBeGreaterThan(4);
    expect(ranked[0]!.ev).toBeGreaterThanOrEqual(ranked[1]!.ev);
    const kinds = new Set(ranked.map((r) => r.kind));
    expect(kinds.has("dutch_2_2")).toBe(true);
    expect(kinds.has("dutch_2_1")).toBe(true);
    expect(kinds.has("lay_2_both")).toBe(true);

    const dutch = ranked.find((r) => r.kind === "dutch_2_2");
    const lay = ranked.find((r) => r.kind === "lay_2_both");
    const note = dutchVsLayNote(dutch, lay);
    expect(note).toBeTruthy();
  });

  it("omits 1UP dutch and lay when include1Up is off", () => {
    const { probs } = stripMargin([3.2, 3.15, 2.65]);
    const fit = fitModel(probs[0], probs[1], probs[2], 1 / 2.65, 1 / 2.05);
    const wfn = gridFn(fit.lh, fit.la, fit.rho);
    const ranked = rankEpStructures({
      scen: scenariosW(wfn),
      ep: epProbsW(wfn),
      oH2: 3.0,
      oA2: 2.5,
      oH1: 1.9,
      oA1: 1.7,
      oDraw: 3.15,
      oLayH: 3.25,
      oLayA: 3.2,
      commission: 0,
      stakeMode: "total",
      stakeAmt: 100,
      rounding: 0.01,
      include1Up: false,
    });
    const kinds = ranked.map((r) => r.kind);
    expect(kinds).toContain("dutch_2_2");
    expect(kinds).toContain("lay_2_both");
    expect(kinds).toContain("lay_home_2");
    expect(kinds).toContain("lay_away_2");
    expect(kinds.some((k) => k.includes("_1"))).toBe(false);
  });

  it("explains generous single offer vs covered dutch", () => {
    const note = generousOfferNote(
      {
        key: "A2",
        label: "Away · 2UP",
        book: "PubCasino",
        odds: 7,
        edge: 0.067,
        fair: 6.56,
      },
      {
        kind: "dutch_2_1",
        label: "Dutch 2UP/1UP",
        rationale: "test",
        ev: 0.82,
        evPer1: 0.008,
        outlay: 100,
        sd: 30,
        pProfit: 0.2,
        worst: -14,
        best: 150,
      },
      100
    );
    expect(note).toContain("generous");
    expect(note).toContain("Equalised dutch");
  });
});
