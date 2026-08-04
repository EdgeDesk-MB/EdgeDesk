import { describe, expect, it } from "vitest";
import {
  offerNeedsInventedPlaceRepair,
  repairInventedPlaceRulesOnUnconditionalOffers,
} from "./repair-invented-place-rules";
import { db, offers } from "@/lib/db";
import { parseOfferRules } from "./racing-offer-rules";

function seedOffer(partial: {
  title: string;
  qualifyingPlaces: number[];
  description?: string;
}) {
  const rules = {
    type: "bet_get_free_place" as const,
    minRunners: 8,
    regions: ["GB", "IRE"] as ("GB" | "IRE")[],
    qualifyingPlaces: partial.qualifyingPlaces,
    betStake: 5,
    freeBetAmount: 5,
  };
  const result = db
    .insert(offers)
    .values({
      title: partial.title,
      bookmaker: "Ladbrokes",
      description:
        partial.description ??
        "Bet £5 get £5 free if places 2, 3, 4 · min 8 runners · GB & IRE",
      expectedProfit: 3.6,
      status: "active",
      createdAt: Date.now(),
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      scopeCourse: "Galway",
      eventDate: "2026-08-02",
      rules: JSON.stringify(rules),
    })
    .run();
  return Number(result.lastInsertRowid);
}

describe("repairInventedPlaceRulesOnUnconditionalOffers", () => {
  it("detects unconditional titles with invented places", () => {
    expect(
      offerNeedsInventedPlaceRepair({
        title: "Bet £5 get £5 free bet",
        offerType: "bet_get_free_place",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 8,
          regions: ["GB"],
          qualifyingPlaces: [2, 3, 4],
          betStake: 5,
          freeBetAmount: 5,
        }),
      })
    ).toBe(true);
  });

  it("leaves genuine place-refund titles alone", () => {
    expect(
      offerNeedsInventedPlaceRepair({
        title: "Bet £50 get £50 free bet (2nd–4th place)",
        offerType: "bet_get_free_place",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 8,
          regions: ["GB"],
          qualifyingPlaces: [2, 3, 4],
          betStake: 50,
          freeBetAmount: 50,
        }),
      })
    ).toBe(false);
  });

  it("clears invented places and rewrites the summary", () => {
    const id = seedOffer({
      title: "Bet £5 get £5 free bet",
      qualifyingPlaces: [2, 3, 4],
    });
    const genuineId = seedOffer({
      title: "Bet £50 get £50 free bet (2nd–4th place)",
      qualifyingPlaces: [2, 3, 4],
      description: "Bet £50 get £50 free if places 2, 3, 4 · min 8 runners · GB & IRE",
    });

    expect(repairInventedPlaceRulesOnUnconditionalOffers()).toEqual({ fixed: 1 });

    const fixed = db.select().from(offers).all().find((o) => o.id === id)!;
    expect(parseOfferRules(fixed)?.qualifyingPlaces).toEqual([]);
    expect(fixed.description).toContain("Bet £5 get £5 free · min 8 runners");
    expect(fixed.description).not.toContain("if places");

    const genuine = db.select().from(offers).all().find((o) => o.id === genuineId)!;
    expect(parseOfferRules(genuine)?.qualifyingPlaces).toEqual([2, 3, 4]);
  });
});
