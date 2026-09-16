import { describe, expect, it } from "vitest";
import {
  editBetReservedLiability,
  exchangeNeedsFunding,
  findExchangeBalanceAccount,
} from "./exchange-balance";
import type { AccountBalance } from "@/lib/services/balances.types";

const exchange = (overrides: Partial<AccountBalance> = {}): AccountBalance =>
  ({
    id: 2,
    name: "Betdaq",
    type: "exchange",
    isActive: 1,
    exchangeId: 7,
    brandColor: null,
    sortOrder: 0,
    createdAt: 0,
    balance: 40,
    freeBets: 0,
    pendingIn: 0,
    ...overrides,
  }) as AccountBalance;

const edit = (
  overrides: Partial<{
    status: string;
    balanceLedgered: number;
    exchangeId: number | null;
    layStake: number;
    layOdds: number;
  }> = {}
) => ({
  status: "open",
  balanceLedgered: 1,
  exchangeId: 7,
  layStake: 20,
  layOdds: 3,
  ...overrides,
});

describe("findExchangeBalanceAccount", () => {
  it("prefers the wallet linked to the selected exchange id", () => {
    const accounts = [
      exchange({ id: 2, name: "Betdaq", exchangeId: 7, balance: 40 }),
      exchange({ id: 3, name: "Smarkets", exchangeId: 8, balance: 10 }),
    ];
    expect(findExchangeBalanceAccount(accounts, 7, "Betdaq")?.balance).toBe(40);
    expect(findExchangeBalanceAccount(accounts, 8, "Smarkets")?.id).toBe(3);
  });

  it("falls back to the venue name when no exchange id match", () => {
    const accounts = [exchange({ exchangeId: null, name: "Betdaq", balance: 12 })];
    expect(findExchangeBalanceAccount(accounts, 7, "Betdaq")?.balance).toBe(12);
  });
});

describe("exchangeNeedsFunding", () => {
  it("is true when the selected exchange cash is below liability", () => {
    expect(exchangeNeedsFunding([exchange()], 7, "Betdaq", 50)).toBe(true);
    expect(exchangeNeedsFunding([exchange()], 7, "Betdaq", 40)).toBe(false);
  });

  it("is true when there is no wallet for the selected exchange", () => {
    expect(exchangeNeedsFunding([], 7, "Betdaq", 10)).toBe(true);
  });

  it("is false when there is no liability or no exchange selected", () => {
    expect(exchangeNeedsFunding([exchange()], 7, "Betdaq", 0)).toBe(false);
    expect(exchangeNeedsFunding([exchange()], null, "", 50)).toBe(false);
  });

  it("credits reserved liability for the open bet under edit", () => {
    expect(exchangeNeedsFunding([exchange()], 7, "Betdaq", 50, 40)).toBe(false);
  });
});

describe("editBetReservedLiability", () => {
  it("credits lay liability for an open ledgered bet on the same exchange", () => {
    expect(editBetReservedLiability(edit(), 7)).toBe(40);
  });

  it("ignores a different exchange, settled, or unledgered bet", () => {
    expect(editBetReservedLiability(edit(), 8)).toBe(0);
    expect(editBetReservedLiability(edit({ status: "won" }), 7)).toBe(0);
    expect(editBetReservedLiability(edit({ balanceLedgered: 0 }), 7)).toBe(0);
  });
});
