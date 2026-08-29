import { describe, expect, it } from "vitest";
import {
  campaignBetsAreComplete,
  canManuallyCompleteOffer,
  type OfferCompleteInput,
} from "./offer-complete";

function offer(partial: Partial<OfferCompleteInput> = {}): OfferCompleteInput {
  return {
    status: "active",
    betCount: 1,
    openBets: 0,
    ...partial,
    profit: {
      freeBetStage: "none",
      freeBetAwardAmount: null,
      ...partial.profit,
    },
  };
}

describe("campaignBetsAreComplete", () => {
  it("is false with no linked bets", () => {
    expect(campaignBetsAreComplete(0, false, "none")).toBe(false);
  });

  it("is false while a linked bet is still open", () => {
    expect(campaignBetsAreComplete(2, true, "none")).toBe(false);
  });

  it("is false while a free bet is awarded, in use, or awaiting result", () => {
    expect(campaignBetsAreComplete(1, false, "awarded")).toBe(false);
    expect(campaignBetsAreComplete(1, false, "in_use")).toBe(false);
    expect(campaignBetsAreComplete(1, false, "awaiting_result")).toBe(false);
  });

  it("is true once every bet is settled and the free-bet stage is idle", () => {
    expect(campaignBetsAreComplete(1, false, "none")).toBe(true);
    expect(campaignBetsAreComplete(2, false, "settled")).toBe(true);
    expect(campaignBetsAreComplete(1, false, "not_awarded")).toBe(true);
  });
});

describe("canManuallyCompleteOffer", () => {
  it("only allows an active campaign whose bets are complete", () => {
    expect(canManuallyCompleteOffer(offer())).toBe(true);
    expect(canManuallyCompleteOffer(offer({ status: "planned" }))).toBe(false);
    expect(canManuallyCompleteOffer(offer({ openBets: 1 }))).toBe(false);
    expect(
      canManuallyCompleteOffer(offer({ profit: { freeBetStage: "awarded", freeBetAwardAmount: 10 } }))
    ).toBe(false);
  });
});
