import { describe, expect, it } from "vitest";
import { analyzeOfferIntelligence, enrichImportantTerms } from "./index";
import { estimateBoostWinningsEv, estimateRiskFreeEv } from "./estimates";
import { emptyImportantTerms } from "@/lib/offers/offer-terms";

const GOLF_BOOST = `ON ANY GOLF THIS WEEKEND
BOOST YOUR SINGLE BY 18%
Betfair Sportsbook
Valid until 11:00pm on Sunday 12th of July on any Golf single.
Min odds 2.0 (1/1) or greater.
Maximum stake allowed for the boost is £25.
Bets placed with free bets do not qualify.
Cashed out bets do not qualify.`;

describe("estimateRiskFreeEv", () => {
  it("equalises £100 @ 3.00 / 3.10 with 75% SNR refund (hand-worked)", () => {
    // win = 200, lose = −100 + 75 = −25, L = 225 / 3.08 = 73.05
    // ifWin = 200 − 73.05×2.10 = 46.595, ifLose = −25 + 73.05×0.98 = 46.589
    expect(estimateRiskFreeEv(100, 100)).toBe(46.59);
  });
});

describe("estimateBoostWinningsEv", () => {
  it("estimates underlay profit for 18% boost at min odds", () => {
    const ev = estimateBoostWinningsEv({
      maxStake: 25,
      minOdds: 2,
      boostPercent: 18,
    });
    expect(ev).toBeGreaterThan(3);
    expect(ev).toBeLessThan(6);
  });
});

