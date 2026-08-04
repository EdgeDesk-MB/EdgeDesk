import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  decimalToAmerican,
  decimalToFractional,
  dutch,
  dutchStakeForProfit,
  dutchStakeForLegStake,
  dutchStakesForFreeLeg,
  eachWay,
  extraPlace,
  accaMatched,
  luckyLayMatrix,
  expectedValue,
  fractionalToDecimal,
  matchedBet,
  noVig,
  settleBet,
  settleFromOutcome,
  settlePartialOutcome,
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

  it("special bonus: free bet on lose equalises with retention", () => {
    const r = matchedBet({
      mode: "qualifying",
      backStake: 10,
      backOdds: 3,
      layOdds: 3.1,
      commission: 0.02,
      specialBonus: { kind: "free_bet_on_lose", amount: 10, freeBetRetention: 0.7 },
    });
    expect(Math.abs(r.profitIfBackWins - r.profitIfLayWins)).toBeLessThan(0.02);
    // Same as risk_free at 70% retention
    const rf = matchedBet({
      mode: "risk_free",
      backStake: 10,
      backOdds: 3,
      layOdds: 3.1,
      commission: 0.02,
      refundAmount: 10,
      refundRetention: 0.7,
    });
    expect(r.layStake).toBeCloseTo(rf.layStake, 2);
    expect(r.guaranteed).toBeCloseTo(rf.guaranteed, 2);
  });

  it("special bonus: double winnings increases lay stake", () => {
    const base = matchedBet({
      mode: "qualifying",
      backStake: 10,
      backOdds: 3,
      layOdds: 3.1,
      commission: 0.02,
    });
    const doubled = matchedBet({
      mode: "qualifying",
      backStake: 10,
      backOdds: 3,
      layOdds: 3.1,
      commission: 0.02,
      specialBonus: { kind: "double_winnings" },
    });
    expect(doubled.layStake).toBeGreaterThan(base.layStake);
    expect(Math.abs(doubled.profitIfBackWins - doubled.profitIfLayWins)).toBeLessThan(0.02);
  });
});

