import { describe, expect, it } from "vitest";
import { openBetExpectedProfit, sumOpenExpectedProfit } from "./open-bet-valuation";

describe("openBetExpectedProfit", () => {
  it("returns expectedProfit for open bets", () => {
    expect(openBetExpectedProfit({ status: "open", expectedProfit: 18.75 })).toBe(18.75);
  });

  it("ignores settled bets and missing expected", () => {
    expect(openBetExpectedProfit({ status: "lost", expectedProfit: 18.75 })).toBeNull();
    expect(openBetExpectedProfit({ status: "open", expectedProfit: null })).toBeNull();
  });
});

describe("sumOpenExpectedProfit", () => {
  it("sums open expected and can exclude live-valued bets", () => {
    const bets = [
      { id: 1, status: "open" as const, expectedProfit: 10 },
      { id: 2, status: "open" as const, expectedProfit: 5 },
      { id: 3, status: "lost" as const, expectedProfit: 99 },
    ];
    expect(sumOpenExpectedProfit(bets)).toBe(15);
    expect(sumOpenExpectedProfit(bets, { excludeBetIds: [1] })).toBe(5);
  });
});
