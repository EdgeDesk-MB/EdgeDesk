import { describe, expect, it } from "vitest";
import {
  accaCampaignProfit,
  accaOutcomePercentages,
  accaSquareProvisional,
  applyAccaBoost,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
  wholeAccaLay,
} from "./acca-workflow";

describe("nextSequentialLay - the zero-loss cover recursion", () => {
  // Hand-worked 4-fold: £10 acca, bookie odds 2.0 × 2.0 × 1.8 × 1.6 = 11.52
  // (all-win bookie profit £105.20). Each leg is laid so that if IT loses,
  // the exchange win exactly covers the stake plus every liability paid on
  // earlier winning legs - £0 on any leg loss, commission 0:
  //   leg 1 @ 2.02: L = 10.00           (liability 10.20)
  //   leg 2 @ 2.02: L = 10 + 10.20      = 20.20 (liability 20.604)
  //   leg 3 @ 1.82: L = 10 + 30.804     = 40.804 → £40.80 (liab 33.45928)
  it("each leg covers stake + prior liabilities exactly", () => {
    expect(nextSequentialLay({ accaStake: 10, priorLiabilities: 0, commission: 0 })).toBeCloseTo(10, 10);
    expect(nextSequentialLay({ accaStake: 10, priorLiabilities: 10.2, commission: 0 })).toBeCloseTo(20.2, 10);
    expect(
      nextSequentialLay({ accaStake: 10, priorLiabilities: 10.2 + 20.604, commission: 0 })
    ).toBeCloseTo(40.8, 10); // pence-rounded executable
  });

  it("commission inflates the cover stake: 10/(1−0.02) → £10.20", () => {
    expect(nextSequentialLay({ accaStake: 10, priorLiabilities: 0, commission: 0.02 })).toBeCloseTo(
      10.2,
      10
    );
  });

  it("guards nonsense", () => {
    expect(nextSequentialLay({ accaStake: 0, priorLiabilities: 0, commission: 0 })).toBeNull();
    expect(nextSequentialLay({ accaStake: 10, priorLiabilities: -1, commission: 0 })).toBeNull();
  });
});

describe("finalLegLockLay - equalise the last leg", () => {
  // Continuing the 4-fold: prior liabilities after three winning laid legs
  // = 10.20 + 20.604 + 33.45928 = 64.26328.
  // win0 = 105.20 − 64.26328 = 40.93672 · lose0 = −74.26328
  // L = (win0 − lose0)/(q − c) = 115.20/1.62 = 71.1111… → £71.11
  // locked ≈ −£3.15 either way (the acca qualifying loss, made explicit).
  it("4-fold final leg at 1.62 locks −£3.15 both ways", () => {
    const r = finalLegLockLay({
      accaStake: 10,
      combinedBackOdds: 11.52,
      priorLiabilities: 64.26328,
      legLayOdds: 1.62,
      commission: 0,
    });
    if (!r) throw new Error("expected lay");
    expect(r.layStake).toBeCloseTo(71.11, 10);
    expect(r.lockedIfWin).toBeCloseTo(40.93672 - 71.11 * 0.62, 6);
    expect(r.lockedIfLose).toBeCloseTo(-74.26328 + 71.11, 6);
    expect(Math.abs(r.lockedIfWin - r.lockedIfLose)).toBeLessThan(0.01);
  });

  it("guards impossible odds", () => {
    expect(
      finalLegLockLay({
        accaStake: 10,
        combinedBackOdds: 11.52,
        priorLiabilities: 0,
        legLayOdds: 1,
        commission: 0,
      })
    ).toBeNull();
  });
});

