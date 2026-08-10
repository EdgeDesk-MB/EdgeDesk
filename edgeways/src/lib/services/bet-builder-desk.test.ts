import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  accounts,
  balanceTransactions,
  db,
  bets,
  betBuilderRuns,
  betBuilderSelections,
} from "@/lib/db";
import { listFreeBetLots } from "@/lib/accounts/free-bet-lot-balance";
import {
  createBetBuilderRun,
  logBetBuilderWholeLay,
  markBetBuilderNoLay,
  setBetBuilderSelectionResult,
  settleBetBuilderRun,
  updateBetBuilderRun,
} from "./bet-builder-desk";

function bet(id: number | null) {
  if (id == null) throw new Error("expected bet id");
  const row = db.select().from(bets).where(eq(bets.id, id)).get();
  if (!row) throw new Error("bet missing");
  return row;
}

function reset() {
  db.delete(betBuilderSelections).run();
  db.delete(betBuilderRuns).run();
  db.delete(bets).run();
}

describe("bet-builder-desk", () => {
  beforeEach(reset);

  it("creates a combined run, logs whole lay, settles all-win", () => {
    const { run, selections } = createBetBuilderRun({
      label: "Arsenal BB",
      method: "combined",
      stake: 10,
      backOdds: 5,
      bookmaker: "Betfair",
      commission: 0.02,
      eventLabel: "Arsenal v Chelsea",
      selections: [{ label: "Arsenal win" }, { label: "BTTS yes" }, { label: "Over 2.5" }],
    });
    expect(selections).toHaveLength(3);
    expect(bet(run.backBetId).betType).toBe("qualifying");
    expect(bet(run.backBetId).backStake).toBe(10);

    const laid = logBetBuilderWholeLay(run.id, 5.5, 9.26);
    expect(laid?.wholeLayBetId).not.toBeNull();

    for (const sel of selections) {
      setBetBuilderSelectionResult(sel.id, "won");
    }
    const done = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, run.id)).get();
    expect(done?.status).toBe("completed");
    expect(bet(run.backBetId).status).toBe("won");
    expect(bet(run.backBetId).actualProfit).toBe(40);
    expect(bet(done!.wholeLayBetId).status).toBe("lost");
    expect(bet(done!.wholeLayBetId).actualProfit).toBeCloseTo(-(9.26 * (5.5 - 1)), 2);
  });

  it("combined lose settles the whole lay won net of commission", () => {
    const { run, selections } = createBetBuilderRun({
      label: "Lose BB",
      method: "combined",
      stake: 10,
      backOdds: 5,
      bookmaker: "Paddy",
      commission: 0.02,
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    const laid = logBetBuilderWholeLay(run.id, 5.2, 9.5);
    expect(laid?.wholeLayBetId).not.toBeNull();

    setBetBuilderSelectionResult(selections[0]!.id, "lost");
    setBetBuilderSelectionResult(selections[1]!.id, "won");
    const done = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, run.id)).get();
    expect(done?.status).toBe("completed");
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(-10);
    expect(bet(done!.wholeLayBetId).status).toBe("won");
    expect(bet(done!.wholeLayBetId).actualProfit).toBeCloseTo(9.5 * (1 - 0.02), 2);
  });

  it("create can log optional whole lay immediately", () => {
    const { run } = createBetBuilderRun({
      label: "Laid at create",
      method: "combined",
      stake: 10,
      backOdds: 5,
      bookmaker: "Sky",
      commission: 0.02,
      selections: [{ label: "Home" }, { label: "BTTS" }],
      wholeLay: { layOdds: 5.5, layStake: 9.26 },
    });
    expect(run.wholeLayBetId).not.toBeNull();
    expect(run.wholeLayStake).toBe(9.26);
    expect(run.wholeLayOdds).toBe(5.5);
  });

  it("settleBetBuilderRun settles the whole ticket at once", () => {
    const { run, selections } = createBetBuilderRun({
      label: "Whole settle",
      method: "no_lay",
      stake: 10,
      backOdds: 4,
      bookmaker: "Sky",
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    const done = settleBetBuilderRun(run.id, "won");
    expect(done?.status).toBe("completed");
    expect(bet(run.backBetId).status).toBe("won");
    expect(bet(run.backBetId).actualProfit).toBe(30);
    for (const sel of selections) {
      const row = db
        .select()
        .from(betBuilderSelections)
        .where(eq(betBuilderSelections.id, sel.id))
        .get();
      expect(row?.result).toBe("won");
    }
  });

  it("markBetBuilderNoLay flips combined to no_lay and blocks whole lays", () => {
    const { run } = createBetBuilderRun({
      label: "Flip BB",
      method: "combined",
      stake: 10,
      backOdds: 4,
      bookmaker: "Sky",
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    const marked = markBetBuilderNoLay(run.id);
    expect(marked?.method).toBe("no_lay");
    expect(logBetBuilderWholeLay(run.id, 4.2, 9)).toBeNull();
    expect(bet(run.backBetId).layStake).toBe(0);
  });

  it("no-lay cash lose settles at −stake", () => {
    const { run, selections } = createBetBuilderRun({
      label: "Cash BB",
      method: "no_lay",
      stake: 5,
      backOdds: 6,
      bookmaker: "Sky Bet",
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    expect(bet(run.backBetId).layStake).toBe(0);

    setBetBuilderSelectionResult(selections[0]!.id, "lost");
    setBetBuilderSelectionResult(selections[1]!.id, "won");
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(-5);
  });

  it("stores run sport/eventId on the run and back bet", () => {
    const { run } = createBetBuilderRun({
      label: "Sport BB",
      method: "no_lay",
      stake: 5,
      backOdds: 4,
      bookmaker: "Sky",
      sport: "tennis",
      eventId: null,
      selections: [
        { label: "Home", market: "match_winner", selection: "home" },
        { label: "Over", market: "other", selection: "over" },
      ],
    });
    expect(run.sport).toBe("tennis");
    expect(bet(run.backBetId).sport).toBe("tennis");
  });

  it("free_snr convert debits the free-bet lot and loses at £0 P&L", () => {
    const bookie = db
      .insert(accounts)
      .values({ name: "BBFb Bookie", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - BB convert test",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();
    expect(listFreeBetLots(bookie.id).reduce((s, l) => s + l.remaining, 0)).toBe(10);

    const { run, selections } = createBetBuilderRun({
      label: "FB convert BB",
      method: "no_lay",
      stake: 10,
      backOdds: 5,
      bookmaker: "BBFb Bookie",
      backBetType: "free_snr",
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    expect(bet(run.backBetId).betType).toBe("free_snr");
    expect(bet(run.backBetId).balanceLedgered).toBe(1);
    expect(listFreeBetLots(bookie.id).reduce((s, l) => s + l.remaining, 0)).toBe(0);

    setBetBuilderSelectionResult(selections[0]!.id, "lost");
    setBetBuilderSelectionResult(selections[1]!.id, "won");
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(0);

    db.delete(balanceTransactions).where(eq(balanceTransactions.accountId, bookie.id)).run();
    db.delete(accounts).where(eq(accounts.id, bookie.id)).run();
  });

  it("updateBetBuilderRun sets bookmaker and label before lay", () => {
    const { run, selections } = createBetBuilderRun({
      label: "Test",
      method: "combined",
      stake: 20,
      backOdds: 4.98,
      bookmaker: null,
      selections: [
        { label: "Selection 1" },
        { label: "Selection 2" },
        { label: "Selection 3" },
      ],
    });
    const view = updateBetBuilderRun(run.id, {
      label: "Test",
      bookmaker: "Ivybet",
      eventLabel: "Test Event",
      stake: 20,
      backOdds: 4.98,
      selections: selections.map((s) => ({ id: s.id, label: s.label })),
    });
    expect(view?.run.bookmaker).toBe("Ivybet");
    expect(view?.run.eventLabel).toBe("Test Event");
    expect(bet(run.backBetId).bookmaker).toBe("Ivybet");
  });

  it("updateBetBuilderRun locks stake after whole lay", () => {
    const { run, selections } = createBetBuilderRun({
      label: "Laid BB",
      method: "combined",
      stake: 10,
      backOdds: 5,
      bookmaker: "Paddy",
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    logBetBuilderWholeLay(run.id, 5.2, 9.5);
    const view = updateBetBuilderRun(run.id, {
      label: "Laid BB renamed",
      bookmaker: "Sky",
      stake: 50,
      backOdds: 9,
      selections: selections.map((s) => ({ id: s.id, label: `${s.label}!` })),
    });
    expect(view?.run.label).toBe("Laid BB renamed");
    expect(view?.run.bookmaker).toBe("Sky");
    expect(view?.run.stake).toBe(10);
    expect(view?.run.backOdds).toBe(5);
    expect(view?.selections[0]?.label).toBe("Home!");
  });
});
