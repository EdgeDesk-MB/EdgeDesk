import { describe, expect, it } from "vitest";
import { buildFillSlipDetail } from "./betslip-intent";

describe("buildFillSlipDetail (J9)", () => {
  it("pence-rounds the stake and trims the selection", () => {
    expect(
      buildFillSlipDetail({ side: "lay", selection: "  Arsenal  ", stake: 20.204, odds: 2.02 })
    ).toEqual({ side: "lay", selection: "Arsenal", stake: 20.2, odds: 2.02 });
  });

  it("drops advisory odds at or below 1 and rejects empty intents", () => {
    expect(buildFillSlipDetail({ side: "back", selection: "X", stake: 5, odds: 1 })).toEqual({
      side: "back",
      selection: "X",
      stake: 5,
    });
    expect(buildFillSlipDetail({ side: "lay", selection: "  ", stake: 5 })).toBeNull();
    expect(buildFillSlipDetail({ side: "lay", selection: "X", stake: 0 })).toBeNull();
    expect(buildFillSlipDetail({ side: "lay", selection: "X", stake: NaN })).toBeNull();
  });
});