describe("wholeAccaLay - insurance laid once at combined odds", () => {
  // £10 at combined 11.52 laid at 12.5, commission 0:
  // L = 10 × 11.52 / 12.5 = 9.216 → £9.22 executable
  // all win: 105.20 − 9.22×11.5 = −£0.83 · any loss: −10 + 9.22 = −£0.78
  it("standard equalising lay at the combined price", () => {
    const r = wholeAccaLay({ stake: 10, combinedOdds: 11.52, layOdds: 12.5, commission: 0 });
    if (!r) throw new Error("expected lay");
    expect(r.layStake).toBeCloseTo(9.22, 10);
    expect(r.profitIfAllWin).toBeCloseTo(105.2 - 9.22 * 11.5, 6);
    expect(r.profitIfAnyLose).toBeCloseTo(-10 + 9.22, 6);
  });

  it("2% commission shifts the stake: 115.2/(12.5−0.02) = £9.23", () => {
    const r = wholeAccaLay({ stake: 10, combinedOdds: 11.52, layOdds: 12.5, commission: 0.02 });
    if (!r) throw new Error("expected lay");
    expect(r.layStake).toBeCloseTo(9.23, 10);
    expect(r.profitIfAnyLose).toBeCloseTo(-10 + 9.23 * 0.98, 6);
  });
});

describe("priorLayLiabilities - the rolling ledger", () => {
  it("sums liability only for LAID legs that WON (paid liabilities)", () => {
    const legs = [
      { result: "won" as const, layStake: 10, layOdds: 2.02 }, // liab 10.20
      { result: "won" as const, layStake: null, layOdds: null }, // won unlaid - nothing paid
      { result: "void" as const, layStake: 20, layOdds: 2.0 }, // void - lay returned
      { result: "pending" as const, layStake: 40.8, layOdds: 1.82 }, // not settled yet
    ];
    expect(priorLayLiabilities(legs)).toBeCloseTo(10.2, 10);
  });
});

