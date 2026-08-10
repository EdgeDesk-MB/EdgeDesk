import { describe, expect, it } from "vitest";
import type { EachWayBetMeta } from "@/lib/bets/ew-meta";
import { eachWayLayStakes, eachWayOutcomePnL } from "@/lib/calc/each-way-outcomes";
import type { RaceResult } from "@/lib/racing";
import { racingMarketReadyToSettle, settleRacingBet } from "@/lib/calc/racing-settlement";
import type { SettleableBet } from "@/lib/calc/settlement";

function winBet(selection: string): SettleableBet {
  return {
    market: "win",
    selection,
    betType: "qualifying",
    backStake: 10,
    backOdds: 5,
    layStake: 8,
    layOdds: 5.2,
    commission: 0.02,
  };
}

function placeBet(selection: string): SettleableBet {
  return { ...winBet(selection), market: "place" };
}

function epBet(selection: string): SettleableBet {
  const stakePerPart = 10;
  const winOdds = 11;
  const placeFraction = 0.2;
  const layWinOdds = 12;
  const layPlaceOdds = 3.2;
  const commission = 0.02;
  const lays = eachWayLayStakes({
    stakePerPart,
    winOdds,
    placeFraction,
    layWinOdds,
    layPlaceOdds,
    commission,
  });
  const ewMeta: EachWayBetMeta = {
    stakePerPart,
    placeFraction,
    layWin: { stake: lays.layWinStake, odds: layWinOdds },
    layPlace: { stake: lays.layPlaceStake, odds: layPlaceOdds },
    bookiePlaces: 4,
    exchangePlaces: 3,
    mode: "extra_place",
  };
  return {
    market: "extra_place",
    selection,
    betType: "qualifying",
    backStake: stakePerPart * 2,
    backOdds: winOdds,
    layStake: lays.layWinStake + lays.layPlaceStake,
    layOdds: layWinOdds,
    commission,
    ewMeta,
  };
}

/** Winner only — fast result before 2nd/3rd land. */
const incomplete: RaceResult = {
  kind: "horse_racing",
  winner: "River Wharfe",
  fieldSize: 9,
  runners: [{ horse: "River Wharfe", position: 1, spLabel: "2/1" }],
};

const complete: RaceResult = {
  kind: "horse_racing",
  winner: "River Wharfe",
  fieldSize: 16,
  runners: [
    { horse: "River Wharfe", position: 1, spLabel: "2/1" },
    { horse: "Aspire To Glory", position: 2, spLabel: "11/4" },
    { horse: "Celebrating Ethel", position: 3, spLabel: "9/2" },
    { horse: "Fourth Extra", position: 4, spLabel: "14/1" },
    { horse: "No Chance", position: 8 },
  ],
};

describe("racingMarketReadyToSettle", () => {
  it("allows win markets on winner-only (fast) results", () => {
    expect(racingMarketReadyToSettle("win", incomplete)).toBe(true);
  });

  it("holds place / each_way / extra_place until placings exist", () => {
    expect(racingMarketReadyToSettle("place", incomplete)).toBe(false);
    expect(racingMarketReadyToSettle("each_way", incomplete)).toBe(false);
    expect(racingMarketReadyToSettle("extra_place", incomplete)).toBe(false);
  });

  it("allows place markets once two or more placings exist", () => {
    expect(racingMarketReadyToSettle("place", complete)).toBe(true);
    expect(racingMarketReadyToSettle("each_way", complete)).toBe(true);
    expect(racingMarketReadyToSettle("extra_place", complete)).toBe(true);
  });
});

describe("settleRacingBet with fast vs full results", () => {
  it("settles a winning win bet from a winner-only result", () => {
    const outcome = settleRacingBet(winBet("River Wharfe"), incomplete);
    expect(outcome?.status).toBe("won");
  });

  it("settles a losing win bet from a winner-only result", () => {
    const outcome = settleRacingBet(winBet("Aspire To Glory"), incomplete);
    expect(outcome?.status).toBe("lost");
  });

  it("settles place correctly once full placings land", () => {
    // fieldSize 16 non-hcap → 3 places; 2nd places, 8th does not
    expect(settleRacingBet(placeBet("Aspire To Glory"), complete)?.status).toBe("won");
    expect(settleRacingBet(placeBet("No Chance"), complete)?.status).toBe("lost");
  });
});

describe("settleRacingBet dual-lay extra place", () => {
  it("pays extra-place zone when finish is bookie-only place", () => {
    const bet = epBet("Fourth Extra");
    const outcome = settleRacingBet(bet, complete);
    expect(outcome?.status).toBe("won");
    expect(outcome?.explanation).toMatch(/Extra place/i);
    const expected = eachWayOutcomePnL(
      {
        stakePerPart: bet.ewMeta!.stakePerPart,
        winOdds: bet.backOdds,
        placeFraction: bet.ewMeta!.placeFraction,
        layWinStake: bet.ewMeta!.layWin.stake,
        layWinOdds: bet.ewMeta!.layWin.odds,
        layPlaceStake: bet.ewMeta!.layPlace.stake,
        layPlaceOdds: bet.ewMeta!.layPlace.odds,
        commission: bet.commission,
      },
      "extra_place"
    );
    expect(outcome?.profit).toBeCloseTo(expected.total, 2);
  });

  it("classifies standard place, win, and unplaced", () => {
    expect(settleRacingBet(epBet("Aspire To Glory"), complete)?.explanation).toMatch(
      /standard place/i
    );
    expect(settleRacingBet(epBet("River Wharfe"), complete)?.explanation).toMatch(/won/i);
    expect(settleRacingBet(epBet("No Chance"), complete)?.status).toBe("lost");
    expect(settleRacingBet(epBet("No Chance"), complete)?.explanation).toMatch(/Unplaced/i);
  });
});
