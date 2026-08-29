import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRow, BetRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  accounts: [] as AccountRow[],
  txs: [] as Array<Record<string, unknown>>,
  patches: [] as Array<{ id: number; patch: Record<string, unknown> }>,
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
  patchNeonDeskBet: async (id: number, patch: Record<string, unknown>) => {
    mocks.patches.push({ id, patch });
    return bet({ id, ...patch });
  },
}));

vi.mock("@/lib/db/neon-desk-ensure-venue", () => ({
  ensureNeonVenueAccount: async (name: string, kind: "bookie" | "exchange") => {
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
}));

import {
  ledgerNeonBetPlacement,
  ledgerNeonBetSettlement,
} from "./neon-desk-ledger";

describe("ledgerNeonBetPlacement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [];
    mocks.txs = [];
    mocks.patches = [];
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

  it("does not invent money for a bet that was never ledgered", async () => {
    await expect(
      ledgerNeonBetSettlement(bet({ status: "won", balanceLedgered: 0 }))
    ).resolves.toBe(false);
    expect(mocks.txs).toEqual([]);
  });
});
