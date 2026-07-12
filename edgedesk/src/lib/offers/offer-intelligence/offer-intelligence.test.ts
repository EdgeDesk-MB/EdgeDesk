import { describe, expect, it } from "vitest";
import { analyzeOfferIntelligence } from "./index";
import { estimateBoostWinningsEv } from "./estimates";
import { emptyImportantTerms } from "@/lib/offers/offer-terms";

const GOLF_BOOST = `ON ANY GOLF THIS WEEKEND
BOOST YOUR SINGLE BY 18%
Betfair Sportsbook
Valid until 11:00pm on Sunday 12th of July on any Golf single.
Min odds 2.0 (1/1) or greater.
Maximum stake allowed for the boost is £25.
Bets placed with free bets do not qualify.
Cashed out bets do not qualify.`;

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
      important: { minOdds: 2, minStake: null, maxStake: 25, importantNotes: "" },
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
});
