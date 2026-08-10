import { describe, expect, it } from "vitest";
import type { OfferRow } from "@/lib/db/schema";
import {
  courseMatchesScope,
  encodeScopeCourses,
  formatBetGetFreePlaceSummary,
  formatOfferScopeLabel,
  offerHasResultTrigger,
  parseOfferRules,
  parseScopeCourses,
  placeRefundTriggerText,
  countOfferQualifyingRaces,
  raceQualifiesForOffer,
  scorePlaceRefundRunners,
  scorePlaceRefundStrategy,
} from "./racing-offer-rules";

const baseOffer: OfferRow = {
  id: 1,
  bookmaker: "Betfair Sportsbook",
  title: "Bet £50 get £50",
  description: null,
  expectedProfit: 45,
  status: "active",
  expiresAt: null,
  createdAt: Date.now(),
  completedAt: null,
  seriesId: null,
  instanceDate: null,
  startsOn: null,
  source: null,
  offerUrl: null,
  sport: "horse_racing",
  offerType: "bet_get_free_place",
  scopeCourse: "all",
  scopeRaceId: null,
  scopeRaceLabel: null,
  eventDate: "2026-07-08",
  rules: JSON.stringify({
    type: "bet_get_free_place",
    minRunners: 8,
    regions: ["GB", "IRE"],
    qualifyingPlaces: [2, 3, 4],
    betStake: 50,
    freeBetAmount: 50,
  }),
};

describe("parseOfferRules", () => {
  it("parses bet_get_free_place rules", () => {
    const rules = parseOfferRules(baseOffer);
    expect(rules?.betStake).toBe(50);
    expect(rules?.qualifyingPlaces).toEqual([2, 3, 4]);
  });

  it("formats SP-favourite place-refund trigger text", () => {
    const rules = {
      type: "bet_get_free_place" as const,
      minRunners: 6,
      regions: ["GB", "IRE"] as ("GB" | "IRE")[],
      qualifyingPlaces: [2],
      betStake: 10,
      freeBetAmount: 10,
      winnerMustBeSpFavourite: true,
    };
    expect(placeRefundTriggerText(rules)).toBe(
      "Bet £10 get £10 FB if 2nd to SP favourite"
    );
    expect(formatBetGetFreePlaceSummary(rules)).toContain("2nd to SP favourite");
  });

  it("includes min favourite SP in trigger text when set", () => {
    const rules = {
      type: "bet_get_free_place" as const,
      minRunners: 6,
      regions: ["GB", "IRE"] as ("GB" | "IRE")[],
      qualifyingPlaces: [2],
      betStake: 10,
      freeBetAmount: 10,
      winnerMustBeSpFavourite: true,
      minFavouriteSpOdds: 2.5,
    };
    expect(placeRefundTriggerText(rules)).toBe(
      "Bet £10 get £10 FB if 2nd to SP favourite (min fav SP 2.5)"
    );
  });

  it("returns null for generic offers", () => {
    expect(parseOfferRules({ ...baseOffer, offerType: null, rules: null })).toBeNull();
  });
});

describe("formatBetGetFreePlaceSummary", () => {
  it("formats a readable summary", () => {
    const rules = parseOfferRules(baseOffer)!;
    expect(formatBetGetFreePlaceSummary(rules)).toContain("£50");
    expect(formatBetGetFreePlaceSummary(rules)).toContain("2, 3, 4");
  });

  it("omits place clause for unconditional bet&get", () => {
    const rules = {
      type: "bet_get_free_place" as const,
      minRunners: 8,
      regions: ["GB", "IRE"] as ("GB" | "IRE")[],
      qualifyingPlaces: [],
      betStake: 5,
      freeBetAmount: 5,
    };
    expect(offerHasResultTrigger(rules)).toBe(false);
    expect(formatBetGetFreePlaceSummary(rules)).toBe(
      "Bet £5 get £5 free · min 8 runners · GB & IRE"
    );
    expect(placeRefundTriggerText(rules)).toBe("Bet £5 get £5 FB");
  });
});

describe("offerHasResultTrigger", () => {
  it("is true for place-refund and SP-favourite clauses", () => {
    expect(
      offerHasResultTrigger({
        qualifyingPlaces: [2, 3, 4],
        winnerMustBeSpFavourite: false,
      })
    ).toBe(true);
    expect(
      offerHasResultTrigger({
        qualifyingPlaces: [],
        winnerMustBeSpFavourite: true,
      })
    ).toBe(true);
  });

  it("is false for empty places with no SP-favourite clause", () => {
    expect(
      offerHasResultTrigger({
        qualifyingPlaces: [],
        winnerMustBeSpFavourite: false,
      })
    ).toBe(false);
    expect(offerHasResultTrigger(null)).toBe(false);
  });
});

