import { describe, expect, it } from "vitest";
import {
  balanceSummaryFromRows,
  openBetInBetsAmountFromRow,
  settingsBookiesFromRows,
} from "@/lib/services/balance-summary";
import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
} from "@/lib/db/schema";

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

function bet(partial: Partial<BetRow> & Pick<BetRow, "id">): BetRow {
  return {
    eventId: null,
    label: "Bet",
    market: "match_odds",
    selection: "",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 0,
    backOdds: 0,
    layStake: 0,
    layOdds: 0,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: null,
    actualProfit: null,
    notes: null,
    balanceLedgered: 1,
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

describe("balanceSummaryFromRows", () => {
  it("sums confirmed cash and excludes free-bet and pending rows", () => {
    const summary = balanceSummaryFromRows(
      [account({ id: 1, name: "Bank", type: "bank" })],
      [
        tx({ id: 1, accountId: 1, amount: 100, category: "top_up" }),
        tx({ id: 2, accountId: 1, amount: -20, category: "withdrawal" }),
        tx({ id: 3, accountId: 1, amount: 10, category: "free_bet" }),
        tx({ id: 4, accountId: 1, amount: 50, category: "top_up", pending: 1 }),
      ],
      []
    );
    expect(summary.banks).toBe(80);
    expect(summary.total).toBe(80);
    expect(summary.pendingBankCredits).toBe(50);
    expect(summary.accounts[0]?.pendingIn).toBe(50);
  });

  it("sorts bank, bookie, exchange and rounds IEEE dust to pence", () => {
    const summary = balanceSummaryFromRows(
      [
        account({ id: 1, name: "Smarkets", type: "exchange" }),
        account({ id: 2, name: "Bet365", type: "bookie" }),
        account({ id: 3, name: "Bank", type: "bank" }),
      ],
      [
        tx({ id: 1, accountId: 2, amount: 0.1, category: "top_up" }),
        tx({ id: 2, accountId: 2, amount: 0.2, category: "top_up" }),
      ],
      []
    );
    expect(summary.accounts.map((a) => a.type)).toEqual(["bank", "bookie", "exchange"]);
    expect(summary.bookies).toBe(0.3);
  });

  it("locks back stake plus lay liability for open ledgered bets", () => {
    const open = bet({ id: 1, backStake: 10, layStake: 10, layOdds: 3 });
    expect(openBetInBetsAmountFromRow(open)).toBe(30);
    expect(
      openBetInBetsAmountFromRow({ ...open, betType: "free_snr" })
    ).toBe(20);
    expect(
      openBetInBetsAmountFromRow({ ...open, status: "won" })
    ).toBe(0);
    expect(
      openBetInBetsAmountFromRow({ ...open, balanceLedgered: 0 })
    ).toBe(0);
  });

  it("reserves only worst-case liability when lays share a market", () => {
    // Lay Norway £20 @4.8 (liability 76) + lay England £200 @1.88 (liability
    // 176) on the same match. Sum deducted 252; worst case (England wins)
    // = -176 + 19.60 winnings = -156.40. Return = 95.60.
    const exchange = account({ id: 1, name: "Betfair", type: "exchange" });
    const bets = [
      bet({ id: 1, eventId: 9, layStake: 20, layOdds: 4.8 }),
      bet({ id: 2, eventId: 9, layStake: 200, layOdds: 1.88 }),
    ];
    const txs = [
      tx({ id: 1, accountId: 1, amount: -76, category: "bet_stake", betId: 1 }),
      tx({ id: 2, accountId: 1, amount: -176, category: "bet_stake", betId: 2 }),
    ];
    const summary = balanceSummaryFromRows([exchange], txs, bets);
    expect(summary.accounts[0]?.balance).toBe(-156.4);
    expect(summary.inBets).toBe(156.4);
    // Liquid -156.40 + inBets 156.40 rounds to -0 (same as the SQLite path).
    expect(Math.abs(summary.bankroll)).toBe(0);
  });

  it("does not share liability across different events", () => {
    const exchange = account({ id: 1, name: "Betfair", type: "exchange" });
    const bets = [
      bet({ id: 1, eventId: 9, layStake: 20, layOdds: 4.8 }),
      bet({ id: 2, eventId: 10, layStake: 200, layOdds: 1.88 }),
    ];
    const txs = [
      tx({ id: 1, accountId: 1, amount: -76, category: "bet_stake", betId: 1 }),
      tx({ id: 2, accountId: 1, amount: -176, category: "bet_stake", betId: 2 }),
    ];
    const summary = balanceSummaryFromRows([exchange], txs, bets);
    expect(summary.accounts[0]?.balance).toBe(-252);
    expect(summary.inBets).toBe(252);
  });
});

describe("settingsBookiesFromRows", () => {
  it("keeps an archived bookie that still has ledger history", () => {
    const bookies = settingsBookiesFromRows(
      [account({ id: 30, name: "Paddy Power", type: "bookie", isActive: 0 })],
      [tx({ id: 1, accountId: 30, amount: 50, category: "top_up" })],
      []
    );
    expect(bookies).toHaveLength(1);
    expect(bookies[0]?.id).toBe(30);
    expect(bookies[0]?.balance).toBe(50);
  });
});
