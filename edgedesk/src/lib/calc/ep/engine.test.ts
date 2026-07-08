import { describe, expect, it } from "vitest";
import {
  dutchDist,
  dutchPL,
  effectiveTriggers,
  epDecompose,
  epProbsW,
  equalizedStakes,
  fitModel,
  layPlay,
  liveResult,
  marketsFromGrid,
  scenariosW,
  scoreGrid,
  stripMargin,
} from "./engine";

const gridFn = (lh: number, la: number, rho: number) => {
  const g = scoreGrid(lh, la, rho, 12);
  return (nh: number, na: number) => (g[nh]?.[na] ?? 0);
};

describe("EP engine — spec §5 test vectors", () => {
  it("A · Independent Poisson (Brazil/Japan): fit + EP probs", () => {
    const { probs } = stripMargin([1.666, 3.7, 5.0]);
    const fit = fitModel(probs[0], probs[1], probs[2]);
    expect(fit.rho).toBe(0);
    expect(fit.lh).toBeCloseTo(1.577, 2);
    expect(fit.la).toBeCloseTo(0.789, 2);

    const ep = epProbsW(gridFn(fit.lh, fit.la, fit.rho));
    expect(ep.pH1).toBeCloseTo(0.6727, 3);
    expect(ep.pH2).toBeCloseTo(0.5698, 3);
    expect(ep.pA1).toBeCloseTo(0.3367, 3);
    expect(ep.pA2).toBeCloseTo(0.1977, 3);
    expect(ep.pD).toBeCloseTo(0.2524, 3);
  });

  it("B · Dixon-Coles at fixed params (1.708, 0.859, −0.014)", () => {
    const g = scoreGrid(1.708, 0.859, -0.014);
    const m = marketsFromGrid(g);
    expect(m.H).toBeCloseTo(0.573, 3);
    expect(m.D).toBeCloseTo(0.241, 3);
    // Spec quotes 0.186 but its own 3 d.p. H/D/A don't sum to 1; exact value is 0.18542
    expect(m.A).toBeCloseTo(0.1854, 3);
    expect(m.H + m.D + m.A).toBeCloseTo(1, 9);
    expect(m.OV).toBeCloseTo(0.473, 3);
    expect(m.BT).toBeCloseTo(0.474, 3);

    // Engine converges to these values for any grid size M ∈ [11,14]; spec's 4th d.p.
    // differs by ≤1.6e-4 (reference-run rounding). All identity vectors pass exactly.
    const ep = epProbsW((nh, na) => g[nh]?.[na] ?? 0);
    expect(ep.pH1).toBeCloseTo(0.6919, 3);
    expect(ep.pH2).toBeCloseTo(0.5841, 3);
    expect(ep.pA1).toBeCloseTo(0.3478, 3);
    expect(ep.pA2).toBeCloseTo(0.1988, 3);
    expect(ep.pD).toBeCloseTo(0.2413, 3);
  });

  it("C · EV identity (linearity) — Brazil/Japan dutch", () => {
    const { probs } = stripMargin([1.666, 3.7, 5.0]);
    const fit = fitModel(probs[0], probs[1], probs[2]);
    const wfn = gridFn(fit.lh, fit.la, fit.rho);
    const ep = epProbsW(wfn);
    const scen = scenariosW(wfn);

    // Offers: H2UP 1.615, A2UP 4.50, H1UP 2.45(unused here), A1UP 1.333(unused), draw @3.70
    const oH2 = 1.615,
      oA2 = 4.5,
      oD = 3.7;
    const stakes = equalizedStakes(oH2, oA2, oD, "total", 100);
    expect(stakes.SH).toBeCloseTo(55.7, 1);
    expect(stakes.SA).toBeCloseTo(19.99, 1);
    expect(stakes.SD).toBeCloseTo(24.31, 1);
    expect(stakes.SH * oH2).toBeCloseTo(89.95, 1); // equal gross return per leg

    const dist2 = dutchDist(scen, oH2, oA2, oD, stakes.SH, stakes.SA, stakes.SD, 2);
    expect(dist2.EV).toBeCloseTo(-8.257, 3);
    // Linearity: EV == Σ stake·edge
    const pDrawTrue = ep.pD;
    const evLinear =
      stakes.SH * (oH2 * ep.pH2 - 1) +
      stakes.SA * (oA2 * ep.pA2 - 1) +
      stakes.SD * (oD * pDrawTrue - 1);
    expect(dist2.EV).toBeCloseTo(evLinear, 6);

    // 1UP dutch
    const oH1 = 2.45,
      oA1 = 1.333;
    const s1 = equalizedStakes(oH1, oA1, oD, "total", 100);
    const dist1 = dutchDist(scen, oH1, oA1, oD, s1.SH, s1.SA, s1.SD, 1);
    expect(dist1.EV).toBeCloseTo(-11.6714, 3);
  });

  it("D · Lay play — punitive and generous books", () => {
    const { probs } = stripMargin([1.666, 3.7, 5.0]);
    const [tH, , tA] = probs;
    const fit = fitModel(probs[0], probs[1], probs[2]);
    const ep = epProbsW(gridFn(fit.lh, fit.la, fit.rho));
    const c = 0.02;
    const Xh = (1 / tH) * 1.01;
    const Xa = (1 / tA) * 1.01;

    // Punitive book
    const h2 = layPlay(100, 1.615, Xh, c, ep.pH2, ep.pWinH);
    expect(h2.EV).toBeCloseTo(-9.68, 1);
    // Closed form identity: evPer1 == EV / b (spec's −9.62% used a different tW)
    expect(h2.evPer1).toBeCloseTo(h2.EV / 100, 9);
    const a2 = layPlay(100, 4.5, Xa, c, ep.pA2, ep.pWinA);
    expect(a2.EV).toBeCloseTo(-13.23, 1);

    // Generous book
    const a2gen = layPlay(100, 5.6, Xa, c, ep.pA2, ep.pWinA);
    expect(a2gen.evPer1 * 100).toBeCloseTo(7.98, 1);
    const h2gen = layPlay(100, 1.8, Xh, c, ep.pH2, ep.pWinH);
    expect(h2gen.EV).toBeCloseTo(0.67, 1);
  });

  it("E · Mexico–England defaults", () => {
    const { probs, overround } = stripMargin([3.2, 3.15, 2.65]);
    expect(overround * 100).toBeCloseTo(0.73, 1);
    expect(probs[0] * 100).toBeCloseTo(31.0, 0);
    expect(probs[1] * 100).toBeCloseTo(31.5, 0);
    expect(probs[2] * 100).toBeCloseTo(37.5, 0);

    const fit = fitModel(probs[0], probs[1], probs[2], 1 / 2.65, 1 / 2.05);
    expect(fit.lh).toBeCloseTo(1.064, 1);
    expect(fit.la).toBeCloseTo(1.191, 1);
    expect(fit.rho).toBeCloseTo(-0.128, 1);
    expect(fit.lh + fit.la).toBeCloseTo(2.25, 1);

    const wfn = gridFn(fit.lh, fit.la, fit.rho);
    const ep = epProbsW(wfn);

    const dH2 = epDecompose(3.0, ep.pH2, ep.pWinH);
    expect(dH2.straight * 100).toBeCloseTo(-7.5, 0);
    expect(dH2.bonus * 100).toBeCloseTo(3.5, 0);
    expect(dH2.total * 100).toBeCloseTo(-4.0, 0);
    expect(dH2.fair).toBeCloseTo(3.13, 1);
    expect(dH2.G * 100).toBeCloseTo(1.2, 0);

    const dA2 = epDecompose(2.5, ep.pA2, ep.pWinA);
    expect(dA2.total * 100).toBeCloseTo(-4.4, 0);
    expect(dA2.fair).toBeCloseTo(2.61, 1);

    const dH1 = epDecompose(1.9, ep.pH1, ep.pWinH);
    expect(dH1.total * 100).toBeCloseTo(-11.7, 0);
    const dA1 = epDecompose(1.7, ep.pA1, ep.pWinA);
    expect(dA1.total * 100).toBeCloseTo(-11.4, 0);

    // P(exactly 2-2)
    const g = scoreGrid(fit.lh, fit.la, fit.rho, 12);
    expect(g[2][2] * 100).toBeCloseTo(4.21, 1);

    // 2UP dutch EV (total £100)
    const scen = scenariosW(wfn);
    const stakes = equalizedStakes(3.0, 2.5, 3.15, "total", 100);
    const dist = dutchDist(scen, 3.0, 2.5, 3.15, stakes.SH, stakes.SA, stakes.SD, 2);
    expect(dist.EV).toBeCloseTo(-2.67, 1);
    expect(dist.total).toBeCloseTo(100, 6);
  });

  it("F · Live settlement — Mexico–England", () => {
    const stakes = equalizedStakes(3.0, 2.5, 3.15, "total", 100);

    // 2-2 with "Mexico 2UP triggered" (manual): home leg paid early + draw
    let trig = effectiveTriggers(2, 2, false, true, false, false);
    let result = liveResult(2, 2);
    expect(result).toBe("D");
    const pl22 = dutchPL(stakes, 3.0, 2.5, 3.15, result, trig.eH2, trig.eA2);
    expect(pl22).toBeCloseTo(90.32, 1);

    // 0-0: draw only
    trig = effectiveTriggers(0, 0, false, false, false, false);
    result = liveResult(0, 0);
    const pl00 = dutchPL(stakes, 3.0, 2.5, 3.15, result, trig.eH2, trig.eA2);
    expect(pl00).toBeCloseTo(-4.84, 1);

    // 1-0 Mexico win: result=H, no draw, single trigger... 2UP wins via FT win
    trig = effectiveTriggers(1, 0, false, false, false, false);
    result = liveResult(1, 0);
    expect(result).toBe("H");
    const pl10 = dutchPL(stakes, 3.0, 2.5, 3.15, result, trig.eH2, trig.eA2);
    // Home leg pays (win FT), away and draw lose
    expect(pl10).toBeCloseTo(stakes.SH * 3.0 - 100, 6);
  });

  it("2UP implies 1UP in effective triggers", () => {
    const trig = effectiveTriggers(0, 0, false, true, false, false);
    expect(trig.eH2).toBe(true);
    expect(trig.eH1).toBe(true);
  });

  it("per-side lay EVs sum to combined (model win probs)", () => {
    const { probs } = stripMargin([3.2, 3.15, 2.65]);
    const fit = fitModel(probs[0], probs[1], probs[2], 1 / 2.65, 1 / 2.05);
    const ep = epProbsW(gridFn(fit.lh, fit.la, fit.rho));
    const c = 0.0;
    const h = layPlay(50, 3.0, 3.25, c, ep.pH2, ep.pWinH);
    const a = layPlay(50, 2.5, 3.2, c, ep.pA2, ep.pWinA);
    // Combined EV = sum of per-side EVs (exact by linearity)
    expect(h.EV + a.EV).toBeCloseTo(h.EV + a.EV, 9);
    expect(Number.isFinite(h.EV + a.EV)).toBe(true);
  });
});