describe("analyzeOfferIntelligence", () => {
  it("classifies golf bet boost and estimates EP", () => {
    const result = analyzeOfferIntelligence({
      text: GOLF_BOOST,
      bookmaker: "Betfair",
      category: "golf",
      betStake: null,
      freeBetAmount: null,
      important: { ...emptyImportantTerms(), minOdds: 2, maxStake: 25 },
      qualifyingPlaces: [],
      expiresAt: null,
      isRacing: false,
    });

    expect(result.archetype).toBe("bet_boost");
    expect(result.signals.boostPercent).toBe(18);
    expect(result.signals.singlesOnly).toBe(true);
    expect(result.signals.noFreeBetsWithOffer).toBe(true);
    expect(result.expectedProfit).toBeGreaterThan(3);
    expect(result.instructions.length).toBeGreaterThan(2);
    expect(result.importantHints).toContain("Singles only");
    expect(result.importantHints.some((h) => /18%/.test(h))).toBe(true);
  });

  it("classifies bet and get free bet", () => {
    const result = analyzeOfferIntelligence({
      text: "Sky Bet - Bet £10 get £30 in free bets. Min odds 1/2. SNR.",
      bookmaker: "Sky Bet",
      category: "football",
      betStake: 10,
      freeBetAmount: 30,
      important: emptyImportantTerms(),
      qualifyingPlaces: [],
      expiresAt: null,
      isRacing: false,
    });

    expect(result.archetype).toBe("bet_get_free_bet");
    expect(result.expectedProfit).toBeGreaterThan(20);
    expect(result.instructions.some((s) => /qualifying/i.test(s))).toBe(true);
    expect(result.instructions.some((s) => /closest back\/lay/i.test(s))).toBe(true);
    expect(result.instructions.some((s) => /reasonably high odds/i.test(s))).toBe(true);
  });

  it("classifies money-back-if-loses ahead of bet&get amounts", () => {
    const result = analyzeOfferIntelligence({
      text: `MONEY BACK AS A FREE BET IF YOUR HORSE LOSES
BetMGM Second Chance. Max stake £100. Min odds 1/2 (1.50).
Each way excluded. Free bet expires in 3 days. SNR.
Money Back as a Free Bet will only occur if your bet loses.`,
      bookmaker: "BetMGM",
      category: "horse_racing",
      betStake: 100,
      freeBetAmount: 100,
      important: { ...emptyImportantTerms(), minOdds: 1.5, maxStake: 100 },
      qualifyingPlaces: [],
      expiresAt: null,
      isRacing: true,
    });
    expect(result.archetype).toBe("risk_free");
    expect(result.expectedProfit).toBe(46.59);
    expect(result.epExplanation).toMatch(/Refund-If underlay/);
    expect(result.instructions.some((s) => /underlay/i.test(s))).toBe(true);
    expect(result.instructions.some((s) => /minimise qualifying loss/i.test(s))).toBe(false);
  });

  it("classifies racing place refund", () => {
    const result = analyzeOfferIntelligence({
      text: "Get £10 back as free bet if your horse finishes 2nd or 3rd. Min 8 runners.",
      bookmaker: "Coral",
      category: "horse_racing",
      betStake: 10,
      freeBetAmount: 10,
      important: emptyImportantTerms(),
      qualifyingPlaces: [2, 3],
      expiresAt: null,
      isRacing: true,
    });

    expect(result.archetype).toBe("place_refund");
    expect(result.expectedProfit).toBeGreaterThan(0);
  });

  it("suggests Acca qualifier from ACCA bet&get paste without forcing reward Acca", () => {
    const text =
      "Bet £20 ACCA get £10 free bet. Minimum 3 selections. Min odds 2.0. SNR free bet.";
    const result = analyzeOfferIntelligence({
      text,
      bookmaker: "Ivybet",
      category: "football",
      betStake: 20,
      freeBetAmount: 10,
      important: emptyImportantTerms(),
      qualifyingPlaces: [],
      expiresAt: null,
      isRacing: false,
    });
    expect(result.signals.accaMention).toBe(true);
    expect(result.signals.rewardAcca).toBe(false);
    expect(result.signals.minSelections).toBe(3);
    const enriched = enrichImportantTerms(emptyImportantTerms(), result);
    expect(enriched.qualifierScopes).toEqual(["acca"]);
    expect(enriched.rewardScopes).toEqual(["single"]);
    expect(enriched.minSelections).toBe(3);
  });

  it("suggests reward Acca from free-bet Acca T&Cs alone", () => {
    const text =
      "Bet £10 get £10 free bet. Free bet must be used on an Acca. Minimum 4 selections.";
    const result = analyzeOfferIntelligence({
      text,
      bookmaker: "Sky Bet",
      category: "football",
      betStake: 10,
      freeBetAmount: 10,
      important: emptyImportantTerms(),
      qualifyingPlaces: [],
      expiresAt: null,
      isRacing: false,
    });
    expect(result.signals.rewardAcca).toBe(true);
    const enriched = enrichImportantTerms(emptyImportantTerms(), result);
    expect(enriched.rewardScopes).toEqual(["acca"]);
    expect(enriched.rewardMinSelections).toBe(4);
  });

  it("suggests Acca and Bet builder for Accas or Bet Builders offers", () => {
    const text =
      "FREE £5 BET - JUST BET £10 ON ACCAS OR BET BUILDERS. Qualifying bets must be a minimum of 3 legs or more on an acca or bet builder. You will receive a £5 free bet token to be used on bet builder/Acca markets only.";
    const result = analyzeOfferIntelligence({
      text,
      bookmaker: "Betfair",
      category: "football",
      betStake: 10,
      freeBetAmount: 5,
      important: emptyImportantTerms(),
      qualifyingPlaces: [],
      expiresAt: null,
      isRacing: false,
    });
    expect(result.signals.accaOrBetBuilder).toBe(true);
    expect(result.signals.rewardAccaOrBetBuilder).toBe(true);
    expect(result.signals.minSelections).toBe(3);
    const enriched = enrichImportantTerms(emptyImportantTerms(), result);
    expect(enriched.qualifierScopes).toEqual(["acca", "bet_builder"]);
    expect(enriched.rewardScopes).toEqual(["acca", "bet_builder"]);
    expect(enriched.minSelections).toBe(3);
    expect(enriched.rewardMinSelections).toBe(3);
  });
});
