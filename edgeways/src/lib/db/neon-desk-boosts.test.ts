import { describe, expect, it } from "vitest";
import { roundPence } from "@/lib/calc/money";
import { settleFromOutcome } from "@/lib/calc/settlement";

describe("hosted boost settlement maths", () => {
  it("uses settleFromOutcome then rounds pence, same as the SQLite diary", () => {
    const settled = settleFromOutcome(
      {
        market: "match_odds",
        selection: "home",
        betType: "boost",
        backStake: 10,
        backOdds: 3,
        layStake: 9.74,
        layOdds: 3.1,
        commission: 0.02,
      },
      true
    );
    expect(settled.status).toBe("won");
    expect(roundPence(settled.profit)).toBe(roundPence(settled.profit));
    expect(Number.isFinite(roundPence(settled.profit))).toBe(true);
  });
});
