import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  accounts,
  alertsInbox,
  balanceTransactions,
  db,
  accaLegs,
  accaRuns,
  bets,
  events,
} from "@/lib/db";
import { listFreeBetLots } from "@/lib/accounts/free-bet-lot-balance";
import { serializeRaceResults } from "@/lib/racing";
import {
  autoResultLinkedLegs,
  createAccaRun,
  legDueState,
  listAccaRuns,
  logLegLay,
  logWholeLay,
  markAccaNoLay,
  setLegResult,
  setRunBoost,
  updateAccaRun,
} from "./acca-desk";

function bet(id: number | null) {
  if (id == null) throw new Error("expected bet id");
  const row = db.select().from(bets).where(eq(bets.id, id)).get();
  if (!row) throw new Error("bet missing");
  return row;
}

function reset() {
  db.delete(alertsInbox).run();
  db.delete(accaLegs).run();
  db.delete(accaRuns).run();
  db.delete(bets).run();
  db.delete(events).run();
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

  it("mid-run leg win pushes next cover stake, not the settled lay liability", () => {
    // Same shape as Sam's first live treble: £20 @ 1.81 → liability £16.20 → next £36.20
    const { run, legs } = createAccaRun({
      label: "Accumulator Treble",
      method: "sequential",
      stake: 20,
      commission: 0,
      legs: [
        { label: "Middlesbrough", backOdds: 1.75 },
        { label: "Cambridge United", backOdds: 1.75 },
        { label: "Stockport County", backOdds: 1.65 },
      ],
    });
    logLegLay(legs[0].id, 1.81, 20);
    const out = setLegResult(legs[0].id, "won");
    expect(out?.runCompleted).toBe(false);

    const alert = db
      .select()
      .from(alertsInbox)
      .where(eq(alertsInbox.dedupe, `acca_next_lay:${legs[1].id}`))
      .get();
    expect(alert).toMatchObject({
      kind: "acca_next_lay",
      title: "Next lay · ~£36.20",
      body: "Accumulator Treble · Cambridge United · enter live exchange lay odds and stake on Acca Desk",
      href: "/acca",
    });
    // No misleading liability-paid inbox row from the desk path.
    expect(
      db.select().from(alertsInbox).where(eq(alertsInbox.kind, "result_settled")).all()
    ).toHaveLength(0);
    expect(run.id).toBeTruthy();
  });

  it("last deciding leg records a campaign-complete alert, not the bookie ticket", () => {
    const { run, legs } = createAccaRun({
      label: "Bet £10 get £10 free bet",
      method: "sequential",
      stake: 10,
      commission: 0,
      bookmaker: "Betfair Sportsbook",
      legs: [
        { label: "Star Start", backOdds: 5 },
        { label: "Burning Up", backOdds: 1.4 },
      ],
    });
    logLegLay(legs[0].id, 6.4, 10);
    setLegResult(legs[0].id, "won");
    const done = setLegResult(legs[1].id, "won");
    expect(done).toMatchObject({ runCompleted: true, runId: run.id });

    const alert = db
      .select()
      .from(alertsInbox)
      .where(eq(alertsInbox.dedupe, `acca_complete:${run.id}`))
      .get();
    expect(alert).toMatchObject({
      kind: "acca_complete",
      title: "You just made £6.00 · Acca won",
      href: "/acca",
    });
    expect(alert?.body).toContain("Double · 1 laid");
    expect(
      db.select().from(alertsInbox).where(eq(alertsInbox.kind, "result_settled")).all()
    ).toHaveLength(0);
  });

  it("covered bust records Acca busted at £0", () => {
    const { run, legs } = createAccaRun({
      label: "Bet £10 get £10 free bet",
      method: "sequential",
      stake: 10,
      commission: 0,
      legs: [
        { label: "Star Start", backOdds: 5 },
        { label: "Burning Up", backOdds: 1.4 },
      ],
    });
    logLegLay(legs[0].id, 6.4, 10);
    setLegResult(legs[0].id, "lost");
    const alert = db
      .select()
      .from(alertsInbox)
      .where(eq(alertsInbox.dedupe, `acca_complete:${run.id}`))
      .get();
    expect(alert?.title).toBe("£0.00 settled · Acca busted");
    expect(alert?.body).toContain("Busted at Star Start");
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

  it("combined: whole-ticket lay settles opposite the acca (no insurance refund)", () => {
    const { run, legs } = createAccaRun({
      ...THREE_FOLD,
      method: "combined",
    });
    expect(run.method).toBe("combined");
    expect(run.noLay).toBe(0);
    logWholeLay(run.id, 7.5, 9.6);
    setLegResult(legs[0].id, "won");
    setLegResult(legs[1].id, "won");
    setLegResult(legs[2].id, "won");
    const updated = listAccaRuns().find((r) => r.run.id === run.id)!.run;
    expect(updated.status).toBe("completed");
    expect(bet(updated.backBetId).actualProfit).toBe(62);
    expect(bet(updated.wholeLayBetId).status).toBe("lost");
    expect(bet(updated.wholeLayBetId).actualProfit).toBe(-62.4);
  });

  it("combined + noLay at create: cash lose settles at −stake without a lay bet", () => {
    const { run, legs } = createAccaRun({
      ...THREE_FOLD,
      method: "combined",
      noLay: true,
    });
    expect(run.noLay).toBe(1);
    expect(run.wholeLayBetId).toBeNull();
    expect(logWholeLay(run.id, 7.5, 9.6)).toBeNull();

    setLegResult(legs[0].id, "lost");
    setLegResult(legs[1].id, "won");
    setLegResult(legs[2].id, "won");
    const updated = listAccaRuns().find((r) => r.run.id === run.id)!.run;
    expect(updated.status).toBe("completed");
    expect(updated.wholeLayBetId).toBeNull();
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(-10);
  });

  it("markAccaNoLay flips an active combined run and blocks later whole lays", () => {
    const { run, legs } = createAccaRun({
      ...THREE_FOLD,
      method: "combined",
    });
    const marked = markAccaNoLay(run.id);
    expect(marked?.noLay).toBe(1);
    expect(logWholeLay(run.id, 7.5, 9.6)).toBeNull();

    setLegResult(legs[0].id, "lost");
    setLegResult(legs[1].id, "won");
    setLegResult(legs[2].id, "won");
    expect(bet(run.backBetId).actualProfit).toBe(-10);
    expect(listAccaRuns().find((r) => r.run.id === run.id)!.run.wholeLayBetId).toBeNull();
  });

  it("logLegLay with £0 stake records no lay without creating a bet", () => {
    const { run, legs } = createAccaRun(THREE_FOLD);
    const updated = logLegLay(legs[0].id, 2.5, 0);
    expect(updated?.layStake).toBe(0);
    expect(updated?.layOdds).toBe(0);
    expect(updated?.layBetId).toBeNull();
    expect(db.select().from(bets).all().filter((b) => b.betType === "lay_only")).toHaveLength(0);
    // Decision is logged: not lay-due anymore, results can settle the naked back.
    expect(legDueState(run, legs.map((l) => (l.id === updated!.id ? updated! : l)), updated!, Date.now()).due).toBe(
      false
    );
    const out = setLegResult(legs[0].id, "lost");
    expect(out?.runCompleted).toBe(true);
    expect(bet(run.backBetId).actualProfit).toBe(-10);
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

  it("persists leg sport/event and denormalises sport onto the back bet", () => {
    const { run, legs } = createAccaRun({
      label: "Racing 2-fold",
      method: "sequential",
      stake: 5,
      bookmaker: "Bet365",
      commission: 0,
      legs: [
        {
          label: "Horse A",
          backOdds: 3,
          sport: "horse_racing",
          market: "win",
          selection: "Horse A",
        },
        {
          label: "Horse B",
          backOdds: 2.5,
          sport: "horse_racing",
          market: "win",
          selection: "Horse B",
        },
      ],
    });
    expect(legs.every((l) => l.sport === "horse_racing")).toBe(true);
    expect(legs[0]!.market).toBe("win");
    expect(bet(run.backBetId).sport).toBe("horse_racing");
  });

  it("free_sr convert debits the free-bet lot", () => {
    const bookie = db
      .insert(accounts)
      .values({ name: "AccaSr Bookie", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Acca SR test",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();
    const { run } = createAccaRun({
      label: "FB SR 2-fold",
      method: "combined",
      stake: 10,
      bookmaker: "AccaSr Bookie",
      backBetType: "free_sr",
      noLay: true,
      commission: 0,
      legs: [
        { label: "A", backOdds: 2.0, sport: "football" },
        { label: "B", backOdds: 2.0, sport: "football" },
      ],
    });
    expect(bet(run.backBetId).betType).toBe("free_sr");
    expect(listFreeBetLots(bookie.id).reduce((s, l) => s + l.remaining, 0)).toBe(0);
    db.delete(balanceTransactions).where(eq(balanceTransactions.accountId, bookie.id)).run();
    db.delete(accounts).where(eq(accounts.id, bookie.id)).run();
  });

  it("free_snr convert debits the free-bet lot and loses at £0 P&L", () => {
    const bookie = db
      .insert(accounts)
      .values({ name: "AccaFb Bookie", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Acca convert test",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();
    expect(listFreeBetLots(bookie.id).reduce((s, l) => s + l.remaining, 0)).toBe(10);

    const { run, legs } = createAccaRun({
      label: "FB convert 2-fold",
      method: "sequential",
      stake: 10,
      bookmaker: "AccaFb Bookie",
      backBetType: "free_snr",
      commission: 0,
      legs: [
        { label: "A", backOdds: 2.0 },
        { label: "B", backOdds: 2.0 },
      ],
    });
    const back = bet(run.backBetId);
    expect(back.betType).toBe("free_snr");
    expect(back.balanceLedgered).toBe(1);
    expect(listFreeBetLots(bookie.id).reduce((s, l) => s + l.remaining, 0)).toBe(0);

    setLegResult(legs[0].id, "lost");
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(0);

    db.delete(balanceTransactions).where(eq(balanceTransactions.accountId, bookie.id)).run();
    db.delete(accounts).where(eq(accounts.id, bookie.id)).run();
  });
});

describe("acca-desk autoResultLinkedLegs", () => {
  beforeEach(reset);

  it("auto-results a horse racing win leg lost and completes sequential run", () => {
    const event = db
      .insert(events)
      .values({
        sport: "horse_racing",
        externalId: "test-race-1",
        competition: "Downpatrick",
        homeTeam: "Randox Rated Hurdle",
        awayTeam: "2:33",
        startTime: Date.now() - 60_000,
        status: "finished",
        homeScore: 1,
        awayScore: 0,
        goals: serializeRaceResults({
          winner: "Malbay Madness (IRE)",
          runners: [
            { horse: "Malbay Madness (IRE)", position: 1 },
            { horse: "Trasna Na Pairce (IRE)", position: 4 },
          ],
          fieldSize: 7,
          type: "Hurdle",
        }),
        source: "manual",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const { run, legs } = createAccaRun({
      label: "Racing convert",
      method: "sequential",
      stake: 10,
      commission: 0,
      backBetType: "free_snr",
      legs: [
        {
          label: "Trasna Na Pairce",
          backOdds: 4,
          eventId: event.id,
          sport: "horse_racing",
          market: "win",
          selection: "Trasna Na Pairce",
        },
        {
          label: "Gortmore Lady",
          backOdds: 5,
          sport: "horse_racing",
          market: "win",
          selection: "Gortmore Lady",
        },
      ],
    });
    logLegLay(legs[0]!.id, 4.4, 10);
    const laid = db.select().from(accaLegs).where(eq(accaLegs.id, legs[0]!.id)).get()!;

    expect(autoResultLinkedLegs()).toBe(1);

    const leg1 = db.select().from(accaLegs).where(eq(accaLegs.id, legs[0]!.id)).get()!;
    expect(leg1.result).toBe("lost");
    const completed = db.select().from(accaRuns).where(eq(accaRuns.id, run.id)).get()!;
    expect(completed.status).toBe("completed");
    expect(bet(run.backBetId).status).toBe("lost");
    expect(bet(run.backBetId).actualProfit).toBe(0);
    const lay = bet(laid.layBetId);
    expect(lay.status).toBe("won");
    expect(lay.actualProfit).toBeCloseTo(10, 2);
  });

  it("auto-results football match_odds (unchanged path)", () => {
    const event = db
      .insert(events)
      .values({
        sport: "football",
        externalId: "test-fb-1",
        competition: "PL",
        homeTeam: "Home FC",
        awayTeam: "Away FC",
        startTime: Date.now() - 60_000,
        status: "finished",
        homeScore: 0,
        awayScore: 1,
        homeLed2: 0,
        awayLed2: 0,
        source: "manual",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const { run, legs } = createAccaRun({
      label: "Footy",
      method: "sequential",
      stake: 10,
      commission: 0,
      legs: [
        {
          label: "Home",
          backOdds: 2,
          eventId: event.id,
          sport: "football",
          market: "match_odds",
          selection: "home",
        },
        { label: "Next", backOdds: 2 },
      ],
    });
    logLegLay(legs[0]!.id, 2.1, 10);
    expect(autoResultLinkedLegs()).toBe(1);
    expect(db.select().from(accaLegs).where(eq(accaLegs.id, legs[0]!.id)).get()!.result).toBe(
      "lost"
    );
    expect(db.select().from(accaRuns).where(eq(accaRuns.id, run.id)).get()!.status).toBe(
      "completed"
    );
  });
});

describe("acca-desk updateAccaRun", () => {
  beforeEach(reset);

  it("updates label, bookmaker and legs before any lays", () => {
    const { run, legs } = createAccaRun({ ...THREE_FOLD, bookmaker: null });
    const view = updateAccaRun(run.id, {
      label: "Renamed",
      bookmaker: "Ivybet",
      stake: 20,
      commission: 0.02,
      legs: [
        { id: legs[0]!.id, label: "Alpha", backOdds: 2.1, scheduledAt: null },
        { id: legs[1]!.id, label: "Beta", backOdds: 2.0, scheduledAt: null },
        { id: legs[2]!.id, label: "Gamma", backOdds: 1.9, scheduledAt: null },
      ],
    });
    expect(view?.run.label).toBe("Renamed");
    expect(view?.run.bookmaker).toBe("Ivybet");
    expect(view?.run.stake).toBe(20);
    expect(view?.legs.map((l) => l.label)).toEqual(["Alpha", "Beta", "Gamma"]);
    const back = bet(run.backBetId);
    expect(back.label).toBe("Acca · Renamed");
    expect(back.bookmaker).toBe("Ivybet");
    expect(back.backStake).toBe(20);
    expect(back.backOdds).toBeCloseTo(2.1 * 2.0 * 1.9, 4);
  });

  it("locks stake and odds once a lay is logged, but still allows bookmaker", () => {
    const { run, legs } = createAccaRun(THREE_FOLD);
    logLegLay(legs[0]!.id, 2.02, 10);
    const view = updateAccaRun(run.id, {
      label: "After lay",
      bookmaker: "Sky Bet",
      stake: 99,
      legs: legs.map((l) => ({
        id: l.id,
        label: `${l.label} x`,
        backOdds: l.backOdds,
        scheduledAt: l.scheduledAt,
      })),
    });
    expect(view?.run.label).toBe("After lay");
    expect(view?.run.bookmaker).toBe("Sky Bet");
    expect(view?.run.stake).toBe(10);
    expect(view?.legs[0]?.label).toBe("A x");
    expect(bet(run.backBetId).backStake).toBe(10);
    expect(bet(run.backBetId).bookmaker).toBe("Sky Bet");
  });
});
