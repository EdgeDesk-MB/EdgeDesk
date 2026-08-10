import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bets, db, systemLegs, systemRuns } from "@/lib/db";
import { createSystemRun, setSystemLegResult } from "./systems-desk";

function bet(id: number | null) {
  if (id == null) throw new Error("expected bet id");
  const row = db.select().from(bets).where(eq(bets.id, id)).get();
  if (!row) throw new Error("bet missing");
  return row;
}

function reset() {
  db.delete(systemLegs).run();
  db.delete(systemRuns).run();
  db.delete(bets).run();
}

describe("systems-desk settlement", () => {
  beforeEach(reset);

  it("cash yankee with one void leg settles at bookmaker reduction, not refunds", () => {
    // £1 Yankee, A/B/C win @2, D void. Bookmaker: lines with D reduce
    // (AD→single A, ABD→double AB, ABCD→treble ABC) → returns £46, profit £35.
    const { run, legs } = createSystemRun({
      label: "Void reduction",
      structure: "yankee",
      unitStake: 1,
      legs: [
        { label: "A", oddsDecimal: 2 },
        { label: "B", oddsDecimal: 2 },
        { label: "C", oddsDecimal: 2 },
        { label: "D", oddsDecimal: 5 },
      ],
    });
    for (const leg of legs) {
      setSystemLegResult(leg.id, leg.label === "D" ? "void" : "won");
    }
    const back = bet(run.backBetId);
    expect(back.status).toBe("won");
    expect(back.actualProfit).toBe(35);
  });

  it("free_snr lucky 15 with one winner records the SNR extraction, not a cash loss", () => {
    // £1 free_snr Lucky 15, A wins @3, B/C/D lost. Only single A pays (£3);
    // SNR keeps no stake → profit = 3 − 1 paying line × £1 = +£2. The old
    // branch recorded 3 − 15 = −£12, a loss that never left the wallet.
    // No bookmaker → placement ledgering no-ops; we assert the settled P&L only.
    const { run, legs } = createSystemRun({
      label: "SNR perm",
      structure: "lucky_15",
      unitStake: 1,
      backBetType: "free_snr",
      legs: [
        { label: "A", oddsDecimal: 3 },
        { label: "B", oddsDecimal: 4 },
        { label: "C", oddsDecimal: 3 },
        { label: "D", oddsDecimal: 2 },
      ],
    });
    for (const leg of legs) {
      setSystemLegResult(leg.id, leg.label === "A" ? "won" : "lost");
    }
    const back = bet(run.backBetId);
    expect(back.status).toBe("won");
    expect(back.actualProfit).toBe(2);
  });

  it("free_snr bust records £0, never a negative", () => {
    const { run, legs } = createSystemRun({
      label: "SNR bust",
      structure: "yankee",
      unitStake: 1,
      backBetType: "free_snr",
      legs: [
        { label: "A", oddsDecimal: 2 },
        { label: "B", oddsDecimal: 2 },
        { label: "C", oddsDecimal: 2 },
        { label: "D", oddsDecimal: 2 },
      ],
    });
    for (const leg of legs) setSystemLegResult(leg.id, "lost");
    const back = bet(run.backBetId);
    expect(back.status).toBe("lost");
    expect(back.actualProfit).toBe(0);
  });

  it("free_sr yankee with one void returns winning-line payoffs in full", () => {
    // Same shape as the cash void test but free_sr: stake returned on paying
    // lines, losing lines cost nothing → profit = full £46 of payoffs.
    const { run, legs } = createSystemRun({
      label: "SR perm",
      structure: "yankee",
      unitStake: 1,
      backBetType: "free_sr",
      legs: [
        { label: "A", oddsDecimal: 2 },
        { label: "B", oddsDecimal: 2 },
        { label: "C", oddsDecimal: 2 },
        { label: "D", oddsDecimal: 5 },
      ],
    });
    for (const leg of legs) {
      setSystemLegResult(leg.id, leg.label === "D" ? "void" : "won");
    }
    const back = bet(run.backBetId);
    expect(back.status).toBe("won");
    expect(back.actualProfit).toBe(46);
  });
});
