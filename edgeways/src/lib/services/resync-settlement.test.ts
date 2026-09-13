import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  accounts,
  balanceTransactions,
  bets,
  db,
  events,
  type BetRow,
} from "@/lib/db";
import { serializeRaceResults } from "@/lib/racing";
import { sumFreeBetLotBalance } from "@/lib/accounts/free-bet-lot-balance";
import {
  applyFreeBetEffectsForBet,
  resyncSettledBetAgainstEvent,
  resyncStaleSettlements,
} from "./resync-settlement";

const LABEL = "Resync Winner Al Jabbar";

const RACE = {
  winner: "Al Jabbar",
  runners: [
    { horse: "Al Jabbar", position: 1 },
    { horse: "Second", position: 2 },
    { horse: "Third", position: 3 },
    { horse: "Fourth", position: 4 },
    { horse: "Berkshire Regal", position: 5 },
  ],
  fieldSize: 5,
};

function insertRace() {
  return db
    .insert(events)
    .values({
      sport: "horse_racing",
      competition: "Doncaster",
      homeTeam: "Doncaster 13:10",
      awayTeam: "",
      startTime: Date.now() - 86_400_000,
      status: "finished",
      homeScore: 1,
      awayScore: 0,
      goals: serializeRaceResults(RACE),
      source: "manual",
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function insertBookie() {
  return db
    .insert(accounts)
    .values({
      name: "Resync Risk Free Bookie",
      type: "bookie",
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function insertWrongHorseWin(eventId: number, bookmaker: string): BetRow {
  // Hand-worked: £10 @ 9.00, no lay. Win +£80, lose −£10. Refund £10 if the bet loses.
  return db
    .insert(bets)
    .values({
      label: LABEL,
      market: "win",
      selection: "Al Jabbar",
      betType: "risk_free",
      bookmaker,
      backStake: 10,
      backOdds: 9,
      layStake: 0,
      layOdds: 0,
      commission: 0.02,
      refundAmount: 10,
      refundRetention: 0.7,
      status: "won",
      actualProfit: 80,
      settledAt: Date.now(),
      eventId,
      sport: "horse_racing",
      triggerText: "Bet £10 get £10 free bet if bet loses",
      triggerRule: JSON.stringify({
        v: 2,
        betWin: null,
        effects: [
          { kind: "free_bet_award", amount: 10, positions: [], awardOnLoss: true },
        ],
      }),
      balanceLedgered: 1,
      balanceSettled: 1,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

beforeEach(() => {
  for (const b of db.select().from(bets).all()) {
    if (b.label !== LABEL) continue;
    for (const t of db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((tx) => tx.betId === b.id)) {
      db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
    }
    db.delete(bets).where(eq(bets.id, b.id)).run();
  }
  for (const e of db.select().from(events).all()) {
    if (e.homeTeam !== "Doncaster 13:10") continue;
    db.delete(events).where(eq(events.id, e.id)).run();
  }
  for (const a of db.select().from(accounts).all()) {
    if (a.name !== "Resync Risk Free Bookie") continue;
    for (const t of db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((tx) => tx.accountId === a.id)) {
      db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
    }
    db.delete(accounts).where(eq(accounts.id, a.id)).run();
  }
});

describe("resyncSettledBetAgainstEvent", () => {
  it("re-settles a risk-free win as a loss after the runner is corrected", () => {
    const event = insertRace();
    const bookie = insertBookie();
    const original = insertWrongHorseWin(event.id, bookie.name);

    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 90,
        category: "bet_settlement",
        note: `back won - ${LABEL}`,
        betId: original.id,
        createdAt: Date.now(),
      })
      .run();

    db.update(bets)
      .set({ selection: "Berkshire Regal" })
      .where(eq(bets.id, original.id))
      .run();
    const edited = db.select().from(bets).where(eq(bets.id, original.id)).get()!;

    const updated = resyncSettledBetAgainstEvent(edited, event);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("lost");
    expect(updated!.actualProfit).toBe(-10);
    expect(
      db
        .select()
        .from(balanceTransactions)
        .all()
        .filter((t) => t.betId === original.id && t.category === "bet_settlement")
    ).toHaveLength(0);
    // Cash resync does not mint the promo; the settlement award pass does.
    expect(sumFreeBetLotBalance(bookie.id)).toBe(0);

    applyFreeBetEffectsForBet(updated!, event);
    expect(sumFreeBetLotBalance(bookie.id)).toBe(10);
  });

  it("is a no-op when the stored result already matches the current runner", () => {
    const event = insertRace();
    const bookie = insertBookie();
    const original = insertWrongHorseWin(event.id, bookie.name);
    expect(resyncSettledBetAgainstEvent(original, event)).toBeNull();
    expect(db.select().from(bets).where(eq(bets.id, original.id)).get()?.status).toBe(
      "won"
    );
    expect(sumFreeBetLotBalance(bookie.id)).toBe(0);
  });

  it("picks up a desk-wide selection mismatch on the next poll", () => {
    const event = insertRace();
    const bookie = insertBookie();
    const original = insertWrongHorseWin(event.id, bookie.name);
    db.update(bets)
      .set({ selection: "Berkshire Regal" })
      .where(eq(bets.id, original.id))
      .run();

    expect(resyncStaleSettlements()).toBe(1);
    const updated = db.select().from(bets).where(eq(bets.id, original.id)).get()!;
    expect(updated.status).toBe("lost");
    expect(sumFreeBetLotBalance(bookie.id)).toBe(0);
    applyFreeBetEffectsForBet(updated, event);
    expect(sumFreeBetLotBalance(bookie.id)).toBe(10);
  });

  it("credits a risk-free refund from stored refundAmount when there is no trigger text", () => {
    const event = insertRace();
    const bookie = insertBookie();
    const original = insertWrongHorseWin(event.id, bookie.name);
    db.update(bets)
      .set({
        selection: "Berkshire Regal",
        triggerText: null,
        triggerRule: null,
      })
      .where(eq(bets.id, original.id))
      .run();
    const edited = db.select().from(bets).where(eq(bets.id, original.id)).get()!;
    const updated = resyncSettledBetAgainstEvent(edited, event)!;
    expect(updated.status).toBe("lost");
    applyFreeBetEffectsForBet(updated, event);
    expect(sumFreeBetLotBalance(bookie.id)).toBe(10);
  });

  it("reverses a loss-only free bet when the runner is corrected to the winner", () => {
    const event = insertRace();
    const bookie = insertBookie();
    const original = insertWrongHorseWin(event.id, bookie.name);
    db.update(bets)
      .set({
        selection: "Berkshire Regal",
        status: "lost",
        actualProfit: -10,
      })
      .where(eq(bets.id, original.id))
      .run();
    const lost = db.select().from(bets).where(eq(bets.id, original.id)).get()!;
    applyFreeBetEffectsForBet(lost, event);
    expect(sumFreeBetLotBalance(bookie.id)).toBe(10);

    db.update(bets)
      .set({ selection: "Al Jabbar" })
      .where(eq(bets.id, original.id))
      .run();
    const edited = db.select().from(bets).where(eq(bets.id, original.id)).get()!;
    const updated = resyncSettledBetAgainstEvent(edited, event);
    expect(updated!.status).toBe("won");
    expect(updated!.actualProfit).toBe(80);
    expect(sumFreeBetLotBalance(bookie.id)).toBe(0);
  });
});
