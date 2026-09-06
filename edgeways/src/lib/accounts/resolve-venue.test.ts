import { describe, expect, it } from "vitest";
import {
  backVenueKind,
  findVenueBalanceAccount,
  inferBackVenueKind,
  isBackPlacementDebit,
} from "./resolve-venue";

describe("inferBackVenueKind", () => {
  it("keeps sportsbooks as bookies", () => {
    expect(inferBackVenueKind("Betfair Sportsbook")).toBe("bookie");
    expect(inferBackVenueKind("Betdaq Sportsbook")).toBe("bookie");
    expect(inferBackVenueKind("Bet365")).toBe("bookie");
  });

  it("treats exchange brands as exchanges", () => {
    expect(inferBackVenueKind("Betdaq")).toBe("exchange");
    expect(inferBackVenueKind("Betfair")).toBe("exchange");
    expect(inferBackVenueKind("Smarkets")).toBe("exchange");
    expect(inferBackVenueKind("Matchbook")).toBe("exchange");
    expect(inferBackVenueKind("BetConnect")).toBe("exchange");
    expect(inferBackVenueKind("Betfair Exchange")).toBe("exchange");
  });
});

describe("findVenueBalanceAccount", () => {
  const bookie = { id: 1, name: "Bet365", type: "bookie" as const, isActive: 1 };
  const betdaq = { id: 2, name: "Betdaq", type: "exchange" as const, isActive: 1 };
  const phantom = { id: 3, name: "Betdaq", type: "bookie" as const, isActive: 1 };

  it("finds an exchange wallet by name", () => {
    expect(findVenueBalanceAccount([bookie, betdaq], "Betdaq")?.id).toBe(2);
  });

  it("still finds a bookie wallet by name", () => {
    expect(findVenueBalanceAccount([bookie, betdaq], "Bet365")?.id).toBe(1);
  });

  it("prefers the exchange when a phantom Betdaq bookie also exists", () => {
    expect(findVenueBalanceAccount([phantom, betdaq], "Betdaq")?.id).toBe(2);
  });

  it("ignores inactive wallets", () => {
    expect(
      findVenueBalanceAccount([{ ...betdaq, isActive: 0 }], "Betdaq")
    ).toBeUndefined();
  });
});

describe("backVenueKind", () => {
  it("uses the existing exchange wallet kind", () => {
    expect(
      backVenueKind([{ name: "Betdaq", type: "exchange", isActive: 1 }], "Betdaq")
    ).toBe("exchange");
  });

  it("infers exchange when no wallet exists yet", () => {
    expect(backVenueKind([], "Betdaq")).toBe("exchange");
  });
});

describe("isBackPlacementDebit", () => {
  it("accepts the back stake and skips lay liability", () => {
    expect(
      isBackPlacementDebit({
        category: "bet_stake",
        amount: -300,
        note: "Back stake - Hull",
      })
    ).toBe(true);
    expect(
      isBackPlacementDebit({
        category: "bet_stake",
        amount: -50,
        note: "Lay liability - Hull",
      })
    ).toBe(false);
  });
});
