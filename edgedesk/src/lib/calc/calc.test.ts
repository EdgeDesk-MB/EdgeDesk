import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  decimalToAmerican,
  decimalToFractional,
  dutch,
  dutchStakeForProfit,
  eachWay,
  extraPlace,
  accaMatched,
  luckyLayMatrix,
  expectedValue,
  fractionalToDecimal,
  matchedBet,
  noVig,
  settleBet,
  twoUp,
  twoUpDutchScenarios,
  deriveOutcomes,
} from "./index";

describe("odds conversion", () => {
  it("decimal to fractional", () => {
    expect(decimalToFractional(3.0)).toBe("2/1");
    expect(decimalToFractional(1.5)).toBe("1/2");
    expect(decimalToFractional(2.25)).toBe("5/4");
  });
  it("fractional to decimal", () => {
    expect(fractionalToDecimal("2/1")).toBe(3);
    expect(fractionalToDecimal("1/2")).toBe(1.5);
    expect(fractionalToDecimal("nonsense")).toBeNull();
  });
  it("american round trips", () => {
    expect(decimalToAmerican(3)).toBe(200);
    expect(decimalToAmerican(1.5)).toBe(-200);
    expect(americanToDecimal(200)).toBe(3);
    expect(americanToDecimal(-200)).toBe(1.5);
  });
});

describe("matched betting calculator", () => {
  // Reference values cross-checked with public matched betting calculators
  it("qualifying bet: £10 back at 3.0, lay 3.1, 2% commission", () => {
    const r = matchedBet({ mode: "qualifying", backStake: 10, backOdds: 3, layOdds: 3.1, commission: 0.02 });
    expect(r.layStake).toBeCloseTo(9.74, 2);
    expect(r.profitIfBackWins).toBeCloseTo(-0.45, 2);
    expect(r.profitIfLayWins).toBeCloseTo(-0.45, 2);
  });

  it("free bet SNR: £25 at 5.0, lay 5.2, 2% commission", () => {
    const r = matchedBet({ mode: "free_snr", backStake: 25, backOdds: 5, layOdds: 5.2, commission: 0.02 });
    expect(r.layStake).toBeCloseTo(19.31, 2);
    // ~77% retention expected on a free bet at these odds
    expect(r.guaranteed).toBeGreaterThan(18.5);
    expect(Math.abs(r.profitIfBackWins - r.profitIfLayWins)).toBeLessThan(0.05);
  });

  it("free bet SR equalises both sides within pence rounding", () => {
    const r = matchedBet({ mode: "free_sr", backStake: 20, backOdds: 4, layOdds: 4.2, commission: 0.05 });
    expect(Math.abs(r.profitIfBackWins - r.profitIfLayWins)).toBeLessThan(0.02);
  });

  it("risk-free: refund retained at 70%", () => {
    const r = matchedBet({
      mode: "risk_free",
      backStake: 10,
      backOdds: 4,
      layOdds: 4.1,
      commission: 0.02,
      refundAmount: 10,
      refundRetention: 0.7,
    });
    expect(Math.abs(r.profitIfBackWins - r.profitIfLayWins)).toBeLessThan(0.02);
    expect(r.guaranteed).toBeGreaterThan(0); // risk-free bets are +EV both sides at close odds
  });
});

describe("dutching", () => {
  it("splits stakes for equal profit", () => {
    const r = dutch(
      [
        { label: "Home", odds: 2.5 },
        { label: "Draw", odds: 3.4 },
        { label: "Away", odds: 3.2 },
      ],
      100
    );
    const profits = r.legs.map((l) => l.profitIfWins);
    for (const p of profits) expect(p).toBeCloseTo(r.profit, 6);
    expect(r.legs.reduce((a, l) => a + l.stake, 0)).toBeCloseTo(100, 6);
    expect(r.overroundPct).toBeGreaterThan(0); // typical book is against you
  });

  it("finds an arb when implied < 1", () => {
    const legs = [
      { label: "A", odds: 2.1 },
      { label: "B", odds: 2.1 },
    ];
    const r = dutch(legs, 100);
    expect(r.profit).toBeGreaterThan(0);
    const stakeNeeded = dutchStakeForProfit(legs, 10);
    expect(stakeNeeded).not.toBeNull();
    expect(dutch(legs, stakeNeeded!).profit).toBeCloseTo(10, 6);
  });

  it("2up dutch windfall doubles the payout", () => {
    const s = twoUpDutchScenarios({ homeStake: 50, homeOdds: 2.2, awayStake: 40, awayOdds: 2.75 });
    const both = s.find((x) => x.label.includes("away comes back to WIN"))!;
    expect(both.profit).toBeCloseTo(50 * 2.2 + 40 * 2.75 - 90, 6);
  });
});

