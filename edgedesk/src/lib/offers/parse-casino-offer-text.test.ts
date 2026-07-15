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
