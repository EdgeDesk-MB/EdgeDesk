import { describe, expect, it } from "vitest";
import { isRefundIfOffer, isRefundIfText } from "./refund-if";

describe("isRefundIfText", () => {
  it("matches money back if the bet loses", () => {
    expect(isRefundIfText("Money back if bet loses")).toBe(true);
    expect(isRefundIfText("MONEY BACK AS A FREE BET IF YOUR HORSE LOSES")).toBe(true);
    expect(
      isRefundIfText(
        "Money Back as a Free Bet will only occur if your bet loses. Stake refunded as a sportsbook Free Bet."
      )
    ).toBe(true);
    expect(isRefundIfText("Risk-free bet: get your stake back if it loses")).toBe(true);
    expect(isRefundIfText("Second Chance Offer. Money back as a free bet if your bet loses.")).toBe(
      true
    );
  });

  it("does not match place-refund money-back wording", () => {
    expect(isRefundIfText("Money Back 2nd & 3rd")).toBe(false);
    expect(isRefundIfText("Money back if 2nd or 3rd")).toBe(false);
    expect(
      isRefundIfText("Get £10 back as a free bet if your horse finishes 2nd or 3rd")
    ).toBe(false);
    expect(isRefundIfText("Bet £10 get £30 free bet. Min odds 1/2. SNR.")).toBe(false);
  });
});

describe("isRefundIfOffer", () => {
  it("reads the campaign title used on Campaign details", () => {
    expect(
      isRefundIfOffer({
        title: "Money back if bet loses",
        description: "Bet £100 get £100 free · SNR free bet",
      })
    ).toBe(true);
  });

  it("reads a refundIf flag on stored rules", () => {
    expect(
      isRefundIfOffer({
        title: "BetMGM racing",
        rules: JSON.stringify({ type: "bet_get_free_place", refundIf: true }),
      })
    ).toBe(true);
  });
});