describe("accaCampaignProfit - realised campaign P&L", () => {
  it("busting before the final leg nets exactly £0 (the zero-loss cover guarantee)", () => {
    // £10 stake, leg 1 wins (laid £10 @ 2.0 -> liability £10), leg 2 busts.
    // Its cover stake is nextSequentialLay(10, priorLiabilities: 10, 0) = £20,
    // so the lay win (£20) exactly cancels the stake (£10) + leg 1's paid
    // liability (£10): -10 (liability) + 20 (lay win) - 10 (stake) = 0.
    const run = { stake: 10, commission: 0 };
    const legs = [
      { backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { backOdds: 2, result: "lost" as const, layStake: 20, layOdds: 3.0 },
    ];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(0, 10);
  });

  it("free_snr bust does not subtract the free stake (mirrors backLostProfit £0)", () => {
    // Same lays as the cash zero-loss vector, but the back was a free bet:
    // liabilities −10 + lay win +20 + back £0 = +£10 (the extracted free-bet value).
    const run = { stake: 10, commission: 0, backBetType: "free_snr" };
    const legs = [
      { backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { backOdds: 2, result: "lost" as const, layStake: 20, layOdds: 3.0 },
    ];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(10, 10);
  });

  it("free_sr bust does not subtract the free stake either (desk allows free_sr converts)", () => {
    // Same vector as free_snr: the stake was never cash at risk, so a bust
    // must not show −stake. +£10 extracted, same as backLostProfit £0.
    const run = { stake: 10, commission: 0, backBetType: "free_sr" };
    const legs = [
      { backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { backOdds: 2, result: "lost" as const, layStake: 20, layOdds: 3.0 },
    ];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(10, 10);
  });

  it("all legs winning banks the combined payout minus every paid liability", () => {
    // £10 stake @ combined 2 × 3 = 6 -> back wins £50. Two laid legs won
    // (lays lost), paying liabilities £10 and £5: 50 - 10 - 5 = £35.
    const run = { stake: 10, commission: 0 };
    const legs = [
      { backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { backOdds: 3, result: "won" as const, layStake: 5, layOdds: 2.0 },
    ];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(35, 10);
  });

  it("every leg voiding nets exactly £0 - nothing was ever at risk", () => {
    const run = { stake: 10, commission: 0 };
    const legs = [{ backOdds: 2, result: "void" as const, layStake: null, layOdds: null }];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(0, 10);
  });

  it("insurance_whole matches wholeAccaLay's own hand-worked figures both ways", () => {
    // Reuses the wholeAccaLay suite's exact numbers above: £10 @ combined
    // 11.52, laid once at 12.5 for £9.22, 0% commission.
    const run = { stake: 10, commission: 0, wholeLayStake: 9.22, wholeLayOdds: 12.5 };
    const anyLoseLegs = [{ backOdds: 11.52, result: "lost" as const, layStake: null, layOdds: null }];
    expect(accaCampaignProfit(run, anyLoseLegs)).toBeCloseTo(-10 + 9.22, 6);

    const allWinLegs = [{ backOdds: 11.52, result: "won" as const, layStake: null, layOdds: null }];
    expect(accaCampaignProfit(run, allWinLegs)).toBeCloseTo(105.2 - 9.22 * 11.5, 6);
  });

  it("rounds each leg to the penny like the real ledger, not sum-then-round", () => {
    // Two lost legs, £0.33 lay stake each, 5% commission: raw contribution
    // per leg is 0.33 × 0.95 = 0.3135 → roundPence per leg = £0.31 each,
    // total £0.62 - matching settleLinkedBet's per-bet rounding in
    // acca-desk.ts. Summing the raw 0.3135 twice then rounding once would
    // wrongly give £0.63.
    const run = { stake: 10, commission: 0.05 };
    const legs = [
      { backOdds: 2, result: "lost" as const, layStake: 0.33, layOdds: 2.0 },
      { backOdds: 2, result: "lost" as const, layStake: 0.33, layOdds: 2.0 },
    ];
    // anyLost still applies (-stake), isolate the per-leg rounding by
    // checking against the stake-adjusted expectation directly.
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(0.62 - 10, 10);
  });

  it("a still-active run with no loss yet only counts liabilities actually paid", () => {
    // Leg 1 has won (laid, liability £10 paid); leg 2 hasn't kicked off -
    // the back bet is still open, so it contributes nothing yet.
    const run = { stake: 10, commission: 0 };
    const legs = [
      { backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { backOdds: 2, result: "pending" as const, layStake: null, layOdds: null },
    ];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(-10, 10);
  });

  it("threads a boosted all-win payout through applyAccaBoost's winnings-only convention", () => {
    // Two unlaid legs at 2.0 x 2.0 = raw combined 4.0, boosted 50% ->
    // 1 + (4-1)x1.5 = 5.5. All-win profit = 10 x (5.5-1) = £45, not the
    // unboosted £30 - the boost must reach this branch, not just display.
    const run = { stake: 10, commission: 0, boostPct: 50 };
    const legs = [
      { backOdds: 2, result: "won" as const, layStake: null, layOdds: null },
      { backOdds: 2, result: "won" as const, layStake: null, layOdds: null },
    ];
    expect(accaCampaignProfit(run, legs)).toBeCloseTo(45, 10);
  });
});

describe("accaSquareProvisional - worst/locked when square on next leg", () => {
  it("returns null when the next pending leg is still unlaid", () => {
    const run = { stake: 10, commission: 0, method: "sequential" as const };
    const legs = [
      { seq: 1, backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { seq: 2, backOdds: 2, result: "pending" as const, layStake: null, layOdds: null },
    ];
    expect(accaSquareProvisional(run, legs)).toBeNull();
  });

  it("covered mid-run: next laid leg lose-path floors at £0 (worst)", () => {
    // Leg 1 won (liability £10 paid); leg 2 square at cover £20 → bust nets £0.
    const run = { stake: 10, commission: 0, method: "sequential" as const };
    const legs = [
      { seq: 1, backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { seq: 2, backOdds: 2, result: "pending" as const, layStake: 20, layOdds: 3.0 },
      { seq: 3, backOdds: 2, result: "pending" as const, layStake: null, layOdds: null },
    ];
    const r = accaSquareProvisional(run, legs);
    expect(r).toEqual({ value: 0, kind: "worst", squareLegSeq: 2 });
  });

  it("final-leg equalise locks win and lose to the same £", () => {
    // £10 @ combined 2×2=4, prior liab £10, lay @ 2.0, c=0.
    // finalLegLockLay: win0=10*(4-1)-10=20, lose0=-(10+10)=-20,
    // L=(20-(-20))/(2-0)=20; lockedIfWin=20-20*1=0; lockedIfLose=-20+20=0.
    const run = { stake: 10, commission: 0, method: "sequential" as const };
    const legs = [
      { seq: 1, backOdds: 2, result: "won" as const, layStake: 10, layOdds: 2.0 },
      { seq: 2, backOdds: 2, result: "pending" as const, layStake: 20, layOdds: 2.0 },
    ];
    const lock = finalLegLockLay({
      accaStake: 10,
      combinedBackOdds: 4,
      priorLiabilities: 10,
      legLayOdds: 2,
      commission: 0,
    })!;
    const r = accaSquareProvisional(run, legs);
    expect(r?.kind).toBe("locked");
    expect(r?.value).toBeCloseTo(lock.lockedIfLose, 2);
    expect(r?.value).toBeCloseTo(0, 2);
  });

  it("whole-acca lay: provisional is the worse of all-win vs any-lose", () => {
    const whole = wholeAccaLay({
      stake: 10,
      combinedOdds: 11.52,
      layOdds: 12.5,
      commission: 0,
    })!;
    const run = {
      stake: 10,
      commission: 0,
      method: "combined" as const,
      wholeLayStake: whole.layStake,
      wholeLayOdds: 12.5,
    };
    const legs = [
      { seq: 1, backOdds: 2, result: "pending" as const, layStake: null, layOdds: null },
      { seq: 2, backOdds: 2, result: "pending" as const, layStake: null, layOdds: null },
      { seq: 3, backOdds: 1.8, result: "pending" as const, layStake: null, layOdds: null },
      { seq: 4, backOdds: 1.6, result: "pending" as const, layStake: null, layOdds: null },
    ];
    const r = accaSquareProvisional(run, legs);
    expect(r?.kind).toBe("worst");
    expect(r?.value).toBeCloseTo(
      Math.min(whole.profitIfAllWin, whole.profitIfAnyLose),
      2
    );
  });
});

describe("accaOutcomePercentages - ALL WIN / 1 LOSE / 1+ LOSE breakdown", () => {
  it("three pending legs at evens-ish 2.0 (p=0.5 each): 12.5% / 37.5% / 87.5%", () => {
    const legs = [
      { backOdds: 2, result: "pending" as const },
      { backOdds: 2, result: "pending" as const },
      { backOdds: 2, result: "pending" as const },
    ];
    const r = accaOutcomePercentages(legs);
    expect(r.allWinPct).toBeCloseTo(12.5, 10);
    expect(r.oneLosePct).toBeCloseTo(37.5, 10);
    expect(r.atLeastOneLosePct).toBeCloseTo(87.5, 10);
  });

  it("a WON leg is certain (p=1), sharpening the breakdown as the run plays out", () => {
    // Leg 1 already won (p forced to 1); legs 2/3 still pending at 2.0 (p=0.5).
    // All win: 1×0.5×0.5 = 25%. Exactly one loses: (1-1)×0.25 + (1-0.5)×1×0.5
    // ×2 = 0 + 0.25 + 0.25 = 50%.
    const legs = [
      { backOdds: 2, result: "won" as const },
      { backOdds: 2, result: "pending" as const },
      { backOdds: 2, result: "pending" as const },
    ];
    const r = accaOutcomePercentages(legs);
    expect(r.allWinPct).toBeCloseTo(25, 10);
    expect(r.oneLosePct).toBeCloseTo(50, 10);
    expect(r.atLeastOneLosePct).toBeCloseTo(75, 10);
  });

  it("a LOST leg makes all-win impossible and locks in at-least-one-lose at 100%", () => {
    const legs = [
      { backOdds: 2, result: "lost" as const },
      { backOdds: 2, result: "pending" as const },
    ];
    const r = accaOutcomePercentages(legs);
    expect(r.allWinPct).toBeCloseTo(0, 10);
    expect(r.oneLosePct).toBeCloseTo(50, 10); // leg 2 alone winning = exactly one loss
    expect(r.atLeastOneLosePct).toBeCloseTo(100, 10);
  });

  it("a VOID leg is excluded entirely, same convention as combinedBackOdds", () => {
    const legs = [
      { backOdds: 2, result: "pending" as const },
      { backOdds: 3, result: "void" as const },
    ];
    const r = accaOutcomePercentages(legs);
    expect(r.allWinPct).toBeCloseTo(50, 10);
    expect(r.oneLosePct).toBeCloseTo(50, 10);
    expect(r.atLeastOneLosePct).toBeCloseTo(50, 10);
  });

  it("guards the degenerate empty/all-void case", () => {
    expect(accaOutcomePercentages([])).toEqual({ allWinPct: 0, oneLosePct: 0, atLeastOneLosePct: 0 });
  });

  it("at_start ignores settled results so History can show the going-in estimate", () => {
    // Same as three pending 2.0 legs even though one has already lost: 12.5 / 37.5 / 87.5.
    const legs = [
      { backOdds: 2, result: "lost" as const },
      { backOdds: 2, result: "won" as const },
      { backOdds: 2, result: "pending" as const },
    ];
    const r = accaOutcomePercentages(legs, { mode: "at_start" });
    expect(r.allWinPct).toBeCloseTo(12.5, 10);
    expect(r.oneLosePct).toBeCloseTo(37.5, 10);
    expect(r.atLeastOneLosePct).toBeCloseTo(87.5, 10);
  });

  it("at_start still excludes void legs", () => {
    const legs = [
      { backOdds: 2, result: "lost" as const },
      { backOdds: 3, result: "void" as const },
    ];
    const r = accaOutcomePercentages(legs, { mode: "at_start" });
    expect(r.allWinPct).toBeCloseTo(50, 10);
    expect(r.oneLosePct).toBeCloseTo(50, 10);
    expect(r.atLeastOneLosePct).toBeCloseTo(50, 10);
  });

  it("live is the default mode (settled legs remain certain)", () => {
    const legs = [
      { backOdds: 2, result: "lost" as const },
      { backOdds: 2, result: "pending" as const },
    ];
    expect(accaOutcomePercentages(legs)).toEqual(accaOutcomePercentages(legs, { mode: "live" }));
  });
});

describe("applyAccaBoost - winnings-only convention (Sam's call, 2026-07-22)", () => {
  it("a zero/null/undefined boost is the identity - unboosted runs never move", () => {
    expect(applyAccaBoost(4, 0)).toBe(4);
    expect(applyAccaBoost(4, null)).toBe(4);
    expect(applyAccaBoost(4, undefined)).toBe(4);
    expect(applyAccaBoost(4, -10)).toBe(4); // guards nonsense too
  });

  it("50% boost on a 2-leg 2.0 × 2.0 = 4.0 combined: only the £3 winnings boost, not the £1 stake return", () => {
    // 1 + (4 − 1) × 1.5 = 1 + 4.5 = 5.5
    expect(applyAccaBoost(4, 50)).toBeCloseTo(5.5, 10);
  });

  it("20% boost on the 4-fold's combined 11.52: 1 + (11.52 − 1) × 1.2 = 13.624", () => {
    expect(applyAccaBoost(11.52, 20)).toBeCloseTo(13.624, 10);
  });

  it("30% boost on single-selection 5.75 (bookie slip): 1 + (5.75 − 1) × 1.3 = 7.175", () => {
    // £20 stake → unboosted win £115, boosted win £143.50
    expect(applyAccaBoost(5.75, 30)).toBeCloseTo(7.175, 10);
    expect(20 * applyAccaBoost(5.75, 30)).toBeCloseTo(143.5, 10);
  });
});
