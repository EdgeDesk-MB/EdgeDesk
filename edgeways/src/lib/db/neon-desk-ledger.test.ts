import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRow, BetRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  accounts: [] as AccountRow[],
  txs: [] as Array<Record<string, unknown>>,
  patches: [] as Array<{ id: number; patch: Record<string, unknown> }>,
  ensureCalls: [] as Array<{ name: string; kind: string; clerk?: string | null }>,
  claimed: new Set<number>(),
}));

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
    createdAt: 1,
    ...partial,
  };
}

function bet(partial: Partial<BetRow>): BetRow {
  return {
    id: 10,
    eventId: null,
    label: "Arsenal",
    market: "match_odds",
    selection: "home",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: 1,
    backStake: 10,
    backOdds: 2,
    layStake: 9.8,
    layOdds: 2.02,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: 0.1,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: 1,
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

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
  claimNeonBetPlacementLedger: async (id: number) => {
    if (mocks.claimed.has(id)) return false;
    mocks.claimed.add(id);
    mocks.patches.push({ id, patch: { balanceLedgered: 1 } });
    return true;
  },
  patchNeonDeskBet: async (id: number, patch: Record<string, unknown>) => {
    mocks.patches.push({ id, patch });
    if (patch.balanceLedgered === 0) mocks.claimed.delete(id);
    return bet({ id, ...patch });
  },
}));

vi.mock("@/lib/db/neon-desk-ensure-venue", () => ({
  ensureNeonVenueAccount: async (
    name: string,
    kind: "bookie" | "exchange",
    clerkUserId?: string | null
  ) => {
    mocks.ensureCalls.push({ name, kind, clerk: clerkUserId });
    const existing = mocks.accounts.find(
      (a) => a.type === kind && a.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return { account: existing, exchange: null, created: false };
    const row = account({
      id: 100 + mocks.accounts.length,
      name,
      type: kind,
      exchangeId: kind === "exchange" ? 1 : null,
    });
    mocks.accounts.push(row);
    return { account: row, exchange: null, created: true };
  },
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonDeskAccounts: async () => mocks.accounts,
  listNeonDeskBalanceTransactions: async () => mocks.txs,
  listNeonExchanges: async () => [
    {
      id: 1,
      name: "Betfair",
      commissionPct: 2,
      brandColor: "#3f3f46",
      backColor: "#a6d8ff",
      layColor: "#fac9d1",
      isDefault: 1,
      createdAt: 1,
    },
  ],
  insertNeonDeskTransaction: async (values: Record<string, unknown>) => {
    mocks.txs.push(values);
    return { id: mocks.txs.length, ...values };
  },
  purgeNeonDeskTransactionsForBet: async () => {},
  purgeNeonDeskPlacementTransactionsForBet: async (betId: number) => {
    mocks.txs = mocks.txs.filter((t) => {
      if (t.betId !== betId) return true;
      const category = t.category;
      const amount = Number(t.amount ?? 0);
      const placement =
        category === "bet_stake" || (category === "free_bet" && amount < 0);
      return !placement;
    });
  },
}));

vi.mock("@/lib/db/neon-desk-history", () => ({
  insertNeonDeskHistory: async () => {},
}));

import {
  awardNeonUnconditionalFreeBetIfDue,
  awardNeonUnconditionalFreeBetsDue,
  healNeonDeskLedgers,
  healNeonOpenBetPlacements,
  ledgerNeonBetPlacement,
  ledgerNeonBetSettlement,
  reledgerNeonOpenBetPlacement,
} from "./neon-desk-ledger";

describe("ledgerNeonBetPlacement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.ensureCalls = [];
  });

  it("debits back stake and lay liability on a qualifying bet", async () => {
    mocks.accounts.push(
      account({ id: 30, name: "Bet365", type: "bookie" }),
      account({ id: 31, name: "Betfair", type: "exchange", exchangeId: 1 })
    );
    await expect(ledgerNeonBetPlacement(bet({}))).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -10,
          category: "bet_stake",
          betId: 10,
        }),
        expect.objectContaining({
          accountId: 31,
          amount: -9.8 * (2.02 - 1),
          category: "bet_stake",
          betId: 10,
        }),
      ])
    );
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceLedgered: 1 },
    });
  });

  it("skips the cash debit on a free bet", async () => {
    mocks.accounts.push(account({ id: 30, name: "Bet365", type: "bookie" }));
    await ledgerNeonBetPlacement(bet({ betType: "free_snr", exchangeId: null }));
    expect(mocks.txs).toEqual([]);
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceLedgered: 1 },
    });
  });

  it("is idempotent when another worker already claimed the placement", async () => {
    mocks.accounts.push(account({ id: 30, name: "Bet365", type: "bookie" }));
    mocks.claimed.add(10);
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "bet_stake",
      betId: 10,
    });
    await expect(ledgerNeonBetPlacement(bet({ exchangeId: null }))).resolves.toBe(true);
    expect(mocks.txs).toHaveLength(1);
  });

  it("creates wallets for a customer clerk even when ALS is a different user", async () => {
    mocks.clerkUserId = "user_als";
    await expect(ledgerNeonBetPlacement(bet({}), "user_customer")).resolves.toBe(true);
    expect(mocks.ensureCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Bet365", kind: "bookie", clerk: "user_customer" }),
        expect.objectContaining({ name: "Betfair", kind: "exchange", clerk: "user_customer" }),
      ])
    );
    expect(mocks.txs).toHaveLength(2);
  });
});

