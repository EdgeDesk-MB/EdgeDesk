import { describe, expect, it } from "vitest";
import { parseCasinoOfferText } from "./parse-casino-offer-text";

describe("parseCasinoOfferText", () => {
  it("parses the classic stake-and-get promo: £20 bonus, 35x wagering", () => {
    const d = parseCasinoOfferText(
      "Sky Vegas\nStake £10 get a £20 casino bonus\n35x wagering applies. Selected slots only."
    );
    expect(d.casino).toBe("Sky Vegas");
    expect(d.title).toBe("Stake £10 get a £20 casino bonus");
    expect(d.bonusAmount).toBe(20);
    expect(d.wageringMultiplier).toBe(35);
    expect(d.confidence).toBe("high");
  });

  it("parses deposit match with explicit wagering requirement, contribution and RTP", () => {
    const d = parseCasinoOfferText(
      "100% deposit match up to £100. Wagering requirement: 40x. Slots contribute 100%. Game RTP 96.5%."
    );
    expect(d.bonusAmount).toBe(100);
    expect(d.wageringMultiplier).toBe(40);
    expect(d.contributionPct).toBe(1);
    expect(d.rtp).toBeCloseTo(0.965, 10);
    expect(d.confidence).toBe("high");
  });

  it("free spins with a stated worth: bonus £5, no wagering found → medium", () => {
    const d = parseCasinoOfferText(
      "Get 50 free spins worth £5 when you stake £10. Winnings paid in cash."
    );
    expect(d.bonusAmount).toBe(5);
    expect(d.wageringMultiplier).toBeNull();
    expect(d.confidence).toBe("medium");
  });

  it('understands "wagered 35 times" phrasing', () => {
    const d = parseCasinoOfferText(
      "£25 casino bonus. The bonus must be wagered 35 times before withdrawal."
    );
    expect(d.bonusAmount).toBe(25);
    expect(d.wageringMultiplier).toBe(35);
  });

  it('understands "x30 playthrough" phrasing', () => {
    const d = parseCasinoOfferText("£25 bonus, x30 playthrough, slots only.");
    expect(d.bonusAmount).toBe(25);
    expect(d.wageringMultiplier).toBe(30);
  });

  it("recognises a known brand and returns the app-canonical name", () => {
    const d = parseCasinoOfferText(
      "Betfair: get a £10 casino bonus with 20x wagering on selected games."
    );
    // matchBookmakerFromText resolves aliases to the account-canonical brand
    expect(d.casino).toBe("Betfair Sportsbook");
  });

  it("40% contribution games inflate the parsed contribution correctly", () => {
    const d = parseCasinoOfferText(
      "£10 bonus, 30x wagering. Table games contribute 40% to wagering."
    );
    expect(d.contributionPct).toBeCloseTo(0.4, 10);
  });

  it("garbage in → low confidence, nulls, empty-ish title", () => {
    const d = parseCasinoOfferText("hello world nothing to see");
    expect(d.bonusAmount).toBeNull();
    expect(d.wageringMultiplier).toBeNull();
    expect(d.rtp).toBeNull();
    expect(d.contributionPct).toBeNull();
    expect(d.confidence).toBe("low");
  });

  it("does not mistake the qualifying stake for the bonus", () => {
    const d = parseCasinoOfferText("Stake £10 on slots and get a £30 bonus. 40x wagering.");
    expect(d.bonusAmount).toBe(30);
  });
});

describe("parseCasinoOfferText - K1 reward-type detection", () => {
  it("the Grosvenor shape: '20 Free Spins when you play £100', spins worth 40p each", () => {
    const d = parseCasinoOfferText(
      "Grosvenor\nGrab Your Exclusive Big Bass Football Bonanza Offer!\n" +
        "Opt in to be on your way to 20 Free Spins on Big Bass Football Bonanza!\n" +
        "20 Free Spins on Big Bass Football Bonanza worth 40p each will be rewarded when " +
        "£100 has been wagered on eligible casino games."
    );
    expect(d.spins).toBe(20);
    expect(d.spinValue).toBeCloseTo(0.4, 10);
    expect(d.likelyComponentType).toBe("free_spins");
  });

  it("spin value stated in pounds each: 'spins worth £0.50 each'", () => {
    const d = parseCasinoOfferText("50 free spins worth £0.50 each on Starburst.");
    expect(d.spins).toBe(50);
    expect(d.spinValue).toBeCloseTo(0.5, 10);
    expect(d.likelyComponentType).toBe("free_spins");
  });

  it("does not populate spins/spinValue for a plain bonus offer", () => {
    const d = parseCasinoOfferText("Sky Vegas\nStake £10 get a £20 casino bonus\n35x wagering.");
    expect(d.spins).toBeNull();
    expect(d.spinValue).toBeNull();
    expect(d.likelyComponentType).toBe("bonus");
  });

  it("golden chips: '10 golden chips worth £5 each' on roulette", () => {
    const d = parseCasinoOfferText("Get 10 golden chips worth £5 each to play on Roulette.");
    expect(d.chipCount).toBe(10);
    expect(d.chipValue).toBeCloseTo(5, 10);
    expect(d.likelyComponentType).toBe("golden_chips");
  });

  it("cashback: '10% cashback up to £50' on losses", () => {
    const d = parseCasinoOfferText("Get 10% cashback on your losses, up to £50 this week.");
    expect(d.cashbackPct).toBeCloseTo(0.1, 10);
    expect(d.likelyComponentType).toBe("cashback");
  });

  it("garbage in → all K1 fields null, likelyComponentType defaults to bonus", () => {
    const d = parseCasinoOfferText("hello world nothing to see");
    expect(d.spins).toBeNull();
    expect(d.spinValue).toBeNull();
    expect(d.chipCount).toBeNull();
    expect(d.chipValue).toBeNull();
    expect(d.cashbackPct).toBeNull();
    expect(d.likelyComponentType).toBe("bonus");
  });

  it("spins detection does not disturb the legacy bonusAmount-from-worth parsing", () => {
    // Pre-K1 behaviour test above ("free spins with a stated worth") must still pass
    // unchanged - this pins that the new spins/spinValue fields are ADDITIVE.
    const d = parseCasinoOfferText(
      "Get 50 free spins worth £5 when you stake £10. Winnings paid in cash."
    );
    expect(d.bonusAmount).toBe(5);
    expect(d.spins).toBe(50);
  });
});
