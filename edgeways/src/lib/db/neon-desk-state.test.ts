import { describe, expect, it } from "vitest";
import {
  appStateFromNeonBets,
  appStateFromNeonDesk,
} from "@/lib/db/neon-desk-state-map";
import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
  CasinoOfferRow,
  HistoryRow,
  OfferRow,
} from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/services/settings-shared";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id" | "label" | "status">): BetRow {
  return {
    eventId: null,
    market: "match_odds",
    selection: "",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 10,
    backOdds: 2,
    layStake: 0,
    layOdds: 0,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    expectedProfit: 0.4,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: 1_700_000_000_000,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: "football",
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

describe("appStateFromNeonBets", () => {
  it("returns an empty desk without touching SQLite", () => {
    const state = appStateFromNeonBets([]);
    expect(state.bets).toEqual([]);
    expect(state.settledProfit).toBe(0);
    expect(state.offers).toEqual([]);
    expect(state.balances.accounts).toEqual([]);
    expect(state.demoMode).toBe(false);
    expect(state.settings.ageConfirmedAt).toBeNull();
  });

  it("keeps a hosted age confirmation on the snapshot", () => {
    const state = appStateFromNeonBets([], {
      ...DEFAULT_SETTINGS,
      ageConfirmedAt: 1_754_870_400_000,
    });
    expect(state.settings.ageConfirmedAt).toBe(1_754_870_400_000);
  });

  it("shows a hosted bet and settled P&L", () => {
    const state = appStateFromNeonBets([
      bet({
        id: 1,
        label: "Man Utd",
        status: "won",
        actualProfit: 1.25,
        settledAt: 1_700_000_100_000,
      }),
      bet({
        id: 2,
        label: "Open",
        status: "open",
        expectedProfit: 0.5,
        createdAt: 1_700_000_200_000,
      }),
    ]);
    expect(state.bets.map((b) => b.label)).toEqual(["Open", "Man Utd"]);
    expect(state.settledProfit).toBe(1.25);
    expect(state.series).toHaveLength(1);
    expect(state.series[0]?.value).toBe(1.25);
    expect(state.provisionalProfit).toBe(0.5);
  });
});

function offer(partial: Partial<OfferRow> & Pick<OfferRow, "id" | "title">): OfferRow {
  return {
    bookmaker: "Bet365",
    description: null,
    expectedProfit: 8,
    status: "active",
    expiresAt: null,
    createdAt: 1_700_000_000_000,
    completedAt: null,
    startsOn: null,
    sport: "football",
    offerType: null,
    scopeCourse: null,
    eventDate: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    rules: null,
    seriesId: null,
    instanceDate: null,
    source: null,
    offerUrl: null,
    ...partial,
  };
}

function account(
  partial: Partial<AccountRow> & Pick<AccountRow, "id" | "name" | "type">
): AccountRow {
  return {
    exchangeId: null,
    fundedByAccountId: null,
    brandColor: null,
    owner: "me",
    isActive: 1,
    accessStatus: "available",
    notes: null,
    wrRemaining: 0,
    wrMinOdds: null,
    wrType: "stake",
    health: null,
    healthUpdatedAt: null,
    createdAt: 1_700_000_000_000,
    ...partial,
  };
}

function tx(
  partial: Partial<BalanceTransactionRow> &
    Pick<BalanceTransactionRow, "id" | "accountId" | "amount" | "category">
): BalanceTransactionRow {
  return {
    betId: null,
    casinoOfferId: null,
    transferGroupId: null,
    pending: 0,
    note: null,
    createdAt: 1_700_000_000_000,
    confirmedAt: null,
    affectPnl: 0,
    expiresAt: null,
    ...partial,
  };
}

function historyRow(
  partial: Partial<HistoryRow> & Pick<HistoryRow, "id" | "dedupe" | "kind" | "title">
): HistoryRow {
  return {
    eventId: null,
    betId: null,
    minute: null,
    detail: null,
    note: null,
    amount: null,
    createdAt: 1_700_000_000_000,
    ...partial,
  };
}

describe("appStateFromNeonDesk", () => {
  it("treats a hosted refund-if promo credit as the awarded free bet", () => {
    const state = appStateFromNeonDesk({
      bets: [
        bet({
          id: 541,
          label: "Goodwood 1:25",
          status: "lost",
          betType: "risk_free",
          actualProfit: -35,
          offerId: 479,
          triggerText: "Bet £100 get £100 free bet if bet loses",
        }),
      ],
      offers: [offer({ id: 479, title: "Money back if bet loses", bookmaker: "BetMGM" })],
      accounts: [account({ id: 70, name: "BetMGM", type: "bookie" })],
      transactions: [
        tx({
          id: 9,
          accountId: 70,
          amount: 100,
          category: "free_bet",
          betId: 541,
          note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
        }),
      ],
    });
    const summary = state.offers[0]!;
    expect(summary.profit.freeBetAwarded).toBe(true);
    expect(summary.profit.freeBetAwardAmount).toBe(100);
    expect(summary.profit.freeBetStage).toBe("awarded");
    expect(state.promoAwards[541]).toEqual({
      amount: 100,
      reason: "Bet lost — money-back free bet",
    });
    expect(state.balances.accounts.find((a) => a.id === 70)?.freeBets).toBe(100);
  });

  it("summarises hosted offers with linked bets", () => {
    const state = appStateFromNeonDesk({
      bets: [
        bet({ id: 1, label: "Qualifier", status: "won", actualProfit: -0.4, offerId: 7 }),
        bet({ id: 2, label: "Other", status: "open", offerId: null }),
      ],
      offers: [offer({ id: 7, title: "Bet £10 get £10" })],
    });
    expect(state.offers).toHaveLength(1);
    const summary = state.offers[0]!;
    expect(summary.title).toBe("Bet £10 get £10");
    expect(summary.betCount).toBe(1);
    expect(summary.actualProfit).toBe(-0.4);
  });

  it("builds hosted balances from accounts and the ledger", () => {
    const state = appStateFromNeonDesk({
      bets: [],
      accounts: [
        account({ id: 1, name: "Bank", type: "bank" }),
        account({ id: 2, name: "Bet365", type: "bookie" }),
        account({ id: 3, name: "Archived", type: "bookie", isActive: 0 }),
      ],
      transactions: [
        tx({ id: 1, accountId: 1, amount: 100, category: "top_up" }),
        tx({ id: 2, accountId: 2, amount: 25, category: "top_up" }),
        tx({ id: 3, accountId: 3, amount: 999, category: "top_up" }),
      ],
    });
    expect(state.balances.banks).toBe(100);
    expect(state.balances.bookies).toBe(25);
    expect(state.balances.total).toBe(125);
    expect(state.balances.bankroll).toBe(125);
    expect(state.balances.accounts.map((a) => a.name)).toEqual(["Bank", "Bet365"]);
  });

  it("carries hosted history onto the snapshot newest first", () => {
    const state = appStateFromNeonDesk({
      bets: [],
      history: [
        historyRow({ id: 1, dedupe: "a", kind: "bet_placed", title: "Bet placed", createdAt: 1_700_000_000_000 }),
        historyRow({ id: 2, dedupe: "b", kind: "settlement", title: "Settled", createdAt: 1_700_000_100_000 }),
      ],
    });
    expect(state.history.map((h) => h.id)).toEqual([2, 1]);
  });
});

function casinoOffer(
  partial: Partial<CasinoOfferRow> & Pick<CasinoOfferRow, "id" | "title">
): CasinoOfferRow {
  return {
    casino: "Dynobet",
    bonusAmount: 0,
    wageringMultiplier: 0,
    rtp: null,
    contributionPct: null,
    status: "completed",
    expectedEv: 5,
    actualProfit: null,
    notes: null,
    game: null,
    expiresAt: null,
    seriesId: null,
    instanceDate: null,
    offerUrl: null,
    createdAt: 1_700_000_000_000,
    completedAt: null,
    ...partial,
  };
}

describe("appStateFromNeonDesk casino + adjustments", () => {
  it("blends casino profit and P&L adjustments into settled profit", () => {
    const state = appStateFromNeonDesk({
      bets: [
        bet({ id: 1, label: "Won", status: "won", actualProfit: 10, settledAt: 1_700_000_100_000 }),
      ],
      casinoOffers: [
        casinoOffer({ id: 1, title: "Wager £20 get 50 spins", actualProfit: 12.5, completedAt: 1_700_000_200_000 }),
        casinoOffer({ id: 2, title: "Planned", status: "planned", actualProfit: null }),
        casinoOffer({ id: 3, title: "Expired", status: "expired", actualProfit: 99 }),
      ],
      history: [
        historyRow({ id: 1, dedupe: "adj-1", kind: "balance_adjustment", title: "Correction", amount: 2, createdAt: 1_700_000_300_000 }),
        historyRow({ id: 2, dedupe: "adj-0", kind: "balance_adjustment", title: "Zero", amount: 0 }),
        historyRow({ id: 3, dedupe: "g", kind: "goal", title: "Goal" }),
      ],
    });
    expect(state.bettingProfit).toBe(10);
    expect(state.casinoProfit).toBe(12.5);
    expect(state.settledProfit).toBe(24.5);
    expect(state.casinoSettlements).toEqual([
      { id: 1, time: 1_700_000_200_000, amount: 12.5, title: "Wager £20 get 50 spins", casino: "Dynobet" },
    ]);
    expect(state.pnlAdjustments).toEqual([
      { id: 1, time: 1_700_000_300_000, amount: 2, detail: null },
    ]);
    // Series blends bet + casino + adjustment in time order with a running
    // total. The zero-amount adjustment still plots a point (local parity).
    expect(state.series.map((p) => p.value)).toEqual([0, 10, 22.5, 24.5]);
  });

  it("keeps casino and adjustments at zero when no rows are passed", () => {
    const state = appStateFromNeonDesk({ bets: [] });
    expect(state.casinoProfit).toBe(0);
    expect(state.casinoSettlements).toEqual([]);
    expect(state.pnlAdjustments).toEqual([]);
  });

  it("counts casino campaigns needing action like the local snapshot", () => {
    const state = appStateFromNeonDesk({
      bets: [],
      casinoOffers: [
        casinoOffer({ id: 1, title: "Planned", status: "planned" }),
        casinoOffer({ id: 2, title: "Active", status: "active" }),
        casinoOffer({ id: 3, title: "Done", status: "completed", actualProfit: 5 }),
        casinoOffer({ id: 4, title: "Gone", status: "expired" }),
      ],
    });
    expect(state.casinoNeedsAction).toBe(2);
  });
});
