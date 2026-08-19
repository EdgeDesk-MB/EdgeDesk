import { describe, expect, it } from "vitest";
import {
  exchangeFundingForecast,
  resolveExchangeCash,
} from "./exchange-funding";

describe("exchangeFundingForecast - top-up after each consumed liability", () => {
  // This campaign at create, proxy liabilities £30 then £180, cash £50:
  //   start: 50 ≥ 30, remaining after a win 20
  //   next: 180 − 20 = fund £160
  it("£50 cash on the 2-fold proxy ladder: only the post-win shortfall", () => {
    const short = exchangeFundingForecast(50, [
      { label: "Is She Now", liability: 30, reserved: false },
      { label: "Sunrush", liability: 180, reserved: false },
    ]);
    expect(short).toEqual([
      {
        afterLabels: ["Is She Now"],
        nextLabel: "Sunrush",
        liability: 180,
        remaining: 20,
        fund: 160,
      },
    ]);
  });

  it("£10 cash cannot start: fund the first lay, then the full next liability", () => {
    // Place needs £30, have £10 → fund £20 now. After topping up just enough
    // and the lay losing, remaining is £0, so the £180 lock is a full top-up.
    const short = exchangeFundingForecast(10, [
      { label: "Is She Now", liability: 30, reserved: false },
      { label: "Sunrush", liability: 180, reserved: false },
    ]);
    expect(short).toEqual([
      {
        afterLabels: [],
        nextLabel: "Is She Now",
        liability: 30,
        remaining: 10,
        fund: 20,
      },
      {
        afterLabels: ["Is She Now"],
        nextLabel: "Sunrush",
        liability: 180,
        remaining: 0,
        fund: 180,
      },
    ]);
  });

  it("a reserved first lay is already in the wallet, so only the next step counts", () => {
    // Cash is already net of the £32 Is She Now reservation.
    const short = exchangeFundingForecast(18, [
      { label: "Is She Now", liability: 32, reserved: true },
      { label: "Sunrush", liability: 182.72, reserved: false },
    ]);
    expect(short).toHaveLength(1);
    expect(short[0]).toMatchObject({
      afterLabels: ["Is She Now"],
      nextLabel: "Sunrush",
      remaining: 18,
      fund: 164.72,
    });
  });

  it("one-shot lay (Add bet / combined): cash £20, liability £32 → fund £12", () => {
    const short = exchangeFundingForecast(20, [
      { label: "Whole acca", liability: 32, reserved: false },
    ]);
    expect(short).toEqual([
      {
        afterLabels: [],
        nextLabel: "Whole acca",
        liability: 32,
        remaining: 20,
        fund: 12,
      },
    ]);
  });

  it("fully funded all-win path is silent", () => {
    expect(
      exchangeFundingForecast(220, [
        { label: "A", liability: 30, reserved: false },
        { label: "B", liability: 180, reserved: false },
      ])
    ).toEqual([]);
  });
});

describe("resolveExchangeCash - selected wallet, else pooled exchanges", () => {
  const accounts = [
    { type: "bookie" as const, isActive: 1, exchangeId: null, balance: 99, name: "Sky Bet", id: 1 },
    { type: "exchange" as const, isActive: 1, exchangeId: 7, balance: 40, name: "Betdaq", id: 2 },
    { type: "exchange" as const, isActive: 1, exchangeId: 8, balance: 10, name: "Smarkets", id: 3 },
    { type: "exchange" as const, isActive: 0, exchangeId: 9, balance: 500, name: "Old", id: 4 },
  ];

  it("prefers the wallet linked to the chosen exchange", () => {
    expect(resolveExchangeCash(accounts, 7)).toEqual({
      cash: 40,
      walletName: "Betdaq",
      accountId: 2,
    });
  });

  it("sums active exchange cash when no exchange is chosen", () => {
    expect(resolveExchangeCash(accounts, null)).toEqual({
      cash: 50,
      walletName: null,
      accountId: null,
    });
  });

  it("treats a missing wallet list as £0", () => {
    expect(resolveExchangeCash(undefined, 7)).toEqual({
      cash: 0,
      walletName: null,
      accountId: null,
    });
  });
});
