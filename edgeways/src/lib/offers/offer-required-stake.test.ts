import { describe, expect, it } from "vitest";
import { offerRequiredStake, stakeFromOfferTitle } from "./offer-required-stake";

describe("offerRequiredStake", () => {
  it("returns betStake when present and positive", () => {
    expect(offerRequiredStake({ rules: JSON.stringify({ betStake: 10 }) })).toBe(10);
  });

  it("falls back to minStake when betStake absent", () => {
    expect(offerRequiredStake({ rules: JSON.stringify({ minStake: 5 }) })).toBe(5);
  });

  it("falls back to title Bet £X when rules omit stake", () => {
    expect(
      offerRequiredStake({
        rules: JSON.stringify({ freeBetAmount: 10 }),
        title: "Bet £10 get £10 free bet",
      })
    ).toBe(10);
  });

  it("prefers betStake over title", () => {
    expect(
      offerRequiredStake({
        rules: JSON.stringify({ betStake: 20 }),
        title: "Bet £10 get £10 free bet",
      })
    ).toBe(20);
  });

  it("returns null when rules missing and title has no stake", () => {
    expect(offerRequiredStake({ rules: null, title: "Welcome offer" })).toBeNull();
  });

  it("returns null when betStake is zero or absent and no fallback", () => {
    expect(offerRequiredStake({ rules: JSON.stringify({ betStake: 0 }) })).toBeNull();
    expect(offerRequiredStake({ rules: JSON.stringify({ freeBetAmount: 10 }) })).toBeNull();
  });

  it("returns null on invalid JSON without a usable title", () => {
    expect(offerRequiredStake({ rules: "{not-json" })).toBeNull();
  });
});

describe("stakeFromOfferTitle", () => {
  it("parses Bet £ amounts", () => {
    expect(stakeFromOfferTitle("Bet £10 get £10 free bet")).toBe(10);
    expect(stakeFromOfferTitle("bet £5.50 get free bet")).toBe(5.5);
  });

  it("returns null when no Bet £ pattern", () => {
    expect(stakeFromOfferTitle("£10 free bet")).toBeNull();
  });
});
