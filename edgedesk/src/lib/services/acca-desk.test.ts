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
});
