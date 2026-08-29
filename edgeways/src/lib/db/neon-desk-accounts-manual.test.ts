import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  txValues: undefined as Record<string, unknown> | undefined,
  historyValues: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        if ("accountId" in values) {
          mocks.txValues = values;
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: 1,
                  clerkUserId: mocks.clerkUserId,
                  ...values,
                  betId: values.betId ?? null,
                  casinoOfferId: values.casinoOfferId ?? null,
                  transferGroupId: null,
                  pending: 0,
                  confirmedAt: null,
                  expiresAt: null,
                },
              ]),
          };
        }
        mocks.historyValues = values;
        return {
          onConflictDoNothing: () => Promise.resolve(),
        };
      },
    }),
  }),
}));

import { recordNeonManualTransaction } from "@/lib/db/neon-desk-accounts";
import type { AccountRow } from "@/lib/db/schema";

const account: AccountRow = {
  id: 64,
  name: "Betfair",
  type: "bookie",
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
};

describe("recordNeonManualTransaction", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.txValues = undefined;
    mocks.historyValues = undefined;
  });

  it("writes the ledger row on the hosted desk", async () => {
    await recordNeonManualTransaction({
      account,
      amount: 50,
      category: "adjustment",
      note: "Balance set to £50.00",
    });
    expect(mocks.txValues).toMatchObject({
      accountId: 64,
      amount: 50,
      category: "adjustment",
      affectPnl: 0,
      clerkUserId: "user_live",
    });
    expect(mocks.historyValues).toBeUndefined();
  });

  it("writes a P&L history row when affectPnl is set", async () => {
    await recordNeonManualTransaction({
      account,
      amount: 25,
      category: "top_up",
      note: "Bank transfer",
      affectPnl: true,
    });
    expect(mocks.txValues?.affectPnl).toBe(1);
    expect(mocks.historyValues).toMatchObject({
      kind: "balance_adjustment",
      title: "Top-up",
      amount: 25,
      note: "Bank transfer",
      clerkUserId: "user_live",
    });
  });
});
