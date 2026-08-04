import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, accaLegs, accaRuns, bets } from "@/lib/db";
import {
  createAccaRun,
  legDueState,
  listAccaRuns,
  logLegLay,
  logWholeLay,
  setLegResult,
  setRunBoost,
} from "./acca-desk";

function bet(id: number | null) {
  if (id == null) throw new Error("expected bet id");
  const row = db.select().from(bets).where(eq(bets.id, id)).get();
  if (!row) throw new Error("bet missing");
  return row;
}

function reset() {
  db.delete(accaLegs).run();
  db.delete(accaRuns).run();
  db.delete(bets).run();
}

const THREE_FOLD = {
  label: "Test 3-fold",
  method: "sequential" as const,
  stake: 10,
  commission: 0,
  legs: [
    { label: "A", backOdds: 2.0 },
    { label: "B", backOdds: 2.0 },
    { label: "C", backOdds: 1.8 },
  ],
};

describe("acca-desk settlement (auditor F3)", () => {
  beforeEach(reset);

  it("all-win sequential run: back +£62, lays lose their liabilities, net −£1.24", () => {
    const { run, legs } = createAccaRun(THREE_FOLD);
    logLegLay(legs[0].id, 2.02, 10.0);
    setLegResult(legs[0].id, "won");
    logLegLay(legs[1].id, 2.02, 20.2);
    setLegResult(legs[1].id, "won");
    logLegLay(legs[2].id, 1.82, 39.56);
    const done = setLegResult(legs[2].id, "won");
    expect(done?.runCompleted).toBe(true);

    const back = bet(run.backBetId);
    expect(back.status).toBe("won");
    expect(back.actualProfit).toBe(62);

    const lays = db.select().from(bets).all().filter((b) => b.betType === "lay_only");
    expect(lays.map((b) => b.actualProfit).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      -32.44, -20.6, -10.2,
    ]);
    const net = back.actualProfit! + lays.reduce((a, b) => a + (b.actualProfit ?? 0), 0);
    expect(net).toBeCloseTo(-1.24, 10);
  });

  it("a leg loss settles the lay WON net of commission and the back LOST", () => {
    const { run, legs } = createAccaRun({ ...THREE_FOLD, commission: 0.05 });
    logLegLay(legs[0].id, 2.02, 10.53); // cover at 5%: 10/0.95
    const out = setLegResult(legs[0].id, "lost");
    expect(out?.runCompleted).toBe(true); // sequential dies on first loss
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(-10);
    expect(bet(legs[0].layBetId ?? db.select().from(accaLegs).where(eq(accaLegs.id, legs[0].id)).get()!.layBetId).actualProfit).toBeCloseTo(10.0, 2);
  });

  it("void legs return the lay and drop out of the combined odds", () => {
    const { run, legs } = createAccaRun(THREE_FOLD);
    logLegLay(legs[0].id, 2.02, 10.0);
    setLegResult(legs[0].id, "void");
    setLegResult(legs[1].id, "won");
    const done = setLegResult(legs[2].id, "won");
    expect(done?.runCompleted).toBe(true);
    // combined without the void leg: 2.0 × 1.8 = 3.6 → back +£26
    expect(bet(run.backBetId).actualProfit).toBe(26);
    const voidedLay = db.select().from(bets).all().find((b) => b.betType === "lay_only");
    expect(voidedLay?.status).toBe("void");
    expect(voidedLay?.actualProfit).toBe(0);
  });

  it("INSURANCE stays active after a loss until every leg resolves (auditor F1)", () => {
    const { run, legs } = createAccaRun({
      ...THREE_FOLD,
      method: "insurance_legs",
      refundAmount: 10,
    });
    logLegLay(legs[0].id, 2.02, 10.0);
    const afterLoss = setLegResult(legs[0].id, "lost");
    // Money settles immediately…
    expect(bet(run.backBetId).status).toBe("lost");
    // …but the run is NOT decided: the refund needs the other legs' results.
    expect(afterLoss?.runCompleted).toBe(false);
    expect(listAccaRuns().find((r) => r.run.id === run.id)?.run.status).toBe("active");

    // No further leg is ever lay-due on a dead acca.
    const view = listAccaRuns().find((r) => r.run.id === run.id)!;
    const leg2 = view.legs.find((l) => l.seq === 2)!;
    expect(legDueState(view.run, view.legs, leg2, Date.now()).due).toBe(false);

    setLegResult(leg2.id, "won");
    const done = setLegResult(view.legs.find((l) => l.seq === 3)!.id, "won");
    expect(done?.runCompleted).toBe(true);
    expect(listAccaRuns().find((r) => r.run.id === run.id)?.run.status).toBe("completed");
  });

  it("insurance_whole: the combined lay settles opposite the acca", () => {
    const { run, legs } = createAccaRun({
      ...THREE_FOLD,
      method: "insurance_whole",
      refundAmount: 10,
    });
    logWholeLay(run.id, 7.5, 9.6); // 72/7.5 = 9.60
    setLegResult(legs[0].id, "won");
    setLegResult(legs[1].id, "won");
    setLegResult(legs[2].id, "won");
    const updated = listAccaRuns().find((r) => r.run.id === run.id)!.run;
    expect(updated.status).toBe("completed");
    expect(bet(updated.backBetId).actualProfit).toBe(62);
    expect(bet(updated.wholeLayBetId).status).toBe("lost");
    expect(bet(updated.wholeLayBetId).actualProfit).toBe(-62.4); // 9.6 × 6.5
  });

  it("a 50% boost (winnings-only) reaches the real settlement, not just display", () => {
    // Raw combined 2.0 × 2.0 = 4.0, boosted 1 + (4-1)×1.5 = 5.5.
    const { run, legs } = createAccaRun({
      label: "Boosted 2-fold",
      method: "sequential",
      stake: 10,
      commission: 0,
      boostPct: 50,
      legs: [
        { label: "A", backOdds: 2.0 },
        { label: "B", backOdds: 2.0 },
      ],
    });
    // The stored back bet's odds are the BOOSTED price, not the raw product.
    expect(bet(run.backBetId).backOdds).toBeCloseTo(5.5, 10);

    // Leg A isn't final (B is still pending) - cover-lay maths is odds-
    // independent, so the boost doesn't touch this suggestion.
    const legA = legDueState(run, legs, legs[0], Date.now());
    expect(legA.suggestedStake).toBeCloseTo(10, 10);
    logLegLay(legs[0].id, 2.0, 10.0); // liability 10×(2.0−1) = £10, matches priorLiabilities below
    setLegResult(legs[0].id, "won");

    // Leg B IS final - its lock stake must be computed against the
    // BOOSTED combined odds (5.5), not the raw 4.0.
    const afterA = listAccaRuns().find((r) => r.run.id === run.id)!;
    const legB = legDueState(afterA.run, afterA.legs, afterA.legs[1], Date.now());
    expect(legB.isFinal).toBe(true);
    // win0 = 10×(5.5−1) − 10 = 35, lose0 = −(10+10) = −20, L = 55/2 = 27.5
    expect(legB.suggestedStake).toBeCloseTo(27.5, 10);

    logLegLay(legs[1].id, 2.0, 27.5);
    const done = setLegResult(legs[1].id, "won");
    expect(done?.runCompleted).toBe(true);

    // Real settlement: back wins at the BOOSTED price, £45 not £30.
    expect(bet(run.backBetId).actualProfit).toBeCloseTo(45, 10);
    // Locked either way at £7.50 - the whole point of the final-leg lock.
    const legALay = bet(db.select().from(accaLegs).where(eq(accaLegs.id, legs[0].id)).get()!.layBetId);
    const legBLay = bet(db.select().from(accaLegs).where(eq(accaLegs.id, legs[1].id)).get()!.layBetId);
    const net = bet(run.backBetId).actualProfit! + legALay.actualProfit! + legBLay.actualProfit!;
    expect(net).toBeCloseTo(7.5, 6);
  });

  it("setRunBoost updates the run and re-syncs the linked back bet's stored odds", () => {
    const { run } = createAccaRun(THREE_FOLD); // unboosted, combined 2×2×1.8=7.2
    expect(bet(run.backBetId).backOdds).toBeCloseTo(7.2, 10);

    const updated = setRunBoost(run.id, 25); // 1 + (7.2−1)×1.25 = 8.75
    expect(updated?.boostPct).toBe(25);
    expect(bet(run.backBetId).backOdds).toBeCloseTo(8.75, 10);

    setRunBoost(run.id, null); // clearing the boost restores the raw price
    expect(bet(run.backBetId).backOdds).toBeCloseTo(7.2, 10);
  });

  it("setRunBoost refuses once the run is no longer active, so it can never desync a settled bet", () => {
    const { run, legs } = createAccaRun(THREE_FOLD);
    setLegResult(legs[0].id, "lost"); // sequential dies on first loss -> completed
    expect(listAccaRuns().find((r) => r.run.id === run.id)?.run.status).toBe("completed");
    const oddsBeforeAttempt = bet(run.backBetId).backOdds;

    const result = setRunBoost(run.id, 50);
    expect(result).toBeNull();
    expect(bet(run.backBetId).backOdds).toBe(oddsBeforeAttempt); // untouched
    expect(listAccaRuns().find((r) => r.run.id === run.id)?.run.boostPct).toBeNull(); // untouched
  });
});