describe("2up early payout", () => {
  it("standard lay produces small qualifying loss and big windfall", () => {
    const r = twoUp({ backStake: 50, backOdds: 3, layOdds: 3.1, commission: 0.02 });
    expect(r.qualifyingLoss).toBeLessThan(0);
    expect(r.qualifyingLoss).toBeGreaterThan(-5);
    expect(r.windfallProfit).toBeGreaterThan(140); // 50*2 + lay winnings
  });
});

describe("each way", () => {
  it("computes place odds from terms and lays both parts", () => {
    const r = eachWay({
      stake: 10,
      winOdds: 9,
      placeFraction: 0.2,
      layWinOdds: 9.6,
      layPlaceOdds: 2.8,
      commission: 0.02,
    });
    expect(r.placeOdds).toBeCloseTo(2.6, 6);
    expect(r.totalOutlay).toBe(20);
    const spread = Math.max(r.profitIfWins, r.profitIfPlacesOnly, r.profitIfUnplaced) - r.worstCase;
    expect(spread).toBeLessThan(5);
  });
});

describe("extra place", () => {
  it("shows four outcomes and positive extra-place profit", () => {
    const r = extraPlace({
      stakePerPart: 10,
      winOdds: 12,
      placeFraction: 0.2,
      layWinOdds: 12.5,
      layPlaceOdds: 3.2,
      commission: 0.02,
      bookiePlaces: 4,
      exchangePlaces: 3,
    });
    expect(r.outcomes).toHaveLength(4);
    expect(r.profitIfExtraPlace).toBeGreaterThan(0);
    expect(r.qualifyingLoss).toBeLessThan(0);
    expect(r.impliedExtraPlaceOdds).toBeGreaterThan(1);
  });
});

describe("accumulator", () => {
  it("lucky 15 has 15 bets", () => {
    const legs = [
      { label: "A", backOdds: 2, layOdds: 2.02 },
      { label: "B", backOdds: 2.1, layOdds: 2.12 },
      { label: "C", backOdds: 1.9, layOdds: 1.92 },
      { label: "D", backOdds: 2.2, layOdds: 2.22 },
    ];
    const r = accaMatched("lucky_15", 1, legs, 0.02);
    expect(r?.structure.betCount).toBe(15);
    expect(r?.structure.totalStake).toBe(15);
  });

  it("lucky 31 lay matrix covers all outcomes", () => {
    const legs = Array.from({ length: 5 }, (_, i) => ({
      label: String.fromCharCode(65 + i),
      backOdds: 2 + i * 0.1,
      layOdds: 2.02 + i * 0.1,
    }));
    const r = luckyLayMatrix("lucky_31", 1, legs, 0.02);
    expect(r?.lays).toHaveLength(5);
    expect(r?.matrix).toHaveLength(32);
  });

  it("double layered lays balance roughly", () => {
    const legs = [
      { label: "A", backOdds: 2, layOdds: 2.02 },
      { label: "B", backOdds: 3, layOdds: 3.05 },
    ];
    const r = accaMatched("double", 10, legs, 0.02);
    expect(r?.layerLays).toHaveLength(2);
    expect(r?.scenarios?.length).toBe(3);
    expect(r?.worstCase).toBeLessThan(1);
  });
});

describe("EV and no-vig", () => {
  it("removes the vig", () => {
    const r = noVig([2.0, 1.9]);
    expect(r.fairProbabilities[0] + r.fairProbabilities[1]).toBeCloseTo(1, 9);
    expect(r.overroundPct).toBeGreaterThan(0);
  });
  it("positive EV when odds beat fair value", () => {
    const r = expectedValue(2.2, 0.5, 100); // fair odds 2.0, getting 2.2
    expect(r.evForStake).toBeCloseTo(10, 6);
    expect(r.edgePct).toBeCloseTo(10, 6);
  });
});

