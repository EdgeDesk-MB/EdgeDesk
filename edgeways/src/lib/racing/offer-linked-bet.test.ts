import { describe, expect, it } from "vitest";
import {
  findOpenQualifyingBetForOffer,
  findQualifyingBetForOfferOnRace,
} from "./offer-linked-bet";

const base = {
  status: "open",
  eventId: 10,
  betType: "qualifying",
  selection: "Hostility",
  layStake: 0,
  backStake: 10,
  bookmaker: "Paddy Power",
} as const;

describe("findOpenQualifyingBetForOffer", () => {
  it("returns the bet for the matching offerId only", () => {
    const bets = [
      { ...base, offerId: 1, selection: "Hostility" },
      {
        ...base,
        offerId: 2,
        selection: "Other",
        backStake: 20,
        bookmaker: "Betfair Sportsbook",
      },
    ];
    expect(findOpenQualifyingBetForOffer(bets, 10, 1)?.offerId).toBe(1);
    expect(findOpenQualifyingBetForOffer(bets, 10, 2)?.selection).toBe("Other");
    expect(findOpenQualifyingBetForOffer(bets, 10, 99)).toBeNull();
  });

  it("does not treat another bookie's race bet as this offer's", () => {
    const bets = [{ ...base, offerId: 1, bookmaker: "Paddy Power" }];
    expect(
      findOpenQualifyingBetForOffer(bets, 10, 2, "Betfair Sportsbook")
    ).toBeNull();
  });

  it("matches by bookmaker when offerId is a fresh same-day sibling", () => {
    // Used campaign id=1 has the bet; strip shows fresh sibling id=99.
    const bets = [{ ...base, offerId: 1, bookmaker: "Paddy Power" }];
    expect(
      findOpenQualifyingBetForOffer(bets, 10, 99, "Paddy Power")?.offerId
    ).toBe(1);
  });

  it("ignores settled bets for open-only lookup", () => {
    const bets = [{ ...base, offerId: 1, status: "won" }];
    expect(findOpenQualifyingBetForOffer(bets, 10, 1, "Paddy Power")).toBeNull();
  });

  it("requires a tracked event id", () => {
    const bets = [{ ...base, offerId: 1 }];
    expect(findOpenQualifyingBetForOffer(bets, null, 1)).toBeNull();
    expect(findOpenQualifyingBetForOffer(bets, undefined, 1)).toBeNull();
  });
});

describe("findQualifyingBetForOfferOnRace", () => {
  it("includes settled bets for card chrome", () => {
    const bets = [{ ...base, offerId: 1, status: "won" }];
    expect(
      findQualifyingBetForOfferOnRace(bets, 10, 99, "Paddy Power", {
        includeSettled: true,
      })?.status
    ).toBe("won");
  });
});