describe("ledgerNeonBetSettlement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [
      account({ id: 30, name: "Bet365", type: "bookie" }),
      account({ id: 31, name: "Betfair", type: "exchange", exchangeId: 1 }),
    ];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.ensureCalls = [];
  });

  it("credits the bookie payout when the back wins", async () => {
    await expect(
      ledgerNeonBetSettlement(
        bet({ status: "won", balanceLedgered: 1, actualProfit: 0.4 })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toContainEqual(
      expect.objectContaining({
        accountId: 30,
        amount: 20,
        category: "bet_settlement",
      })
    );
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceSettled: 1 },
    });
  });

  it("heals placement then pays out when the bet was never ledgered", async () => {
    // Worked: £10 back @ 2.00, £9.80 lay @ 2.02. Placement must debit before
    // the £20 bookie credit, otherwise settle would invent cash.
    await expect(
      ledgerNeonBetSettlement(bet({ status: "won", balanceLedgered: 0, actualProfit: 0.4 }))
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -10,
          category: "bet_stake",
        }),
        expect.objectContaining({
          accountId: 31,
          amount: -9.8 * (2.02 - 1),
          category: "bet_stake",
        }),
        expect.objectContaining({
          accountId: 30,
          amount: 20,
          category: "bet_settlement",
        }),
      ])
    );
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceSettled: 1 },
    });
  });

  it("does not invent money when there is no bookie or exchange to attach to", async () => {
    await expect(
      ledgerNeonBetSettlement(
        bet({
          status: "won",
          balanceLedgered: 0,
          bookmaker: "",
          exchangeId: null,
        })
      )
    ).resolves.toBe(false);
    expect(mocks.txs).toEqual([]);
  });

  it("debits the qualifying stake then credits a refund-if free bet after a loss", async () => {
    // Worked: £100 back lost, £100 money-back FB. Placement was skipped at
    // save time; settle must still debit the bookie then award the promo.
    await expect(
      ledgerNeonBetSettlement(
        bet({
          status: "lost",
          betType: "risk_free",
          exchangeId: null,
          backStake: 100,
          backOdds: 4.5,
          layStake: 65,
          layOdds: 4.7,
          commission: 0,
          actualProfit: -35,
          balanceLedgered: 0,
          triggerText: "Bet £100 get £100 free bet if bet loses",
          label: "Goodwood 1:25",
        })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -100,
          category: "bet_stake",
          betId: 10,
        }),
        expect.objectContaining({
          accountId: 30,
          amount: 100,
          category: "free_bet",
          betId: 10,
          note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
        }),
      ])
    );
  });

  it("still pays out when a concurrent heal already claimed placement", async () => {
    mocks.claimed.add(10);
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "bet_stake",
      betId: 10,
    });
    await expect(
      ledgerNeonBetSettlement(
        bet({ status: "won", balanceLedgered: 0, exchangeId: null, actualProfit: 0.4 })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toContainEqual(
      expect.objectContaining({
        accountId: 30,
        amount: 20,
        category: "bet_settlement",
      })
    );
  });

  it("does not credit a refund-if free bet when the back wins", async () => {
    await awardNeonUnconditionalFreeBetIfDue(
      bet({
        status: "won",
        betType: "risk_free",
        triggerText: "Bet £100 get £100 free bet if bet loses",
      })
    );
    expect(mocks.txs).toEqual([]);
  });
});

