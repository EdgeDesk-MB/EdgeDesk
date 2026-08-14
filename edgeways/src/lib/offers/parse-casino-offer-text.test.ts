import { describe, expect, it } from "vitest";
import {
  draftNeedsQualifyThenReward,
  parseCasinoOfferText,
} from "./parse-casino-offer-text";

describe("parseCasinoOfferText", () => {
  it("parses the classic stake-and-get promo: £20 bonus, 35x wagering", () => {
    const d = parseCasinoOfferText(
      "Sky Vegas\nStake £10 get a £20 casino bonus\n35x wagering applies. Selected slots only."
    );
    expect(d.casino).toBe("Sky Vegas");
    expect(d.title).toBe("Wager £10 get £20 bonus");
    expect(d.qualifyStake).toBe(10);
    expect(d.bonusAmount).toBe(20);
    expect(d.wageringMultiplier).toBe(35);
    expect(d.confidence).toBe("high");
  });

  it("synthesises Wager £X get £Y bonus from long Betfair-style T&Cs", () => {
    const d = parseCasinoOfferText(`
This offer is open to selected customers, aged 18 or over, in the United Kingdom.
This offer will be live from 00:00 on 03/08/2026 – 23:59 on 05/08/2026.
This offer refreshes daily.

What do you get?
You'll get a £1 bonus to play after completing the £10 bet requirement on an eligible game.
Your bonus will have a x1 wagering requirement and will expire 7 days after being awarded.

How do you get your bonus?
You must 'Opt in' to the promotion from this promotions page.
Play £10 on an eligible game.
Your bonus will be credited instantly upon completing the bet requirement.
`);
    expect(d.title).toBe("Wager £10 get £1 bonus");
    expect(d.qualifyStake).toBe(10);
    expect(d.bonusAmount).toBe(1);
    expect(d.wageringMultiplier).toBe(1);
    expect(d.likelyComponentType).toBe("bonus");
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
    expect(d.title).toBe("Wager £100 get 20 free spins");
  });

  it("spin value stated in pounds each: 'spins worth £0.50 each'", () => {
    const d = parseCasinoOfferText("50 free spins worth £0.50 each on Starburst.");
    expect(d.spins).toBe(50);
    expect(d.spinValue).toBeCloseTo(0.5, 10);
    expect(d.likelyComponentType).toBe("free_spins");
  });

  it("spin value stated as 'The value of each Free Spin is £0.10'", () => {
    const d = parseCasinoOfferText(
      "Earn up to 100 Free Spins on Age of the Gods.\nThe value of each Free Spin is £0.10.\nMaximum Free Spins winnings: £500."
    );
    expect(d.spins).toBe(100);
    expect(d.spinValue).toBeCloseTo(0.1, 10);
    expect(d.likelyComponentType).toBe("free_spins");
  });

  it("does not treat max winnings or a bare 'worth £X' as the per-spin value", () => {
    const d = parseCasinoOfferText(
      "Get 50 free spins worth £5 when you stake £10. Maximum Free Spins winnings: £500."
    );
    expect(d.spins).toBe(50);
    expect(d.spinValue).toBeNull();
    expect(d.bonusAmount).toBe(5);
  });

  it("does not populate spins/spinValue for a plain bonus offer", () => {
    const d = parseCasinoOfferText("Sky Vegas\nStake £10 get a £20 casino bonus\n35x wagering.");
    expect(d.spins).toBeNull();
    expect(d.spinValue).toBeNull();
    expect(d.likelyComponentType).toBe("bonus");
    expect(d.title).toBe("Wager £10 get £20 bonus");
  });

  it("titles free-spin rewards as Wager £X get N free spins", () => {
    const d = parseCasinoOfferText(
      "Get 50 free spins worth £0.50 each when you stake £10. Winnings paid in cash."
    );
    expect(d.title).toBe("Wager £10 get 50 free spins");
    expect(d.qualifyStake).toBe(10);
    expect(draftNeedsQualifyThenReward(d)).toBe(true);
  });

  it("flags wager-then-reward pastes for the two-step log wizard", () => {
    const d = parseCasinoOfferText(
      "GET A £1 BONUS WHEN YOU PLAY £10\nYour bonus will have a x1 wagering requirement."
    );
    expect(d.qualifyStake).toBe(10);
    expect(d.bonusAmount).toBe(1);
    expect(draftNeedsQualifyThenReward(d)).toBe(true);
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

  it("10bet Divine Wins ladder: £0.10 per spin, not the £0.40 default phrasing", () => {
    const d = parseCasinoOfferText(`
Hit the Opt In button
Play any game in the Divine Wins section
Earn up to 100 Free Spins on Age of the Gods: God of Storms 3 as you play
For the Free Spins bettor.

Significant Terms

Valid: 11/08 12:00 - 17/08 23:59; Opt-in required; Bet £25+ on the Divine Wins section for up to 100 Free Spins; T&Cs apply; 18+

The promotion runs from 11/08 12:00 to 17/08 23:59.
Opt in and bet £25+ in real money (from your Cash balance) on any qualifying game:
Earn Free Spins as you bet more, credited automatically based on your total bet:
The value of each Free Spin is £0.10.
Free Spins can be used on the following game: 'Age of the Gods: God of Storms 3'.
Free Spins must be used within 7 days.
Winnings from Free Spins are paid as cash.
Maximum Free Spins winnings: £500.
`);
    expect(d.qualifyStake).toBe(25);
    expect(d.spins).toBe(100);
    expect(d.spinValue).toBeCloseTo(0.1, 10);
    expect(d.likelyComponentType).toBe("free_spins");
    expect(draftNeedsQualifyThenReward(d)).toBe(true);
    expect(d.bonusAmount).toBeNull();
  });
});
