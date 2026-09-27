import { describe, expect, it } from "vitest";
import {
  nextManualLayStake,
  resolveCalculatorLayStake,
} from "./calculator-lay-stake";
import {
  addBetLayCalcKey,
  commitLayStakeOverride,
  resolveAddBetLayStake,
} from "./add-bet-lay-stake";
import { layBounds, layPlanOutcome, type LayPlanInput } from "@/lib/calc";

/** EDGE-213 journey: back £10 @ 3.0, lay @ 3.1, 2% commission. */
const journey: LayPlanInput = {
  mode: "qualifying",
  backStake: 10,
  backOdds: 3,
  layOdds: 3.1,
  commission: 0.02,
};
const journeyAt32: LayPlanInput = { ...journey, backOdds: 3.2 };

describe("resolveCalculatorLayStake: auto", () => {
  it("is the Add bet auto stake: 10 × 3.0 / (3.1 − 0.02) = 9.7403 → £9.74", () => {
    expect(resolveCalculatorLayStake(journey, null)).toBe(9.74);
    expect(resolveCalculatorLayStake(journey, null)).toBe(
      resolveAddBetLayStake(journey, null, addBetLayCalcKey(journey))
    );
  });

  it("follows the back odds: 10 × 3.2 / 3.08 = 10.3896 → £10.39", () => {
    expect(resolveCalculatorLayStake(journeyAt32, null)).toBe(10.39);
  });

  it("is 0 until the plan is ready", () => {
    expect(resolveCalculatorLayStake(null, null)).toBe(0);
    expect(resolveCalculatorLayStake(null, 9.5)).toBe(0);
  });
});

describe("resolveCalculatorLayStake: manual", () => {
  it("keeps a typed £9.50 after the back odds change 3.0 → 3.2", () => {
    expect(resolveCalculatorLayStake(journey, 9.5)).toBe(9.5);
    expect(resolveCalculatorLayStake(journeyAt32, 9.5)).toBe(9.5);
  });

  it("keeps a typed stake after back stake and commission change", () => {
    expect(resolveCalculatorLayStake({ ...journey, backStake: 25 }, 9.5)).toBe(9.5);
    expect(resolveCalculatorLayStake({ ...journey, commission: 0 }, 9.5)).toBe(9.5);
  });

  it("computes every result from the manual stake at 3.2", () => {
    // Liability 9.50 × (3.1 − 1) = 19.95
    // Back wins: 10 × 2.2 = +22.00, lay −19.95 → +2.05
    // Lay wins: back −10.00, lay 9.50 × 0.98 = +9.31 → −0.69
    const layStake = resolveCalculatorLayStake(journeyAt32, 9.5);
    const out = layPlanOutcome({ ...journeyAt32, layStake });
    expect(out.totalLayStake).toBeCloseTo(9.5, 10);
    expect(out.totalLiability).toBeCloseTo(19.95, 10);
    expect(out.ifBackWins.total).toBeCloseTo(2.05, 10);
    expect(out.ifBackLoses.total).toBeCloseTo(-0.69, 10);
    expect(out.guaranteed).toBeCloseTo(-0.69, 10);
  });

  it("reset (manual → null) returns the auto value for the current inputs", () => {
    const manual = nextManualLayStake(null, 9.5, true);
    expect(resolveCalculatorLayStake(journeyAt32, manual)).toBe(9.5);
    expect(resolveCalculatorLayStake(journeyAt32, null)).toBe(10.39);
  });

  it("keeps a deliberate £0 lay", () => {
    expect(resolveCalculatorLayStake(journey, 0)).toBe(0);
  });

  it("a locked Underlay / Overlay snap still re-derives from the current bounds", () => {
    // Underlay (£0 if bookie loses): 10 / 0.98 = 10.2041 → £10.20
    // Overlay (£0 if bookie wins): 22 / 2.1 = 10.4762 → £10.48
    expect(resolveCalculatorLayStake(journeyAt32, 9.5, "underlay")).toBe(10.2);
    expect(resolveCalculatorLayStake(journeyAt32, 9.5, "overlay")).toBe(10.48);
    expect(resolveCalculatorLayStake(journeyAt32, 9.5, "underlay")).toBe(
      resolveAddBetLayStake(journeyAt32, null, addBetLayCalcKey(journeyAt32), "underlay")
    );
  });
});

describe("calculator vs Add bet for the same inputs", () => {
  const key = addBetLayCalcKey(journey);
  const bounds = layBounds(journey);
  const cases: [string, number][] = [
    ["below standard £9.50", 9.5],
    ["above standard £10.20", 10.2],
    ["underlay bound", bounds.underlay],
    ["overlay bound", bounds.overlay],
  ];

  it.each(cases)("%s gives identical stake and outcome", (_label, typed) => {
    const calcStake = resolveCalculatorLayStake(journey, nextManualLayStake(null, typed, true));
    const addBetStake = resolveAddBetLayStake(
      journey,
      commitLayStakeOverride(typed, key),
      key
    );
    expect(calcStake).toBe(addBetStake);
    expect(layPlanOutcome({ ...journey, layStake: calcStake })).toEqual(
      layPlanOutcome({ ...journey, layStake: addBetStake })
    );
  });

  it("above standard £10.20 at 3.0: back wins +20 − 21.42 = −1.42, lay wins −10 + 9.996 = −0.004", () => {
    const out = layPlanOutcome({
      ...journey,
      layStake: resolveCalculatorLayStake(journey, 10.2),
    });
    expect(out.totalLiability).toBeCloseTo(21.42, 10);
    expect(out.ifBackWins.total).toBeCloseTo(-1.42, 10);
    expect(out.ifBackLoses.total).toBeCloseTo(-0.004, 10);
  });
});

describe("nextManualLayStake", () => {
  it("accepts decimals", () => {
    expect(nextManualLayStake(null, 9.5, true)).toBe(9.5);
    expect(nextManualLayStake(null, 12.37, true)).toBe(12.37);
  });

  it("keeps a deliberate £0 typed once the plan is ready", () => {
    expect(nextManualLayStake(9.5, 0, true)).toBe(0);
  });

  it("clearing the field (NaN) returns to auto", () => {
    expect(nextManualLayStake(9.5, Number.NaN, true)).toBeNull();
    expect(nextManualLayStake(9.5, Number.NaN, false)).toBeNull();
  });

  it("rejects negatives and non-finite input, keeping the current value", () => {
    expect(nextManualLayStake(9.5, -1, true)).toBe(9.5);
    expect(nextManualLayStake(null, -1, true)).toBeNull();
    expect(nextManualLayStake(9.5, Number.POSITIVE_INFINITY, true)).toBe(9.5);
  });

  it("ignores stray input while the plan is pending, so a £0 cannot stick", () => {
    expect(nextManualLayStake(null, 0, false)).toBeNull();
    expect(nextManualLayStake(9.5, 0, false)).toBe(9.5);
  });
});
