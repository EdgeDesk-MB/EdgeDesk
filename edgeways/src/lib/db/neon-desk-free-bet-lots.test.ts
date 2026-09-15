import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRow, BalanceTransactionRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  accounts: [] as AccountRow[],
  txs: [] as BalanceTransactionRow[],
  expiryPatches: [] as Array<{ id: number; expiresAt: number | null }>,
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
    notesSource: null,
    wrRemaining: 0,
    wrMinOdds: null,
    wrType: "stake",
    health: null,
    healthUpdatedAt: null,
    createdAt: 1,
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
    createdAt: 1,
    confirmedAt: null,
    affectPnl: 0,
    expiresAt: null,
    ...partial,
  };
}

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    update: () => ({
      set: (patch: { expiresAt: number | null }) => ({
        where: () => ({
          returning: async () => {
            const last = mocks.expiryPatches[mocks.expiryPatches.length - 1];
            mocks.expiryPatches.push({ id: last?.id ?? 2282, expiresAt: patch.expiresAt });
            return [{ id: 2282, ...patch }];
          },
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonDeskAccounts: async () => mocks.accounts,
  listNeonDeskBalanceTransactions: async () => mocks.txs,
  insertNeonDeskTransaction: async (values: Record<string, unknown>) => {
    const row = tx({
      id: 9000 + mocks.txs.length,
      accountId: values.accountId as number,
      amount: values.amount as number,
      category: values.category as BalanceTransactionRow["category"],
      note: (values.note as string | null) ?? null,
      createdAt: (values.createdAt as number) ?? 2,
    });
    mocks.txs.push(row);
    return row;
  },
}));

import {
  listNeonOpenFreeBetLots,
  removeNeonFreeBetLot,
  setNeonFreeBetLotExpiry,
} from "./neon-desk-free-bet-lots";

describe("hosted free-bet lots", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 70, name: "BetMGM", type: "bookie" })];
    mocks.txs = [];
    mocks.expiryPatches = [];
  });

  it("lists the open BetMGM promo lot", async () => {
    mocks.txs.push(
      tx({
        id: 2282,
        accountId: 70,
        amount: 100,
        category: "free_bet",
        note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
        betId: 541,
      })
    );
    await expect(listNeonOpenFreeBetLots()).resolves.toEqual([
      expect.objectContaining({
        id: 2282,
        accountName: "BetMGM",
        remaining: 100,
      }),
    ]);
  });

  it("writes off a lot with a tagged debit", async () => {
    mocks.txs.push(
      tx({
        id: 2282,
        accountId: 70,
        amount: 100,
        category: "free_bet",
        note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
      })
    );
    const removed = await removeNeonFreeBetLot(2282);
    expect(removed.remaining).toBe(0);
    expect(mocks.txs.at(-1)).toEqual(
      expect.objectContaining({
        accountId: 70,
        amount: -100,
        category: "free_bet",
        note: "Free bet removed - [[lot:2282]] Bet lost — money-back free bet (Goodwood 1:25)",
      })
    );
  });

  it("sets expiry on an open lot", async () => {
    mocks.txs.push(
      tx({
        id: 2282,
        accountId: 70,
        amount: 100,
        category: "free_bet",
        note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
      })
    );
    const lot = await setNeonFreeBetLotExpiry(2282, 1_800_000_000_000);
    expect(lot.expiresAt).toBe(1_800_000_000_000);
  });
});
