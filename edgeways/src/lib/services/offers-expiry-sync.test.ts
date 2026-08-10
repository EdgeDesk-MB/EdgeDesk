import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { accounts, balanceTransactions, db, bets, offers, type OfferRow } from "@/lib/db";
import { syncOfferStatuses } from "./offers";
import { localYmd } from "@/lib/offers/offer-recurrence-shared";
import { ukDateTimeToUtcMs } from "@/lib/offers/offer-expiry";

function insertOffer(
  over: Partial<
    Pick<
      OfferRow,
      "status" | "startsOn" | "expiresAt" | "eventDate" | "scopeRaceId" | "scopeRaceLabel" | "sport"
    >
  > = {}
): OfferRow {
  return db
    .insert(offers)
    .values({
      title: "Bet £10 get £10 free bet",
      bookmaker: "Tote",
      status: over.status ?? "active",
      startsOn: over.startsOn ?? null,
      expiresAt: over.expiresAt ?? null,
      eventDate: over.eventDate ?? null,
      scopeRaceId: over.scopeRaceId ?? null,
      scopeRaceLabel: over.scopeRaceLabel ?? null,
      sport: over.sport ?? "horse_racing",
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function statusOf(id: number): string | undefined {
  return db.select().from(offers).where(eq(offers.id, id)).get()?.status;
}

/** Today's racing day, plus a UK wall-clock time on it. */
function todayAt(hours: number, minutes: number): number {
  return ukDateTimeToUtcMs(localYmd(new Date()), hours, minutes)!;
}

beforeEach(() => {
  db.delete(bets).run();
  db.delete(offers).run();
});

describe("syncOfferStatuses - race-scoped deadlines", () => {
  it("keeps an offer live when its race is later today", () => {
    const later = new Date(Date.now() + 3 * 3_600_000);
    // Only meaningful while the off-time is still ahead of us today; near
    // midnight now+3h rolls into tomorrow and the off-time would be past.
    if (localYmd(later) !== localYmd(new Date())) return;
    const hh = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hour12: false,
      }).format(later)
    );

    const offer = insertOffer({
      status: "active",
      eventDate: localYmd(new Date()),
      scopeRaceId: "rac_1",
      scopeRaceLabel: `${hh}:30 · Later Today Handicap`,
      expiresAt: todayAt(23, 59),
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("active");
  });

  it("expires an offer once its race has gone off", () => {
    const offer = insertOffer({
      status: "active",
      eventDate: localYmd(new Date(Date.now() - 2 * 86_400_000)),
      scopeRaceId: "rac_1",
      scopeRaceLabel: "1:50 · Two Days Ago Handicap",
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("expired");
  });
});

describe("syncOfferStatuses - repairing offers expired too early", () => {
  it("restores an offer whose deadline is now in the future", () => {
    const offer = insertOffer({
      status: "expired",
      expiresAt: Date.now() + 7 * 86_400_000,
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("active");
  });

  it("returns it to planned when its startsOn has not arrived", () => {
    const offer = insertOffer({
      status: "expired",
      startsOn: localYmd(new Date(Date.now() + 5 * 86_400_000)),
      expiresAt: Date.now() + 30 * 86_400_000,
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("planned");
  });

  it("leaves a genuinely past-deadline offer expired", () => {
    const offer = insertOffer({
      status: "expired",
      expiresAt: Date.now() - 86_400_000,
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("expired");
  });

  it("leaves a manual expire with no deadline alone", () => {
    const offer = insertOffer({
      status: "expired",
      expiresAt: null,
      eventDate: null,
      sport: null,
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("expired");
  });

  it("completes a past-deadline offer that already has settled bets (not Missed race)", () => {
    const offer = insertOffer({
      status: "expired",
      eventDate: localYmd(new Date(Date.now() - 2 * 86_400_000)),
      scopeRaceId: "rac_played",
      scopeRaceLabel: "17:45 · Musselburgh Handicap",
    });
    db.insert(bets)
      .values({
        label: "Musselburgh · Sophiesticate · place refund",
        market: "win",
        selection: "Sophiesticate",
        betType: "qualifying",
        bookmaker: "Betfair Sportsbook",
        backStake: 50,
        backOdds: 5,
        layStake: 47.17,
        layOdds: 5.3,
        commission: 0.02,
        status: "won",
        actualProfit: -2.83,
        offerId: offer.id,
        triggerText: "Bet £50 get £50 free bet (2nd, 3rd, 4th)",
        createdAt: Date.now() - 86_400_000,
      })
      .run();

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("completed");
  });
});

describe("syncOfferStatuses - past deadline with play", () => {
  it("marks a settled place-refund day completed, not expired", () => {
    const offer = insertOffer({
      status: "active",
      eventDate: localYmd(new Date(Date.now() - 2 * 86_400_000)),
      scopeRaceId: "rac_1",
      scopeRaceLabel: "17:45 · Two Days Ago Handicap",
    });
    db.insert(bets)
      .values({
        label: "Qualify · place refund",
        market: "win",
        selection: "Runner",
        betType: "qualifying",
        bookmaker: "Betfair Sportsbook",
        backStake: 50,
        backOdds: 5,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "won",
        actualProfit: -2.83,
        offerId: offer.id,
        triggerText: "Bet £50 get £50 free bet (2nd, 3rd, 4th)",
        createdAt: Date.now() - 86_400_000,
      })
      .run();

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("completed");
  });

  it("still expires an unused race-scoped day as Missed race", () => {
    const offer = insertOffer({
      status: "active",
      eventDate: localYmd(new Date(Date.now() - 2 * 86_400_000)),
      scopeRaceId: "rac_unused",
      scopeRaceLabel: "1:50 · Unused Handicap",
    });

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("expired");
  });

  it("keeps a manual expire when a free bet is still awarded (not converted)", () => {
    const offer = insertOffer({
      status: "expired",
      expiresAt: Date.now() - 1_000,
    });
    const bet = db
      .insert(bets)
      .values({
        label: "Qualify · place refund",
        market: "win",
        selection: "Runner",
        betType: "qualifying",
        bookmaker: "Expire Keep Tote",
        backStake: 10,
        backOdds: 5,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "lost",
        actualProfit: -0.46,
        offerId: offer.id,
        triggerText: "Bet £10 get £10FB 2nd",
        createdAt: Date.now() - 86_400_000,
      })
      .returning()
      .get();
    // Promo award keeps freeBetStage = awarded → campaign incomplete.
    const bookie = db
      .insert(accounts)
      .values({ name: "Expire Keep Tote", type: "bookie", createdAt: Date.now() })
      .returning()
      .get();
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        betId: bet.id,
        note: "Free bet promo - Finished 2nd (Bet £10 get £10FB 2nd)",
        createdAt: Date.now(),
      })
      .run();

    syncOfferStatuses();

    expect(statusOf(offer.id)).toBe("expired");

    db.delete(balanceTransactions).where(eq(balanceTransactions.betId, bet.id)).run();
    db.delete(accounts).where(eq(accounts.id, bookie.id)).run();
  });
});
