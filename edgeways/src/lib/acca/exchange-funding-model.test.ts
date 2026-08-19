import { describe, expect, it } from "vitest";
import { accaExchangeFundingModel } from "./exchange-funding-model";

describe("accaExchangeFundingModel", () => {
  const legs = [
    { seq: 1, label: "Is She Now", backOdds: 4, result: "pending" as const, layStake: null, layOdds: null },
    { seq: 2, label: "Sunrush", backOdds: 5.5, result: "pending" as const, layStake: null, layOdds: null },
  ];

  it("is silent for combined / whole-acca methods", () => {
    expect(
      accaExchangeFundingModel({
        method: "combined",
        stake: 10,
        commission: 0,
        legs,
        accounts: [{ id: 1, name: "Betdaq", type: "exchange", isActive: 1, exchangeId: 7, balance: 50 }],
      })
    ).toBeNull();
  });

  it("names Betdaq and funds £160 after Is She Now on the £50 / proxy ladder", () => {
    const model = accaExchangeFundingModel({
      method: "sequential",
      stake: 10,
      commission: 0,
      legs,
      accounts: [{ id: 2, name: "Betdaq", type: "exchange", isActive: 1, exchangeId: 7, balance: 50 }],
      exchangeId: 7,
    });
    expect(model?.walletName).toBe("Betdaq");
    expect(model?.usedProxy).toBe(true);
    expect(model?.topUp).toBeCloseTo(160, 10);
    expect(model?.shortfalls).toHaveLength(1);
    expect(model?.shortfalls[0]?.afterLabels).toEqual(["Is She Now"]);
  });
});
