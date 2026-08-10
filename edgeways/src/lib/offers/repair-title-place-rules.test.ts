import { describe, expect, it, beforeEach } from "vitest";
import { db, offers } from "@/lib/db";
import {
  extractPlacesFromBetGetTitle,
  formatBetGetTitlePlaceClause,
  offerNeedsTitlePlaceRepair,
  offerNeedsTitleSyncFromRules,
  repairMismatchedTitlePlaceRules,
  syncBetGetTitleWithPlaces,
} from "./repair-title-place-rules";

beforeEach(() => {
  db.delete(offers).run();
});

describe("extractPlacesFromBetGetTitle", () => {
  it("reads 2nd, 3rd, 4th from a parenthetical title", () => {
    expect(
      extractPlacesFromBetGetTitle("Bet £20 get £20 free bet (2nd, 3rd, 4th)")
    ).toEqual([2, 3, 4]);
  });

  it("reads 2nd–4th range titles", () => {
    expect(
      extractPlacesFromBetGetTitle("Bet £50 get £50 free bet (2nd–4th place)")
    ).toEqual([2, 3, 4]);
  });

  it("reads 3rd, 4th when that is what the title says", () => {
    expect(extractPlacesFromBetGetTitle("Bet £50 get £50 free bet (3rd, 4th)")).toEqual([
      3, 4,
    ]);
  });

  it("reads 2nd to SP favourite titles as [2]", () => {
    expect(
      extractPlacesFromBetGetTitle("Bet £10 get £10 free bet (2nd to SP favourite)")
    ).toEqual([2]);
  });
});

describe("syncBetGetTitleWithPlaces", () => {
  it("rewrites a stale OCR place clause from saved rules", () => {
    expect(
      syncBetGetTitleWithPlaces("Bet £10 get £10 free bet (4th, 6th)", [2], {
        winnerMustBeSpFavourite: true,
      })
    ).toBe("Bet £10 get £10 free bet (2nd to SP favourite)");
  });

  it("strips the place clause when rules have no places", () => {
    expect(syncBetGetTitleWithPlaces("Bet £10 get £10 free bet (4th, 6th)", [])).toBe(
      "Bet £10 get £10 free bet"
    );
  });

  it("formats ordinary place lists with ordinals", () => {
    expect(formatBetGetTitlePlaceClause([4, 6])).toBe("4th, 6th");
  });
});

describe("repairMismatchedTitlePlaceRules", () => {
  it("restores [2,3,4] when title says 2nd–4th but rules only have 3rd/4th", () => {
    db.insert(offers)
      .values({
        bookmaker: "Betfair Sportsbook",
        title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
        description: null,
        expectedProfit: 12,
        status: "completed",
        createdAt: Date.now(),
        sport: "horse_racing",
        offerType: "bet_get_free_place",
        scopeCourse: "all",
        eventDate: "2026-08-06",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 8,
          regions: ["GB", "IRE"],
          qualifyingPlaces: [3, 4],
          betStake: 20,
          freeBetAmount: 20,
        }),
      })
      .run();

    expect(
      offerNeedsTitlePlaceRepair(db.select().from(offers).all()[0]!)
    ).toBe(true);
    expect(repairMismatchedTitlePlaceRules()).toEqual({ fixed: 1, titlesSynced: 0 });

    const row = db.select().from(offers).all()[0]!;
    expect(JSON.parse(row.rules!).qualifyingPlaces).toEqual([2, 3, 4]);
    expect(offerNeedsTitlePlaceRepair(row)).toBe(false);
  });

  it("leaves a genuine 3rd/4th title alone", () => {
    db.insert(offers)
      .values({
        bookmaker: "Betfair Sportsbook",
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        description: null,
        expectedProfit: 12,
        status: "active",
        createdAt: Date.now(),
        sport: "horse_racing",
        offerType: "bet_get_free_place",
        scopeCourse: "all",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 8,
          regions: ["GB", "IRE"],
          qualifyingPlaces: [3, 4],
          betStake: 50,
          freeBetAmount: 50,
        }),
      })
      .run();

    expect(repairMismatchedTitlePlaceRules()).toEqual({ fixed: 0, titlesSynced: 0 });
  });

  it("does not clobber a user edit of places when the OCR title is still stale", () => {
    db.insert(offers)
      .values({
        bookmaker: "QuinnBet",
        title: "Bet £10 get £10 free bet (4th, 6th)",
        description: null,
        expectedProfit: 5,
        status: "active",
        createdAt: Date.now(),
        sport: "horse_racing",
        offerType: "bet_get_free_place",
        scopeCourse: "uk_ire",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 6,
          regions: ["GB", "IRE"],
          qualifyingPlaces: [2],
          betStake: 10,
          freeBetAmount: 10,
          winnerMustBeSpFavourite: true,
        }),
      })
      .run();

    const before = db.select().from(offers).all()[0]!;
    expect(offerNeedsTitlePlaceRepair(before)).toBe(false);
    expect(offerNeedsTitleSyncFromRules(before)).toBe(true);

    expect(repairMismatchedTitlePlaceRules()).toEqual({ fixed: 0, titlesSynced: 1 });

    const row = db.select().from(offers).all()[0]!;
    expect(JSON.parse(row.rules!).qualifyingPlaces).toEqual([2]);
    expect(JSON.parse(row.rules!).winnerMustBeSpFavourite).toBe(true);
    expect(row.title).toBe("Bet £10 get £10 free bet (2nd to SP favourite)");
  });
});
