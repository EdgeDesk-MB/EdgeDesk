import { describe, expect, it } from "vitest";
import { canManualSettleBet } from "./manual-settle";

describe("canManualSettleBet", () => {
  it("allows Set result on an open unmatched tennis 2UP", () => {
    expect(
      canManualSettleBet({
        status: "open",
        market: "match_winner",
        sport: "tennis",
      })
    ).toBe(true);
  });

  it("hides Set result once a football match-odds bet is linked", () => {
    expect(
      canManualSettleBet(
        { status: "open", market: "match_odds", sport: "football" },
        { sport: "football" }
      )
    ).toBe(false);
  });

  it("hides Set result on racing and on already-settled bets", () => {
    expect(
      canManualSettleBet(
        { status: "open", market: "win", sport: "horse_racing" },
        { sport: "horse_racing" }
      )
    ).toBe(false);
    expect(
      canManualSettleBet({
        status: "won",
        market: "match_winner",
        sport: "tennis",
      })
    ).toBe(false);
  });
});
