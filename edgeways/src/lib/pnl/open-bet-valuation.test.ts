import { describe, expect, it } from "vitest";
import { matchedBet } from "@/lib/calc/matched";
import {
  openBetExpectedProfit,
  openBetOutcomeKind,
  openBetOutcomeLabel,
  sumOpenExpectedProfit,
} from "./open-bet-valuation";

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

describe("openBetOutcomeKind", () => {
  const base = {
    betType: "qualifying" as const,
    backStake: 20,
    backOdds: 3.75,
    commission: 0.02,
    refundAmount: null,
    refundRetention: null,
    expectedProfit: -1.71,
  };

  it("labels equalised matched stakes as locked", () => {
    const optimal = matchedBet({
      mode: "qualifying",
      backStake: 20,
      backOdds: 3.75,
      layOdds: 3.6,
      commission: 0.02,
    });
    expect(
      openBetOutcomeKind({
        ...base,
        layStake: optimal.layStake,
        layOdds: 3.6,
        expectedProfit: optimal.guaranteed,
      })
    ).toBe("locked");
    expect(openBetOutcomeLabel("locked")).toBe("Locked");
  });

  it("labels underlay / overlay as worst outcome", () => {
    const optimal = matchedBet({
      mode: "qualifying",
      backStake: 20,
      backOdds: 3.75,
      layOdds: 3.6,
      commission: 0.02,
    });
    expect(
      openBetOutcomeKind({
        ...base,
        layStake: Math.max(0.01, optimal.layStake - 4),
        layOdds: 3.6,
      })
    ).toBe("worst");
    expect(openBetOutcomeLabel("worst")).toBe("Worst outcome");
  });

  it("falls back to estimate when there is no lay", () => {
    expect(
      openBetOutcomeKind({
        ...base,
        layStake: 0,
        layOdds: 0,
      })
    ).toBe("estimate");
    expect(openBetOutcomeLabel("estimate")).toBe("Est.");
  });
});
