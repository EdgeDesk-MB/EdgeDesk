import { describe, expect, it } from "vitest";
import {
  buildCampaignImportantDisplay,
  buildCampaignScopeLine,
} from "./offer-campaign-details";
import type { OfferSummary } from "@/lib/services/offers.types";
import { emptyImportantTerms } from "./offer-terms";

function offer(partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">): OfferSummary {
  return {
    id: partial.id,
    bookmaker: partial.bookmaker ?? "Betfair Sportsbook",
    title: partial.title,
    description: null,
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
});
