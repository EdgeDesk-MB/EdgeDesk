import { describe, expect, it } from "vitest";
import {
  betTypeCanStakeFreeBet,
  bookieCashTopUpNeeded,
  bookieFreeBetBalance,
  bookieNeedsCashFunding,
  editBetReservedCredit,
  noLayFreeBetFromStored,
  noLaySaveBetType,
} from "./back-bookie-balance-strip";
import type { AccountBalance } from "@/lib/services/balances.types";

const bookie = (overrides: Partial<AccountBalance> = {}): AccountBalance =>
  ({
    id: 1,
    name: "Betfair Sportsbook",
    type: "bookie",
    isActive: 1,
    brandColor: null,
    sortOrder: 0,
    createdAt: 0,
    balance: 0,
    freeBets: 0,
    pendingIn: 0,
    ...overrides,
  }) as AccountBalance;

const edit = (
  overrides: Partial<{
    status: string;
    balanceLedgered: number;
    betType: string;
    backStake: number;
    bookmaker: string | null;
  }> = {}
) => ({
  status: "open",
  balanceLedgered: 1,
  betType: "qualifying",
  backStake: 50.85,
  bookmaker: "Betfair Sportsbook",
  ...overrides,
});

describe("editBetReservedCredit", () => {
  it("credits cash stake for an open ledgered cash bet on the same bookie", () => {
    expect(editBetReservedCredit(edit(), "Betfair Sportsbook", "cash")).toBe(50.85);
  });

  it("does not credit cash when editing a free bet", () => {
    expect(
      editBetReservedCredit(edit({ betType: "free_snr" }), "Betfair Sportsbook", "cash")
    ).toBe(0);
  });

  it("credits free-bet stake only in free_bet mode", () => {
    expect(
      editBetReservedCredit(edit({ betType: "free_snr" }), "Betfair Sportsbook", "free_bet")
    ).toBe(50.85);
    expect(editBetReservedCredit(edit(), "Betfair Sportsbook", "free_bet")).toBe(0);
  });

  it("ignores different bookie, settled, or unledgered bets", () => {
    expect(editBetReservedCredit(edit(), "Sky Bet", "cash")).toBe(0);
    expect(editBetReservedCredit(edit({ status: "won" }), "Betfair Sportsbook", "cash")).toBe(0);
    expect(
      editBetReservedCredit(edit({ balanceLedgered: 0 }), "Betfair Sportsbook", "cash")
    ).toBe(0);
  });
});

describe("bookieNeedsCashFunding with reserved credit", () => {
  it("does not need funding when reserved credit covers the stake", () => {
    const accounts = [bookie({ balance: 0 })];
    expect(
      bookieNeedsCashFunding(accounts, "Betfair Sportsbook", 50.85, 50.85)
    ).toBe(false);
  });

  it("needs funding only for the stake increase above reserved credit", () => {
    const accounts = [bookie({ balance: 0 })];
    expect(bookieNeedsCashFunding(accounts, "Betfair Sportsbook", 60, 50.85)).toBe(
      true
    );
    expect(bookieCashTopUpNeeded(accounts, "Betfair Sportsbook", 60, 50.85)).toBeCloseTo(
      9.15,
      2
    );
  });

  it("still needs funding for a new bet with empty wallet", () => {
    const accounts = [bookie({ balance: 0 })];
    expect(bookieNeedsCashFunding(accounts, "Betfair Sportsbook", 50.85)).toBe(true);
    expect(bookieCashTopUpNeeded(accounts, "Betfair Sportsbook", 50.85)).toBeCloseTo(
      50.85,
      2
    );
  });
});

describe("bookieFreeBetBalance with reserved credit", () => {
  it("adds reserved free-bet credit to the wallet free-bet balance", () => {
    const accounts = [bookie({ freeBets: 5 })];
    expect(bookieFreeBetBalance(accounts, "Betfair Sportsbook", 10)).toBe(15);
  });
});

describe("betTypeCanStakeFreeBet", () => {
  it("allows free bet modes, no_lay and dutch; blocks qualifying and risk_free", () => {
    expect(betTypeCanStakeFreeBet("free_snr")).toBe(true);
    expect(betTypeCanStakeFreeBet("free_sr")).toBe(true);
    expect(betTypeCanStakeFreeBet("no_lay")).toBe(true);
    expect(betTypeCanStakeFreeBet("dutch")).toBe(true);
    expect(betTypeCanStakeFreeBet("qualifying")).toBe(false);
    expect(betTypeCanStakeFreeBet("risk_free")).toBe(false);
  });
});

describe("noLaySaveBetType / noLayFreeBetFromStored", () => {
  it("maps free-bet funding onto stored bet types (SNR stake-not-returned)", () => {
    expect(noLaySaveBetType(null)).toBe("qualifying");
    expect(noLaySaveBetType("snr")).toBe("free_snr");
    expect(noLaySaveBetType("sr")).toBe("free_sr");
  });

  it("hydrates unhedged free bets back to no_lay free-bet kind", () => {
    expect(noLayFreeBetFromStored("free_snr", 0, 0)).toBe("snr");
    expect(noLayFreeBetFromStored("free_sr", 0, 0)).toBe("sr");
    expect(noLayFreeBetFromStored("qualifying", 0, 0)).toBe(null);
    // Matched free bet keeps a lay - not a no-lay hydrate
    expect(noLayFreeBetFromStored("free_snr", 12.5, 3.2)).toBe(null);
  });
});
