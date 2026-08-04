import { describe, expect, it } from "vitest";
import { wrContributionForBet } from "./wagering";

describe("wrContributionForBet", () => {
  it("burns full stake when odds meet minimum", () => {
    expect(
      wrContributionForBet(
        { backStake: 50, backOdds: 3, betType: "qualifying" },
        { wrRemaining: 100, wrMinOdds: 2, wrType: "stake" }
      )
    ).toBe(50);
  });

  it("skips free bets and low odds", () => {
    expect(
      wrContributionForBet(
        { backStake: 50, backOdds: 3, betType: "free_snr" },
        { wrRemaining: 100, wrMinOdds: null, wrType: "stake" }
      )
    ).toBe(0);
    expect(
      wrContributionForBet(
        { backStake: 50, backOdds: 1.5, betType: "qualifying" },
        { wrRemaining: 100, wrMinOdds: 2, wrType: "stake" }
      )
    ).toBe(0);
  });

  it("uses risk/win as min(stake, winnings)", () => {
    // stake 10 @ 1.5 → win 5 → burn 5
    expect(
      wrContributionForBet(
        { backStake: 10, backOdds: 1.5, betType: "qualifying" },
        { wrRemaining: 100, wrMinOdds: null, wrType: "risk_win" }
      )
    ).toBe(5);
  });
});
