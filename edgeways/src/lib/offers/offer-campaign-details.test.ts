import { describe, expect, it } from "vitest";
import {
  buildCampaignDetailsContext,
  buildCampaignImportantDisplay,
  buildCampaignScopeLine,
  campaignDetailTextsOverlap,
  filterImportantNotesForDisplay,
} from "./offer-campaign-details";
import type { OfferSummary } from "@/lib/services/offers.types";
import { emptyImportantTerms } from "./offer-terms";

function offer(partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">): OfferSummary {
  return {
    id: partial.id,
    bookmaker: partial.bookmaker ?? "Betfair Sportsbook",
    title: partial.title,
    description: partial.description ?? null,
    expectedProfit: null,
    status: partial.status ?? "active",
    sport: partial.sport ?? "horse_racing",
    offerType: partial.offerType ?? "bet_get_free_place",
    rules: partial.rules ?? null,
    scopeCourse: partial.scopeCourse ?? "uk_ire",
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: partial.eventDate ?? null,
    expiresAt: null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: null,
    createdAt: Date.now(),
    betCount: 0,
    openBets: 0,
    actualProfit: 0,
    expectedFromBets: 0,
    profit: {
      qualifyingProfit: 0,
      qualifyingSettledCount: 0,
      qualifyingOpenCount: 0,
      freeBetAwarded: false,
      freeBetAwardAmount: null,
      freeBetAwardReason: null,
      freeBetStage: "none",
      freeBetProfit: 0,
      freeBetOpenCount: 0,
      freeBetSettledCount: 0,
      openExpectedProfit: 0,
      totalProfit: 0,
    },
  };
}

describe("buildCampaignScopeLine", () => {
  const rulesSummary =
    "Bet £50 get £50 free if places 3, 4 · min 8 runners · GB & IRE";

  it("hides parser junk scopeCourse any", () => {
    const line = buildCampaignScopeLine(
      offer({ id: 1, title: "Test", scopeCourse: "any" }),
      rulesSummary
    );
    expect(line).toBeNull();
  });

  it("hides redundant UK & Ireland when rules already list regions", () => {
    const line = buildCampaignScopeLine(
      offer({ id: 2, title: "Test", scopeCourse: "uk_ire" }),
      rulesSummary
    );
    expect(line).toBeNull();
  });
});

describe("buildCampaignImportantDisplay", () => {
  it("keeps workflow notes intact without splitting on middle dots", () => {
    const text = buildCampaignImportantDisplay(
      {
        ...emptyImportantTerms(),
        importantNotes:
          "Singles only · Cash out voids offer\n\nHow to match:\n1. First step\n2. Second step",
      },
      null,
      null
    );
    expect(text).toContain("How to match:");
    expect(text).toContain("1. First step");
    expect(text).not.toMatch(/\nany\n/);
  });

  it("strips deposit / promo / opt-in bullets already owned by Steps", () => {
    const text = filterImportantNotesForDisplay(
      "ProgressPlay network · Opt-in required · Promo code UEFA · Deposit £30+ first · Cash out voids offer · SNR free bet",
      {
        ...emptyImportantTerms(),
        promoCode: "UEFA",
        minDeposit: 30,
        depositRequired: true,
      },
      {
        alreadyShown: [
          "Deposit £30+ with code UEFA",
          "Deposit into Dynobet via the sports cashier. Enter promo code UEFA on deposit.",
        ],
        stripHowToMatch: true,
      }
    );
    expect(text).toBe(
      "ProgressPlay network · Cash out voids offer · SNR free bet"
    );
  });
});

describe("buildCampaignDetailsContext", () => {
  const howToMatch =
    "Cash out voids offer · SNR free bet · Expires Fri 14 Aug, 23:59\n\nHow to match:\n1. Place qualifying cash bet of £10 on Ladbrokes.";

  it("drops descriptionLine when it duplicates the important warning box", () => {
    const ctx = buildCampaignDetailsContext(
      offer({
        id: 10,
        title: "Bet £10 get £10 free bet",
        sport: "general",
        offerType: "promo_terms",
        description: howToMatch,
        rules: JSON.stringify({
          type: "promo_terms",
          importantNotes: howToMatch,
        }),
      })
    );
    expect(ctx.uniqueImportant).toContain("How to match:");
    expect(ctx.descriptionLine).toBeNull();
  });

  it("keeps distinct description when it adds context beyond important notes", () => {
    const ctx = buildCampaignDetailsContext(
      offer({
        id: 11,
        title: "Bet £10 get £10 free bet",
        sport: "general",
        offerType: "promo_terms",
        description: "Extra campaign context only shown in description.",
        rules: JSON.stringify({
          type: "promo_terms",
          importantNotes: "SNR free bet · min odds 2.0",
        }),
      })
    );
    expect(ctx.descriptionLine).toContain("Extra campaign context");
    expect(ctx.uniqueImportant).toContain("SNR free bet");
  });
});

describe("campaignDetailTextsOverlap", () => {
  it("detects near-identical blocks", () => {
    expect(
      campaignDetailTextsOverlap(
        "Cash out voids offer · SNR free bet",
        "Cash out voids offer · SNR free bet · Expires Fri 14 Aug"
      )
    ).toBe(true);
  });
});
