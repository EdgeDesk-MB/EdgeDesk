import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  computeOfferProfitBreakdown,
  isOfferCampaignComplete,
  normalizeOfferTitleKey,
  resolveOfferForFreeBetUsage,
  summariseOffer,
} from "./offers";
import {
  canManuallyCompleteOffer,
  offerManualCompleteBlockedReason,
} from "@/lib/offers/offer-complete";
import { db, accounts, bets, offers, balanceTransactions, type BetRow, type OfferRow } from "@/lib/db";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id">): BetRow {
  return {
    eventId: null,
    label: "Test",
    market: "win",
    selection: "Horse",
    betType: "qualifying",
    bookmaker: "Betfair Sportsbook",
    exchangeId: null,
    backStake: 50,
    backOdds: 8,
    layStake: 48,
    layOdds: 8.2,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th",
    triggerRule: null,
    status: "lost",
    expectedProfit: 32,
    actualProfit: -1.51,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: 1,
    settledAt: 2,
    offerId: 1,
    ...partial,
  };
}

describe("normalizeOfferTitleKey", () => {
  it("treats free bet / FB and place ordinals as equivalent", () => {
    const a = normalizeOfferTitleKey("Bet £50 get £50 free bet (3rd, 4th)");
    const b = normalizeOfferTitleKey("Bet £50 get £50FB 2nd, 3rd, 4th");
    // Same stake language; place lists differ so keys are not identical -
    // but both collapse FB wording and ordinals.
    expect(a).toContain("£50");
    expect(a).toContain("fb");
    expect(b).toContain("fb");
    expect(normalizeOfferTitleKey("Bet £50 get £50 FB")).toBe(
      normalizeOfferTitleKey("Bet £50 get £50 free bet")
    );
  });
});

describe("computeOfferProfitBreakdown", () => {
  it("splits qualifying loss from free bet conversion profit", () => {
    const linked = [
      bet({ id: 1, betType: "qualifying", actualProfit: -1.51, status: "lost" }),
      bet({
        id: 2,
        betType: "free_snr",
        actualProfit: 42,
        status: "won",
        triggerText: null,
      }),
    ];
    const promo = { 1: { amount: 50, reason: "Finished 3rd" } };

    const breakdown = computeOfferProfitBreakdown(linked, promo);

    expect(breakdown.qualifyingProfit).toBe(-1.51);
    expect(breakdown.freeBetAwarded).toBe(true);
    expect(breakdown.freeBetAwardAmount).toBe(50);
    expect(breakdown.freeBetProfit).toBe(42);
    expect(breakdown.totalProfit).toBeCloseTo(40.49);
    expect(breakdown.freeBetStage).toBe("settled");
  });

  it("shows awarded but unused free bet", () => {
    const linked = [bet({ id: 1, actualProfit: -1.51, status: "lost" })];
    const promo = { 1: { amount: 50, reason: "Finished 2nd" } };

    const breakdown = computeOfferProfitBreakdown(linked, promo);

    expect(breakdown.freeBetAwarded).toBe(true);
    expect(breakdown.freeBetProfit).toBe(0);
    expect(breakdown.totalProfit).toBe(-1.51);
    expect(breakdown.freeBetStage).toBe("awarded");
  });

  it("shows not awarded when place-refund qualifying settles without promo", () => {
    const linked = [
      bet({
        id: 1,
        actualProfit: -2,
        status: "lost",
        label: "Place refund qual",
        triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th",
      }),
    ];

    const breakdown = computeOfferProfitBreakdown(linked, {});

    expect(breakdown.freeBetAwarded).toBe(false);
    expect(breakdown.freeBetStage).toBe("not_awarded");
    expect(breakdown.totalProfit).toBe(-2);
  });

  it("includes open free-bet worst-case expected in totalProfit", () => {
    const linked = [
      bet({ id: 1, betType: "qualifying", actualProfit: -3.39, status: "lost" }),
      bet({
        id: 2,
        betType: "free_snr",
        status: "open",
        actualProfit: null,
        expectedProfit: 18.75,
      }),
    ];
    const promo = { 1: { amount: 50, reason: "Finished 2nd" } };
    const breakdown = computeOfferProfitBreakdown(linked, promo);

    expect(breakdown.qualifyingProfit).toBe(-3.39);
    expect(breakdown.freeBetProfit).toBe(0);
    expect(breakdown.openExpectedProfit).toBe(18.75);
    expect(breakdown.totalProfit).toBeCloseTo(15.36);
    expect(breakdown.freeBetStage).toBe("in_use");
  });
});

