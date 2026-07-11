import { describe, expect, it } from "vitest";
import { findOfferTag, offerTagBestEv, qualifyingOfferTags } from "@/lib/racing/offer-tags";
import type { RaceOfferTag } from "@/lib/racing-desk/types";

function tag(partial: Partial<RaceOfferTag> & Pick<RaceOfferTag, "offerId" | "offerTitle">): RaceOfferTag {
  return {
    qualifies: true,
    score: 50,
    summary: "",
    ...partial,
  };
}

describe("qualifyingOfferTags", () => {
  it("sorts by best runner EV then score", () => {
    const race = {
      offerTags: [
        tag({
          offerId: 1,
          offerTitle: "Lower EV",
          score: 90,
          suggestedRunners: [{ horseId: "a", name: "A", score: 1, summary: "", totalEv: 2 }],
        }),
        tag({
          offerId: 2,
          offerTitle: "Higher EV",
          score: 40,
          suggestedRunners: [{ horseId: "b", name: "B", score: 1, summary: "", totalEv: 8 }],
        }),
        tag({
          offerId: 3,
          offerTitle: "Does not qualify",
          qualifies: false,
          suggestedRunners: [{ horseId: "c", name: "C", score: 1, summary: "", totalEv: 99 }],
        }),
      ],
    };

    const sorted = qualifyingOfferTags(race);
    expect(sorted.map((t) => t.offerId)).toEqual([2, 1]);
    expect(offerTagBestEv(sorted[0]!)).toBe(8);
  });

  it("falls back to score when EV missing", () => {
    const race = {
      offerTags: [
        tag({ offerId: 1, offerTitle: "A", score: 10 }),
        tag({ offerId: 2, offerTitle: "B", score: 80 }),
      ],
    };
    expect(qualifyingOfferTags(race).map((t) => t.offerId)).toEqual([2, 1]);
  });
});

describe("findOfferTag", () => {
  it("returns specific offer or best when id omitted", () => {
    const race = {
      offerTags: [
        tag({
          offerId: 1,
          offerTitle: "A",
          suggestedRunners: [{ horseId: "a", name: "A", score: 1, summary: "", totalEv: 1 }],
        }),
        tag({
          offerId: 2,
          offerTitle: "B",
          suggestedRunners: [{ horseId: "b", name: "B", score: 1, summary: "", totalEv: 5 }],
        }),
      ],
    };
    expect(findOfferTag(race, 1)?.offerId).toBe(1);
    expect(findOfferTag(race, null)?.offerId).toBe(2);
  });
});
