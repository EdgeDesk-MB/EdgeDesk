import { describe, expect, it } from "vitest";
import { executableLayStake, layBounds, layPlanOutcome, type LayPlanInput } from "./layplan";
import { optimalLayStake } from "./matched";

const near = (a: number, b: number, dp = 2) => expect(a).toBeCloseTo(b, dp);

describe("layBounds", () => {
  const base: LayPlanInput = {
    mode: "qualifying",
    backStake: 50,
    backOdds: 11,
    layOdds: 13,
    commission: 0,
  };

  it("standard matches the classic matched-bet stake", () => {
    near(layBounds(base).standard, optimalLayStake(base), 4);
    near(layBounds(base).standard, (50 * 11) / 13, 4); // 42.31
  });

  it("underlay → £0 when the bookie bet loses (to the penny)", () => {
    const b = layBounds(base);
    near(b.underlay, 50, 4); // B/(1-c)
    const o = layPlanOutcome({ ...base, layStake: b.underlay });
    near(o.ifBackLoses.total, 0, 4);
    expect(o.ifBackWins.total).toBeLessThan(0); // all-or-nothing on the bookie side is a choice
  });

  it("overlay → £0 when the bookie bet wins", () => {
    const b = layBounds(base);
    near(b.overlay, 500 / 12, 4); // B(Ob-1)/(Ol-1) = 41.67
    const o = layPlanOutcome({ ...base, layStake: b.overlay });
    near(o.ifBackWins.total, 0, 4);
    near(o.ifBackLoses.total, -50 + (500 / 12) * 1, 2);
  });

  it("commission shifts the underlay bound", () => {
    const input = { ...base, commission: 0.02 };
    const b = layBounds(input);
    near(b.underlay, 50 / 0.98, 4);
    near(layPlanOutcome({ ...input, layStake: b.underlay }).ifBackLoses.total, 0, 4);
  });

  it("boosted-odds underlay (the Kane case): back 10 @ 6.5, lay @ 5.2, 2%", () => {
    const input: LayPlanInput = {
      mode: "qualifying",
      backStake: 10,
      backOdds: 6.5,
      layOdds: 5.2,
      commission: 0.02,
    };
    const b = layBounds(input);
    near(b.underlay, 10.2, 1);
    const o = layPlanOutcome({ ...input, layStake: b.underlay });
    near(o.ifBackLoses.total, 0, 4);
    expect(o.ifBackWins.total).toBeGreaterThan(12); // boost profit rides on the win
  });

  it("free bet SNR bounds", () => {
    const input: LayPlanInput = {
      mode: "free_snr",
      backStake: 50,
      backOdds: 11,
      layOdds: 13,
      commission: 0,
    };
    const b = layBounds(input);
    near(b.standard, 500 / 13, 2); // 38.46 as in MBB
    near(b.overlay, 500 / 12, 2); // no-loss-if-wins
    expect(b.underlay).toBe(0); // an SNR can't lose money when it loses
  });

  it("part lays reduce the remaining stake and P&L accounts for them", () => {
    const withPart: LayPlanInput = {
      ...base,
      partLays: [{ odds: 12.5, stake: 20 }],
    };
    const b = layBounds(withPart);
    expect(b.standard).toBeLessThan(layBounds(base).standard);
    // Equalised: both outcomes match
    const o = layPlanOutcome({ ...withPart, layStake: b.standard });
    near(o.ifBackWins.total, o.ifBackLoses.total, 4);
    // Underlay with the part already on: lose-case still exactly zero
    const u = layPlanOutcome({ ...withPart, layStake: b.underlay });
    near(u.ifBackLoses.total, 0, 4);
    // Effective odds collapse reproduces the liability
    near(u.totalLiability, u.totalLayStake * (u.effectiveLayOdds - 1), 6);
  });

  it("part lay already beyond underlay clamps remaining stake to 0", () => {
    const b = layBounds({ ...base, partLays: [{ odds: 13, stake: 60 }] });
    expect(b.underlay).toBe(0);
  });

  it("SNR at executable lay stake shows honest pence rounding", () => {
    const input: LayPlanInput = {
      mode: "free_snr",
      backStake: 20,
      backOdds: 7.5,
      layOdds: 8.2,
      commission: 0,
    };
    expect(executableLayStake(input)).toBe(15.85);
    const o = layPlanOutcome({ ...input, layStake: 15.85 });
    near(o.ifBackWins.total, 15.88, 2);
    near(o.ifBackLoses.total, 15.85, 2);
    near(o.guaranteed, 15.85, 2);
    near(o.totalLiability, 114.12, 2);
  });
});