describe("resolveOfferForFreeBetUsage", () => {
  it("treats unconditional Bet £X get £Y FB as awarded without wallet credit", () => {
    const linked = [
      bet({
        id: 1,
        label: "Bet £50 get £20 FB",
        status: "lost",
        actualProfit: -1.22,
        bookmaker: null,
      }),
    ];
    const profit = computeOfferProfitBreakdown(linked, {});
    expect(profit.freeBetStage).toBe("awarded");
    expect(profit.freeBetAwardAmount).toBe(20);
  });

  it("never links a free bet to a different bookie's awarded campaign", () => {
    const offer = db
      .insert(offers)
      .values({
        title: "Bet £50 get £50FB 2nd, 3rd, 4th",
        bookmaker: "Betfair Sportsbook",
        status: "active",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const qual = db
      .insert(bets)
      .values({
        label: "Bet £50 get £50FB 2nd, 3rd, 4th",
        market: "win",
        selection: "Horse",
        betType: "qualifying",
        bookmaker: "Betfair Sportsbook",
        backStake: 50,
        backOdds: 5,
        layStake: 47,
        layOdds: 5.3,
        commission: 0,
        status: "lost",
        actualProfit: -2.83,
        offerId: offer.id,
        balanceLedgered: 1,
        balanceSettled: 1,
        createdAt: Date.now(),
        settledAt: Date.now(),
      })
      .returning()
      .get();

    const bookie = db
      .insert(accounts)
      .values({
        name: "Betfair Sportsbook",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 50,
        category: "free_bet",
        betId: qual.id,
        note: "Free bet promo - Finished 2nd",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();

    expect(
      resolveOfferForFreeBetUsage({
        betType: "free_snr",
        bookmaker: "InBet Bookie",
        backStake: 50,
      })
    ).toBeNull();

    expect(
      resolveOfferForFreeBetUsage({
        betType: "free_snr",
        bookmaker: "Betfair Sportsbook",
        backStake: 50,
      })
    ).toBe(offer.id);

    db.delete(balanceTransactions).where(eq(balanceTransactions.accountId, bookie.id)).run();
    db.delete(bets).where(eq(bets.id, qual.id)).run();
    db.delete(offers).where(eq(offers.id, offer.id)).run();
    db.delete(accounts).where(eq(accounts.id, bookie.id)).run();
  });
});

describe("isOfferCampaignComplete", () => {
  it("does not complete when free bet is awarded but unused", () => {
    const linked = [
      bet({
        id: 1,
        label: "Bet £50 get £20 FB",
        status: "lost",
        actualProfit: -1.22,
      }),
    ];
    const profit = computeOfferProfitBreakdown(linked, {});
    expect(profit.freeBetStage).toBe("awarded");
    expect(isOfferCampaignComplete(linked, profit)).toBe(false);
  });

  it("completes when free bet conversion is settled", () => {
    const linked = [
      bet({ id: 1, label: "Bet £50 get £20 FB", status: "lost", actualProfit: -1.22 }),
      bet({
        id: 2,
        betType: "free_snr",
        label: "£20 SNR",
        status: "won",
        actualProfit: 15,
        triggerText: null,
      }),
    ];
    const profit = computeOfferProfitBreakdown(linked, {
      1: { amount: 20, reason: "Offer unlocked" },
    });
    expect(profit.freeBetStage).toBe("settled");
    expect(isOfferCampaignComplete(linked, profit)).toBe(true);
  });
});

function offerRow(partial: Partial<OfferRow> & Pick<OfferRow, "id">): OfferRow {
  return {
    bookmaker: "Betfair Sportsbook",
    title: "Bet £50 get £50FB 2nd, 3rd, 4th",
    description: null,
    expectedProfit: 32,
    status: "active",
    expiresAt: null,
    sport: "horse_racing",
    offerType: null,
    scopeCourse: null,
    eventDate: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    rules: null,
    completedAt: null,
    createdAt: 1,
    ...partial,
  };
}

describe("canManuallyCompleteOffer", () => {
  it("blocks completion when free bet is awarded but not converted", () => {
    const linked = [bet({ id: 1, actualProfit: -2.83, status: "lost" })];
    const summary = summariseOffer(offerRow({ id: 1 }), linked, {
      1: { amount: 50, reason: "Offer unlocked" },
    });

    expect(canManuallyCompleteOffer(summary)).toBe(false);
    expect(offerManualCompleteBlockedReason(summary)).toContain("Convert your £50.00 free bet");
  });

  it("allows completion when free bet conversion is settled", () => {
    const linked = [
      bet({ id: 1, actualProfit: -2.83, status: "lost" }),
      bet({
        id: 2,
        betType: "free_snr",
        status: "won",
        actualProfit: 40,
        triggerText: null,
      }),
    ];
    const summary = summariseOffer(offerRow({ id: 1 }), linked, {
      1: { amount: 50, reason: "Offer unlocked" },
    });

    expect(canManuallyCompleteOffer(summary)).toBe(true);
    expect(offerManualCompleteBlockedReason(summary)).toBeNull();
  });
});

describe("backfillOffersFromBets (E3 import provenance)", () => {
  it("never links or creates offers from imported history", async () => {
    const { backfillOffersFromBets } = await import("./offers");
    const before = db.select().from(offers).all().length;

    const imported = db
      .insert(bets)
      .values({
        label: "Bet £25 get £25 free bet",
        market: "win",
        betType: "qualifying",
        bookmaker: "Coral",
        backStake: 25,
        backOdds: 4,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "lost",
        actualProfit: -1.5,
        balanceLedgered: 1,
        balanceSettled: 1,
        source: "import",
        createdAt: Date.now(),
        settledAt: Date.now(),
      })
      .returning()
      .get();

    backfillOffersFromBets();

    const after = db.select().from(bets).where(eq(bets.id, imported.id)).get();
    expect(after?.offerId).toBeNull();
    // No campaign was invented from imported history either
    expect(db.select().from(offers).all().length).toBe(before);
  });
});