describe("raceQualifiesForOffer", () => {
  const race = {
    course: "Catterick",
    fieldSize: 10,
    region: "GB",
    externalId: "race-catt-1",
    offTime: "15:00",
  };

  it("qualifies when all rules pass", () => {
    const result = raceQualifiesForOffer(baseOffer, race, "2026-07-08");
    expect(result.qualifies).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("rejects wrong date", () => {
    const result = raceQualifiesForOffer(baseOffer, race, "2026-07-09");
    expect(result.qualifies).toBe(false);
    expect(result.reasons[0]).toContain("2026-07-08");
  });

  it("qualifies for uk_ire regional scope", () => {
    const regional = { ...baseOffer, scopeCourse: "uk_ire" };
    const result = raceQualifiesForOffer(regional, race, "2026-07-08");
    expect(result.qualifies).toBe(true);
  });

  it("qualifies legacy all scope as UK & Ireland", () => {
    const result = raceQualifiesForOffer(baseOffer, race, "2026-07-08");
    expect(result.qualifies).toBe(true);
    expect(formatOfferScopeLabel(baseOffer.scopeCourse)).toBe("UK & Ireland");
  });

  it("treats parser junk scopeCourse any as UK & Ireland", () => {
    const junk = { ...baseOffer, scopeCourse: "any" };
    expect(formatOfferScopeLabel(junk.scopeCourse)).toBe("UK & Ireland");
    expect(raceQualifiesForOffer(junk, race, "2026-07-08").qualifies).toBe(true);
  });

  it("rejects scoped course mismatch", () => {
    const scoped = { ...baseOffer, scopeCourse: "Lingfield" };
    const result = raceQualifiesForOffer(scoped, race, "2026-07-08");
    expect(result.qualifies).toBe(false);
    expect(result.reasons[0]).toContain("Catterick");
  });

  it("qualifies when the race course is one of several scoped courses", () => {
    const multi = { ...baseOffer, scopeCourse: "Galway, Goodwood" };
    expect(raceQualifiesForOffer(multi, { ...race, course: "Goodwood" }, "2026-07-08").qualifies).toBe(
      true
    );
    expect(raceQualifiesForOffer(multi, { ...race, course: "Galway" }, "2026-07-08").qualifies).toBe(
      true
    );
    expect(raceQualifiesForOffer(multi, { ...race, course: "Ascot" }, "2026-07-08").qualifies).toBe(
      false
    );
  });

  it("rejects when locked to a different race", () => {
    const locked = {
      ...baseOffer,
      scopeCourse: "Catterick",
      scopeRaceId: "other-race",
      scopeRaceLabel: "14:30 · Other",
    };
    const result = raceQualifiesForOffer(locked, race, "2026-07-08");
    expect(result.qualifies).toBe(false);
    expect(result.reasons[0]).toMatch(/scoped race/i);
  });

  it("qualifies when locked to this race", () => {
    const locked = {
      ...baseOffer,
      scopeCourse: "Catterick",
      scopeRaceId: "race-catt-1",
      scopeRaceLabel: "15:00 · Feature",
    };
    const result = raceQualifiesForOffer(locked, race, "2026-07-08");
    expect(result.qualifies).toBe(true);
  });

  it("rejects small fields", () => {
    const result = raceQualifiesForOffer(baseOffer, { ...race, fieldSize: 6 }, "2026-07-08");
    expect(result.qualifies).toBe(false);
    expect(result.reasons[0]).toContain("6 runners");
  });
});

describe("countOfferQualifyingRaces", () => {
  it("counts desk-style qualifying races and skips unknown field sizes", () => {
    const scoped = { ...baseOffer, scopeCourse: "Galway" };
    const n = countOfferQualifyingRaces(
      scoped,
      [
        { course: "Galway", fieldSize: 12 },
        { course: "Galway", fieldSize: 6 },
        { course: "Galway", fieldSize: 10 },
        { course: "Galway", fieldSize: null },
        { course: "Ascot", fieldSize: 14 },
      ],
      "2026-07-08"
    );
    // 12 and 10 qualify; 6 fails min runners; null skipped; Ascot out of scope
    expect(n).toBe(2);
  });

  it("returns null when the offer has no structured rules", () => {
    expect(
      countOfferQualifyingRaces(
        { ...baseOffer, offerType: "general", rules: null },
        [{ course: "Galway", fieldSize: 12 }],
        "2026-07-08"
      )
    ).toBeNull();
  });
});

describe("parseScopeCourses", () => {
  it("splits comma and ampersand lists, deduping by normalised name", () => {
    expect(parseScopeCourses("Galway, Goodwood")).toEqual(["Galway", "Goodwood"]);
    expect(parseScopeCourses("Galway & Goodwood")).toEqual(["Galway", "Goodwood"]);
    expect(parseScopeCourses("Galway or Goodwood")).toEqual(["Galway", "Goodwood"]);
    expect(parseScopeCourses("Goodwood, goodwood")).toEqual(["Goodwood"]);
    expect(encodeScopeCourses(["Goodwood", "Galway"])).toBe("Goodwood, Galway");
    expect(courseMatchesScope("Goodwood", "Galway, Goodwood")).toBe(true);
    expect(formatOfferScopeLabel("Galway, Goodwood")).toBe("Galway, Goodwood");
  });
});

describe("scorePlaceRefundStrategy", () => {
  it("scores high when favourite is clear and places cluster", () => {
    const result = scorePlaceRefundStrategy({
      fieldSize: 10,
      runners: [
        { horseId: "1", name: "A", number: "1", jockey: "", trainer: "", nonRunner: false, spDecimal: 2.0 },
        { horseId: "2", name: "B", number: "2", jockey: "", trainer: "", nonRunner: false, spDecimal: 5.0 },
        { horseId: "3", name: "C", number: "3", jockey: "", trainer: "", nonRunner: false, spDecimal: 6.0 },
        { horseId: "4", name: "D", number: "4", jockey: "", trainer: "", nonRunner: false, spDecimal: 7.0 },
        { horseId: "5", name: "E", number: "5", jockey: "", trainer: "", nonRunner: false, spDecimal: 21.0 },
      ],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.summary).toContain("Clear favourite");
  });

  it("returns zero when not enough prices", () => {
    const result = scorePlaceRefundStrategy({
      fieldSize: 3,
      runners: [
        { horseId: "1", name: "A", number: "1", jockey: "", trainer: "", nonRunner: false, spDecimal: 2.0 },
      ],
    });
    expect(result.score).toBe(0);
  });

  it("scores capped estimates from proxy odds", () => {
    const result = scorePlaceRefundStrategy({
      fieldSize: 10,
      runners: [
        { horseId: "1", name: "A", number: "1", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 2.0, oddsSource: "proxy" },
        { horseId: "2", name: "B", number: "2", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 5.0, oddsSource: "proxy" },
        { horseId: "3", name: "C", number: "3", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 6.0, oddsSource: "proxy" },
        { horseId: "4", name: "D", number: "4", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 7.0, oddsSource: "proxy" },
        { horseId: "5", name: "E", number: "5", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 21.0, oddsSource: "proxy" },
      ],
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.summary).toContain("Estimate");
  });
});

describe("scorePlaceRefundRunners", () => {
  const runners = [
    { horseId: "1", name: "Fav", number: "1", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 2.0, oddsSource: "proxy" as const },
    { horseId: "2", name: "Second", number: "2", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 5.5, oddsSource: "proxy" as const },
    { horseId: "3", name: "Third", number: "3", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 6.0, oddsSource: "proxy" as const },
    { horseId: "4", name: "Fourth", number: "4", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 7.0, oddsSource: "proxy" as const },
    { horseId: "5", name: "Fifth", number: "5", jockey: "", trainer: "", nonRunner: false, bookieDecimal: 25.0, oddsSource: "proxy" as const },
  ];

  it("suggests 2nd–4th market runners, not favourite", () => {
    const result = scorePlaceRefundRunners({ fieldSize: 10, runners });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.name !== "Fav")).toBe(true);
    expect(result[0].name).toBe("Second");
    expect(result[0].score).toBeGreaterThanOrEqual(35);
  });

  it("boosts runners with live exchange lay", () => {
    const withLive = scorePlaceRefundRunners({
      fieldSize: 10,
      runners: runners.map((r) =>
        r.name === "Second"
          ? { ...r, exchangeSource: "live" as const, exchangeDecimal: 5.7, spreadPct: 3.6, oddsSource: "live" as const }
          : r
      ),
    });
    const second = withLive.find((r) => r.name === "Second");
    expect(second?.summary).toContain("Live lay");
    expect(second?.score).toBeGreaterThan(50);
  });
});