describe("partial settlement (Ultimatcher Pending)", () => {
  const base = {
    market: "match_odds" as const,
    selection: "home",
    betType: "qualifying" as const,
    backStake: 10,
    backOdds: 3,
    layStake: 9.74,
    layOdds: 3.1,
    commission: 0.02,
  };

  it("push and void are flat", () => {
    expect(settlePartialOutcome(base, "push").profit).toBe(0);
    expect(settlePartialOutcome(base, "void").status).toBe("void");
  });

  it("half win averages win and lose P&L", () => {
    const half = settlePartialOutcome(base, "half_win");
    const win = settleFromOutcome(base, true).profit;
    const lose = settleFromOutcome(base, false).profit;
    expect(half.profit).toBeCloseTo((win + lose) / 2, 4);
    expect(half.status).toBe("half_win");
  });

  it("boost betType matches qualifying stake maths (J2b)", () => {
    // Hand: back £10 @ 3.0, lay £9.74 @ 3.1, c=2%.
    // Back wins: bookie +(10*(3-1))=+20; exchange −(9.74*(3.1-1))=−20.454 → −0.454
    // Back loses: bookie −10; exchange +(9.74*(1-0.02))=+9.5452 → −0.4548
    const boost = { ...base, betType: "boost" as const };
    const qual = { ...base, betType: "qualifying" as const };
    expect(settleFromOutcome(boost, true).profit).toBeCloseTo(
      settleFromOutcome(qual, true).profit,
      6
    );
    expect(settleFromOutcome(boost, false).profit).toBeCloseTo(
      settleFromOutcome(qual, false).profit,
      6
    );
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

  // Hand-worked: odds 2.0 / 3.0, inverses 0.5 / 0.33333..., S = 0.833333...
  // Fixing leg 0 (odds 2.0) at £40: totalStake = 40 × 2 × S = 66.666667.
  // Leg 0 must recover to exactly £40; leg 1 = totalStake × (1/3)/S = 26.666667.
  // profit = totalStake/S − totalStake = 80 − 66.666667 = 13.333333.
  it("dutchStakeForLegStake: fixing one leg's stake recovers it exactly", () => {
    const legs = [
      { label: "A", odds: 2.0 },
      { label: "B", odds: 3.0 },
    ];
    const totalStake = dutchStakeForLegStake(legs, 0, 40);
    expect(totalStake).not.toBeNull();
    expect(totalStake!).toBeCloseTo(66.666667, 5);
    const r = dutch(legs, totalStake!);
    expect(r.legs[0].stake).toBeCloseTo(40, 6);
    expect(r.legs[1].stake).toBeCloseTo(26.666667, 5);
    expect(r.profit).toBeCloseTo(13.333333, 5);
  });

  it("dutchStakeForLegStake guards a bad leg index or non-positive stake", () => {
    const legs = [
      { label: "A", odds: 2.0 },
      { label: "B", odds: 3.0 },
    ];
    expect(dutchStakeForLegStake(legs, 5, 40)).toBeNull();
    expect(dutchStakeForLegStake(legs, 0, 0)).toBeNull();
    expect(dutchStakeForLegStake(legs, 0, -10)).toBeNull();
  });

  // Hand-worked: free bet (SNR) £20 @ 2.0 on leg 0 → freeProfit = 20×(2.0−1) = 20.
  // Cash leg 1 @ 1.5 must return exactly £20 whichever leg wins:
  // x1 = freeProfit / 1.5 = 13.333333. Guaranteed profit = 20 − 13.333333 = 6.666667.
  it("dutchStakesForFreeLeg (SNR): cash leg solved so both outcomes pay the free leg's win profit", () => {
    const legs = [
      { label: "Free bet", odds: 2.0 },
      { label: "Cash", odds: 1.5 },
    ];
    const r = dutchStakesForFreeLeg(legs, 0, 20, "snr");
    expect(r).not.toBeNull();
    expect(r!.legs[0].stake).toBeCloseTo(20, 6);
    expect(r!.legs[1].stake).toBeCloseTo(13.333333, 5);
    expect(r!.profit).toBeCloseTo(6.666667, 5);
    // Equal profit whichever leg actually wins (free leg costs nothing if it
    // loses; the cash leg's stake is the only real money at risk either way)
    const freeWins = r!.legs[0].stake * (legs[0].odds - 1) - r!.legs[1].stake;
    const cashWins = r!.legs[1].stake * legs[1].odds - r!.legs[1].stake;
    expect(freeWins).toBeCloseTo(r!.profit, 5);
    expect(cashWins).toBeCloseTo(r!.profit, 5);
  });

  // Hand-worked SR variant: stake IS paid out on top of winnings, so
  // freeProfit = 20×2.0 = 40. x1 = 40/1.5 = 26.666667, profit = 40−26.666667 = 13.333333.
  it("dutchStakesForFreeLeg (SR): the free leg's stake counts fully as profit on win", () => {
    const legs = [
      { label: "Free bet", odds: 2.0 },
      { label: "Cash", odds: 1.5 },
    ];
    const r = dutchStakesForFreeLeg(legs, 0, 20, "sr");
    expect(r!.legs[1].stake).toBeCloseTo(26.666667, 5);
    expect(r!.profit).toBeCloseTo(13.333333, 5);
  });

  it("dutchStakesForFreeLeg: three-way book with two cash legs still equalises", () => {
    const legs = [
      { label: "Free bet", odds: 2.5 },
      { label: "Draw", odds: 3.4 },
      { label: "Away", odds: 3.2 },
    ];
    const r = dutchStakesForFreeLeg(legs, 0, 10, "snr");
    expect(r).not.toBeNull();
    expect(r!.legs[1].stake).toBeCloseTo(4.411765, 5);
    expect(r!.legs[2].stake).toBeCloseTo(4.6875, 5);
    expect(r!.profit).toBeCloseTo(5.900735, 4);
    for (const leg of r!.legs) expect(leg.profitIfWins).toBeCloseTo(r!.profit, 6);
  });

  it("dutchStakesForFreeLeg guards a bad leg index or non-positive stake", () => {
    const legs = [
      { label: "A", odds: 2.0 },
      { label: "B", odds: 3.0 },
    ];
    expect(dutchStakesForFreeLeg(legs, 5, 20, "snr")).toBeNull();
    expect(dutchStakesForFreeLeg(legs, 0, 0, "snr")).toBeNull();
    expect(dutchStakesForFreeLeg(legs, 0, -10, "snr")).toBeNull();
    expect(dutchStakesForFreeLeg([legs[0]], 0, 20, "snr")).toBeNull();
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

  // Hand-worked: Home leg is a free bet (SNR) £55 @ 2.2, Away leg is cash £45 @ 2.75.
  // Home wins: free profit = 55×(2.2−1) = 66; Away (cash) loses its stake = −45.
  // Total = 66 − 45 = 21. A losing free leg costs nothing (already sunk).
  it("settles a dutch free-bet (SNR) leg: it costs nothing if it loses", () => {
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
          { label: "Home", market: "match_odds", selection: "home", odds: 2.2, stake: 55, freeBet: "snr" },
          { label: "Away", market: "match_odds", selection: "away", odds: 2.75, stake: 45 },
        ],
      },
      { homeScore: 2, awayScore: 0, homeLed2: false, awayLed2: false }
    );
    expect(outcome!.status).toBe("won");
    expect(outcome!.profit).toBeCloseTo(66 - 45, 6);
  });

  // SR variant: the free leg's stake is paid out on top of winnings when it
  // wins (profit = 55×2.2 = 121), and still costs nothing when it loses.
  it("settles a dutch free-bet (SR) leg: full stake counts as profit on win, zero cost on loss", () => {
    const wins = settleBet(
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
          { label: "Home", market: "match_odds", selection: "home", odds: 2.2, stake: 55, freeBet: "sr" },
          { label: "Away", market: "match_odds", selection: "away", odds: 2.75, stake: 45 },
        ],
      },
      { homeScore: 2, awayScore: 0, homeLed2: false, awayLed2: false }
    );
    expect(wins!.profit).toBeCloseTo(55 * 2.2 - 45, 6);

    const loses = settleBet(
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
          { label: "Home", market: "match_odds", selection: "home", odds: 2.2, stake: 55, freeBet: "sr" },
          { label: "Away", market: "match_odds", selection: "away", odds: 2.75, stake: 45 },
        ],
      },
      { homeScore: 0, awayScore: 1, homeLed2: false, awayLed2: false }
    );
    // Free (SR) leg loses: costs nothing. Cash leg (Away) wins: 45×(2.75−1).
    expect(loses!.profit).toBeCloseTo(45 * 1.75, 6);
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
