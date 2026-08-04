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
import { parseTriggerBundle } from "@/lib/calc/ai-triggers";
import {
  betNeedsPlaceTriggerRepair,
  repairMisparsedPlaceFreeBetTriggers,
} from "./repair-place-free-bet-triggers";

function insertFinishedRace(winner: string, second: string) {
  return db
    .insert(events)
    .values({
      sport: "horse_racing",
      competition: "Test",
      homeTeam: "Test Handicap",
      awayTeam: "",
      startTime: Date.now() - 86_400_000,
      status: "finished",
      homeScore: 1,
      awayScore: 0,
      goals: JSON.stringify({
        kind: "horse_racing",
        winner,
        runners: [
          { horse: winner, position: 1 },
          { horse: second, position: 2 },
          { horse: "Also Ran", position: 3 },
          { horse: "Last", position: 4 },
        ],
        fieldSize: 4,
      }),
      source: "manual",
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function insertBookie(name: string) {
  return db
    .insert(accounts)
    .values({ name, type: "bookie", createdAt: Date.now() })
    .returning()
    .get();
}

function insertMisparsedBet(
  over: Partial<BetRow> & {
    selection: string;
    eventId: number;
    status: BetRow["status"];
    bookmaker: string;
  }
) {
  return db
    .insert(bets)
    .values({
      label: `Course · ${over.selection} · Bet £50 get £50 free bet (2nd, 3rd, 4th)`,
      market: "win",
      selection: over.selection,
      betType: "qualifying",
      bookmaker: over.bookmaker,
      backStake: 50,
      backOdds: 5,
      layStake: 0,
      layOdds: 0,
      commission: 0,
      status: over.status,
      eventId: over.eventId,
      triggerText: `Course · ${over.selection} · Bet £50 get £50 free bet (2nd, 3rd, 4th)`,
      triggerRule: JSON.stringify({
        v: 2,
        betWin: null,
        effects: [{ kind: "free_bet_award", amount: 50, positions: [] }],
      }),
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function creditOfferUnlocked(bet: BetRow, accountId: number) {
  return db
    .insert(balanceTransactions)
    .values({
      accountId,
      amount: 50,
      category: "free_bet",
      betId: bet.id,
      note: `Free bet promo - Offer unlocked (${bet.label})`,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

beforeEach(() => {
  for (const b of db.select().from(bets).all()) {
    if (!b.label.includes("Bet £50 get £50 free bet (2nd, 3rd, 4th)")) continue;
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
    if (e.homeTeam !== "Test Handicap") continue;
    db.delete(events).where(eq(events.id, e.id)).run();
  }
  for (const a of db.select().from(accounts).all()) {
    if (!a.name.startsWith("Repair Place ")) continue;
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

describe("betNeedsPlaceTriggerRepair", () => {
  it("detects unconditional storage of a place-refund label", () => {
    expect(
      betNeedsPlaceTriggerRepair({
        triggerRule: JSON.stringify({
          v: 2,
          betWin: null,
          effects: [{ kind: "free_bet_award", amount: 50, positions: [] }],
        }),
        triggerText: "Musselburgh · Sophiesticate · Bet £50 get £50 free bet (2nd, 3rd, 4th)",
        label: "Musselburgh · Sophiesticate · Bet £50 get £50 free bet (2nd, 3rd, 4th)",
      })
    ).toBe(true);
  });

  it("ignores genuine unconditional free bets", () => {
    expect(
      betNeedsPlaceTriggerRepair({
        triggerRule: JSON.stringify({
          v: 2,
          betWin: null,
          effects: [{ kind: "free_bet_award", amount: 10, positions: [] }],
        }),
        triggerText: "Bet £10 get £10 free bet",
        label: "Qualify · Betfair Sportsbook",
      })
    ).toBe(false);
  });
});

describe("repairMisparsedPlaceFreeBetTriggers", () => {
  it("rewrites the trigger and reverses Offer unlocked when the horse won (1st)", () => {
    const event = insertFinishedRace("Sophiesticate", "Gemini Man");
    const bookie = insertBookie("Repair Place Win");
    const bet = insertMisparsedBet({
      selection: "Sophiesticate",
      eventId: event.id,
      status: "won",
      bookmaker: bookie.name,
    });
    const credit = creditOfferUnlocked(bet, bookie.id);

    const result = repairMisparsedPlaceFreeBetTriggers();

    expect(result.rulesFixed).toBe(1);
    expect(result.creditsReversed).toBe(1);
    const rule = parseTriggerBundle(
      db.select().from(bets).where(eq(bets.id, bet.id)).get()?.triggerRule
    );
    expect(rule.effects[0]).toMatchObject({
      kind: "free_bet_award",
      amount: 50,
      positions: [2, 3, 4],
    });
    expect(
      db.select().from(balanceTransactions).where(eq(balanceTransactions.id, credit.id)).get()
    ).toBeUndefined();
  });

  it("keeps the credit when the horse finished in a qualifying place", () => {
    const event = insertFinishedRace("Winner", "Place Horse");
    const bookie = insertBookie("Repair Place Keep");
    const bet = insertMisparsedBet({
      selection: "Place Horse",
      eventId: event.id,
      status: "lost",
      bookmaker: bookie.name,
    });
    const credit = creditOfferUnlocked(bet, bookie.id);

    const result = repairMisparsedPlaceFreeBetTriggers();

    expect(result.rulesFixed).toBe(1);
    expect(result.creditsReversed).toBe(0);
    expect(
      db.select().from(balanceTransactions).where(eq(balanceTransactions.id, credit.id)).get()
    ).toBeDefined();
  });

  it("reverses leftover Offer unlocked after the rule was already repaired", () => {
    const event = insertFinishedRace("Sophiesticate", "Gemini Man");
    const bookie = insertBookie("Repair Place Leftover");
    const bet = insertMisparsedBet({
      selection: "Sophiesticate",
      eventId: event.id,
      status: "won",
      bookmaker: bookie.name,
    });
    // Simulate an earlier pass that fixed positions but left the credit.
    db.update(bets)
      .set({
        triggerRule: JSON.stringify({
          v: 2,
          betWin: null,
          effects: [{ kind: "free_bet_award", amount: 50, positions: [2, 3, 4] }],
        }),
      })
      .where(eq(bets.id, bet.id))
      .run();
    const credit = creditOfferUnlocked(bet, bookie.id);

    const result = repairMisparsedPlaceFreeBetTriggers();

    expect(result.rulesFixed).toBe(0);
    expect(result.creditsReversed).toBe(1);
    expect(
      db.select().from(balanceTransactions).where(eq(balanceTransactions.id, credit.id)).get()
    ).toBeUndefined();
  });
});