describe("awardNeonUnconditionalFreeBetsDue", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.ensureCalls = [];
  });

  it("debits the qualifying stake before a snapshot promo on a never-ledgered loss", async () => {
    // Worked: result already set, cash never moved. Dashboard award must not
    // credit +£100 FB while leaving the bookie at £0.
    await expect(
      awardNeonUnconditionalFreeBetsDue(
        [
          bet({
            status: "lost",
            betType: "risk_free",
            exchangeId: null,
            backStake: 100,
            backOdds: 4.5,
            layStake: 65,
            layOdds: 4.7,
            commission: 0,
            actualProfit: -35,
            balanceLedgered: 0,
            balanceSettled: 1,
            triggerText: "Bet £100 get £100 free bet if bet loses",
            label: "Goodwood 1:25",
          }),
        ],
        []
      )
    ).resolves.toBe(1);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -100,
          category: "bet_stake",
          betId: 10,
        }),
        expect.objectContaining({
          accountId: 30,
          amount: 100,
          category: "free_bet",
          betId: 10,
        }),
      ])
    );
  });
});

describe("healNeonOpenBetPlacements", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.ensureCalls = [];
  });

  it("ledgers open bets that never moved cash, and skips already-ledgered rows", async () => {
    const open = bet({ exchangeId: null });
    const done = bet({ id: 11, balanceLedgered: 1, exchangeId: null });
    const settled = bet({
      id: 12,
      status: "won",
      balanceLedgered: 0,
      exchangeId: null,
    });
    await expect(healNeonOpenBetPlacements([open, done, settled])).resolves.toBe(1);
    expect(mocks.txs).toEqual([
      expect.objectContaining({ betId: 10, amount: -10, category: "bet_stake" }),
    ]);
  });
});

describe("healNeonDeskLedgers", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.ensureCalls = [];
  });

  it("cash-settles a result that was saved before placement ledgered", async () => {
    const settled = bet({
      id: 12,
      status: "won",
      balanceLedgered: 0,
      exchangeId: null,
      actualProfit: 10,
    });
    await expect(healNeonDeskLedgers([settled])).resolves.toBe(1);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ betId: 12, amount: -10, category: "bet_stake" }),
        expect.objectContaining({ betId: 12, amount: 20, category: "bet_settlement" }),
      ])
    );
  });
});

describe("reledgerNeonOpenBetPlacement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.ensureCalls = [];
  });

  it("replaces the stake debit when an open bet's stake is edited", async () => {
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "bet_stake",
      betId: 10,
    });
    mocks.claimed.add(10);
    await reledgerNeonOpenBetPlacement(bet({ backStake: 25, exchangeId: null }));
    expect(mocks.txs).toEqual([
      expect.objectContaining({
        accountId: 30,
        amount: -25,
        category: "bet_stake",
        betId: 10,
      }),
    ]);
  });
});
