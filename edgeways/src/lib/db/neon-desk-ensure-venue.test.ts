import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRow, ExchangeRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  accounts: [] as AccountRow[],
  exchanges: [] as ExchangeRow[],
  nextAccountId: 100,
  nextExchangeId: 10,
}));

function account(partial: Partial<AccountRow> & Pick<AccountRow, "id" | "name" | "type">): AccountRow {
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

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => "user_live",
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonDeskAccounts: async () => mocks.accounts,
  listNeonExchanges: async () => mocks.exchanges,
  insertNeonDeskAccount: async (values: Record<string, unknown>) => {
    const row = account({
      id: mocks.nextAccountId++,
      name: String(values.name),
      type: values.type as AccountRow["type"],
      exchangeId: (values.exchangeId as number | null | undefined) ?? null,
      brandColor: (values.brandColor as string | null | undefined) ?? null,
      isActive: (values.isActive as number | undefined) ?? 1,
      createdAt: (values.createdAt as number | undefined) ?? 1,
    });
    mocks.accounts.push(row);
    return row;
  },
  patchNeonDeskAccount: async (id: number, patch: Record<string, unknown>) => {
    const row = mocks.accounts.find((a) => a.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  },
  insertNeonExchange: async (values: Record<string, unknown>) => {
    const row: ExchangeRow = {
      id: mocks.nextExchangeId++,
      name: String(values.name),
      commissionPct: Number(values.commissionPct ?? 2),
      brandColor: String(values.brandColor ?? "#3f3f46"),
      backColor: String(values.backColor ?? "#a6d8ff"),
      layColor: String(values.layColor ?? "#fac9d1"),
      isDefault: values.isDefault ? 1 : 0,
      createdAt: 1,
    };
    mocks.exchanges.push(row);
    return row;
  },
}));

import { ensureNeonVenueAccount } from "./neon-desk-ensure-venue";

describe("ensureNeonVenueAccount", () => {
  beforeEach(() => {
    mocks.accounts = [];
    mocks.exchanges = [];
    mocks.nextAccountId = 100;
    mocks.nextExchangeId = 10;
  });

  it("returns the existing hosted bookie instead of a SQLite id", async () => {
    mocks.accounts.push(
      account({ id: 30, name: "Paddy Power", type: "bookie", isActive: 0 }),
      account({ id: 65, name: "Paddy Power", type: "bookie" })
    );
    const r = await ensureNeonVenueAccount("Paddy Power", "bookie");
    expect(r.created).toBe(false);
    expect(r.account.id).toBe(65);
    expect(r.exchange).toBeNull();
  });

  it("reactivates an inactive hosted bookie", async () => {
    mocks.accounts.push(account({ id: 30, name: "Paddy Power", type: "bookie", isActive: 0 }));
    const r = await ensureNeonVenueAccount("paddy power", "bookie");
    expect(r.created).toBe(true);
    expect(r.account.id).toBe(30);
    expect(r.account.isActive).toBe(1);
  });

  it("creates a hosted bookie when the desk has no match", async () => {
    const r = await ensureNeonVenueAccount("10Bet", "bookie");
    expect(r.created).toBe(true);
    expect(r.account.id).toBe(100);
    expect(r.account.type).toBe("bookie");
    expect(r.account.name).toBe("10Bet");
  });

  it("creates an exchange catalog row and wallet", async () => {
    const r = await ensureNeonVenueAccount("Betfair", "exchange");
    expect(r.created).toBe(true);
    expect(r.account.type).toBe("exchange");
    expect(r.exchange?.name).toBe("Betfair");
    expect(r.account.exchangeId).toBe(r.exchange!.id);
  });

  it("rejects an empty name", async () => {
    await expect(ensureNeonVenueAccount("  ", "bookie")).rejects.toThrow("Name is required");
  });

  it("creates the wallet for the explicit owner, not only the ALS clerk", async () => {
    const r = await ensureNeonVenueAccount("Smarkets", "exchange", "user_customer");
    expect(r.created).toBe(true);
    expect(r.account.name).toBe("Smarkets");
  });
});
