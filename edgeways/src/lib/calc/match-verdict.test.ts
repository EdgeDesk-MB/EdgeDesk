import { describe, expect, it } from "vitest";
import { checkMatch } from "./match-verdict";

describe("checkMatch", () => {
  it("qualifying £50 @ 4.0 back / 4.2 lay / 2% = 93.76% retained → ok", () => {
    // win = 150, lose = -50, L = 200/4.18 = 47.8469 → 47.85 (pence rounding)
    // liability = 47.85 × 3.2 = 153.12 → ifBackWins = -3.12
    // ifLayWins = -50 + 47.85 × 0.98 = -3.107 → guaranteed = -3.12
    const r = checkMatch({
      mode: "qualifying",
      backStake: 50,
      backOdds: 4,
      layOdds: 4.2,
      commission: 0.02,
    })!;
    expect(r.layStake).toBeCloseTo(47.85, 10);
    expect(r.guaranteed).toBeCloseTo(-3.12, 10);
    expect(r.ratingPct).toBeCloseTo(93.76, 10);
    expect(r.verdict).toBe("ok");
  });

  it("tight qualifier 3.0/3.02 rates good; wide 2.0/2.3 rates poor", () => {
    const tight = checkMatch({
      mode: "qualifying",
      backStake: 50,
      backOdds: 3,
      layOdds: 3.02,
      commission: 0.02,
    })!;
    expect(tight.ratingPct).toBeGreaterThan(97);
    expect(tight.verdict).toBe("good");

    // win = 10, lose = -10, L = 20/2.28 = 8.7719 → 8.77
    // liability = 8.77 × 1.3 = 11.401 → ifBackWins = -1.401
    // ifLayWins = -10 + 8.77 × 0.98 = -1.4054 → guaranteed = -1.4054
    const wide = checkMatch({
      mode: "qualifying",
      backStake: 10,
      backOdds: 2,
      layOdds: 2.3,
      commission: 0.02,
    })!;
    expect(wide.guaranteed).toBeCloseTo(-1.4054, 4);
    expect(wide.ratingPct).toBeCloseTo(85.946, 3);
    expect(wide.verdict).toBe("poor");
  });

  it("SNR £50 @ 6.0 / 6.2 retains 79.28% of face → good", () => {
    // win = 250, lose = 0, L = 250/6.18 = 40.4531 → 40.45
    // liability = 40.45 × 5.2 = 210.34 → ifBackWins = 39.66
    // ifLayWins = 40.45 × 0.98 = 39.641 → guaranteed = 39.641... min is 39.641
    const r = checkMatch({
      mode: "free_snr",
      backStake: 50,
      backOdds: 6,
      layOdds: 6.2,
      commission: 0.02,
    })!;
    expect(r.guaranteed).toBeCloseTo(39.641, 3);
    expect(r.ratingPct).toBeCloseTo(79.282, 3);
    expect(r.verdict).toBe("good");
  });

  it("SNR at low odds retains poorly", () => {
    // Low back odds waste an SNR: £50 @ 2.0/2.1, win = 50, L = 50/2.08 = 24.0385 → 24.04
    // ifBackWins = 50 - 24.04×1.1 = 23.556; ifLayWins = 24.04×0.98 = 23.5592
    // guaranteed = 23.556 → 47.11% → poor
    const r = checkMatch({
      mode: "free_snr",
      backStake: 50,
      backOdds: 2,
      layOdds: 2.1,
      commission: 0.02,
    })!;
    expect(r.ratingPct).toBeCloseTo(47.112, 3);
    expect(r.verdict).toBe("poor");
  });

  it("rejects unusable inputs", () => {
    expect(checkMatch({ mode: "qualifying", backStake: 0, backOdds: 4, layOdds: 4.2, commission: 0.02 })).toBeNull();
    expect(checkMatch({ mode: "qualifying", backStake: 50, backOdds: 1, layOdds: 4.2, commission: 0.02 })).toBeNull();
    expect(checkMatch({ mode: "qualifying", backStake: 50, backOdds: 4, layOdds: 1, commission: 0.02 })).toBeNull();
    expect(checkMatch({ mode: "qualifying", backStake: 50, backOdds: 4, layOdds: 4.2, commission: 1 })).toBeNull();
    expect(checkMatch({ mode: "qualifying", backStake: 50, backOdds: 4, layOdds: 4.2, commission: -0.01 })).toBeNull();
  });
});