describe("settlement engine (result-centric)", () => {
  it("derives markets from a 2-1 score", () => {
    const o = deriveOutcomes({ homeScore: 2, awayScore: 1, homeLed2: false, awayLed2: false });
    expect(o.matchOdds).toBe("home");
    expect(o.btts).toBe("yes");
    expect(o.overUnder25).toBe("over");
  });

  it("settles a BTTS yes qualifying bet from the score alone", () => {
    const outcome = settleBet(
      {
        market: "btts",
        selection: "yes",
        betType: "qualifying",
        backStake: 10,
        backOdds: 1.9,
        layStake: 9.69,
        layOdds: 1.98,
        commission: 0.02,
      },
      { homeScore: 2, awayScore: 1, homeLed2: false, awayLed2: false }
    );
    expect(outcome!.status).toBe("won");
    expect(outcome!.profit).toBeCloseTo(10 * 0.9 - 9.69 * 0.98, 2);
  });

  it("settles a correct score bet when the final score matches", () => {
    const won = settleBet(
      {
        market: "correct_score",
        selection: "2-1",
        betType: "qualifying",
        backStake: 10,
        backOdds: 9,
        layStake: 8,
        layOdds: 10,
        commission: 0.02,
      },
      { homeScore: 2, awayScore: 1, homeLed2: false, awayLed2: false }
    );
    expect(won!.status).toBe("won");

    const lost = settleBet(
      {
        market: "correct_score",
        selection: "2-1",
        betType: "qualifying",
        backStake: 10,
        backOdds: 9,
        layStake: 8,
        layOdds: 10,
        commission: 0.02,
      },
      { homeScore: 1, awayScore: 1, homeLed2: false, awayLed2: false }
    );
    expect(lost!.status).toBe("lost");
  });

  it("2UP: team goes 2 up then draws → both sides pay (the £250 scenario)", () => {
    const outcome = settleBet(
      {
        market: "match_odds",
        selection: "home",
        betType: "qualifying",
        backStake: 50,
        backOdds: 3,
        layStake: 48.7,
        layOdds: 3.1,
        commission: 0.02,
        earlyPayout: true,
      },
      { homeScore: 2, awayScore: 2, homeLed2: true, awayLed2: false }
    );
    expect(outcome!.status).toBe("early_payout");
    // back paid early: +100, lay also wins: +47.73 → ~£147.73
    expect(outcome!.profit).toBeCloseTo(100 + 48.7 * 0.98, 1);
  });

  it("2UP not triggered: normal loss settlement", () => {
    const outcome = settleBet(
      {
        market: "match_odds",
        selection: "home",
        betType: "qualifying",
        backStake: 50,
        backOdds: 3,
        layStake: 48.7,
        layOdds: 3.1,
        commission: 0.02,
        earlyPayout: true,
      },
      { homeScore: 1, awayScore: 1, homeLed2: false, awayLed2: false }
    );
    expect(outcome!.status).toBe("lost");
    expect(outcome!.profit).toBeCloseTo(48.7 * 0.98 - 50, 2);
  });

  it("settles dutch legs including 2UP early payout legs", () => {
    const outcome = settleBet(
      {
        market: "match_odds",
        selection: "",
        betType: "dutch",
        backStake: 0,
        backOdds: 0,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        legs: [
          { label: "Home @ Bet365", market: "match_odds", selection: "home", odds: 2.2, stake: 55, earlyPayout: true },
          { label: "Away @ William Hill", market: "match_odds", selection: "away", odds: 2.75, stake: 45, earlyPayout: true },
        ],
      },
      // Home went 2-0 up, away came back to win 2-3: BOTH legs pay
      { homeScore: 2, awayScore: 3, homeLed2: true, awayLed2: false }
    );
    expect(outcome!.status).toBe("early_payout");
    expect(outcome!.profit).toBeCloseTo(55 * 1.2 + 45 * 1.75, 6);
  });

  it("returns null for markets it cannot derive (manual fallback)", () => {
    const outcome = settleBet(
      {
        market: "other",
        selection: "first goalscorer",
        betType: "qualifying",
        backStake: 10,
        backOdds: 8,
        layStake: 9,
        layOdds: 9,
        commission: 0.02,
      },
      { homeScore: 1, awayScore: 0, homeLed2: false, awayLed2: false }
    );
    expect(outcome).toBeNull();
  });
});
