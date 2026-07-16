import { describe, expect, it } from "vitest";
import {
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
