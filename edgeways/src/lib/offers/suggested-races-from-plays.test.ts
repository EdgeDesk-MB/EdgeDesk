import { describe, expect, it } from "vitest";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { suggestedRacesFromPlays } from "./suggested-races-from-plays";

const play = {
  offerId: 7,
  offerTitle: "Bet £10 get £10",
  bookmaker: "Sky Bet",
  raceExternalId: "rac_1",
  course: "Haydock",
  raceName: "Handicap",
  offTime: "17:20",
  startTime: Date.parse("2026-09-05T16:20:00Z"),
  fieldSize: 10,
  runner: {
    horseId: "h1",
    name: "Demo Runner",
    backDecimal: 6.5,
    layDecimal: 6.8,
    marketRank: 2,
  },
  triggerProb: 0.4,
  triggerBasis: "model",
  qualLoss: -2,
  layStake: 8,
  freeBetEv: 6,
  totalEv: 4,
  retention: 0.8,
  retentionSampleSize: 0,
  confidence: "live",
  reasons: [],
  warnings: [],
} satisfies OfferEdgePlay;

describe("suggestedRacesFromPlays", () => {
  it("keeps the play on the suggestion so Race picks can rank it", () => {
    const [row] = suggestedRacesFromPlays([play]);
    expect(row?.externalId).toBe("rac_1");
    expect(row?.offerId).toBe(7);
    expect(row?.topEv).toBe(4);
    expect(row?.edge).toEqual(play);
    expect(row?.topTarget?.name).toBe("Demo Runner");
  });
});
