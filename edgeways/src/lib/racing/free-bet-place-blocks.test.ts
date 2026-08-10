import { describe, expect, it } from "vitest";
import { buildFreeBetPlaceBlocks } from "./free-bet-place-blocks";

describe("buildFreeBetPlaceBlocks", () => {
  it("returns one block for a single 2nd–4th offer", () => {
    const { allPlaces, blocks } = buildFreeBetPlaceBlocks([
      {
        qualifies: true,
        qualifyingPlaces: [2, 3, 4],
        triggerText: "Bet £20 get £20 FB if 2, 3, 4",
      },
    ]);
    expect([...allPlaces].sort((a, b) => a - b)).toEqual([2, 3, 4]);
    expect(blocks).toEqual([
      { places: [2, 3, 4], title: "Bet £20 get £20 FB if 2, 3, 4" },
    ]);
  });

  it("keeps disconnected offers as separate blocks (2nd vs 4th–5th)", () => {
    const { allPlaces, blocks } = buildFreeBetPlaceBlocks([
      { qualifies: true, qualifyingPlaces: [2], offerTitle: "Offer A" },
      { qualifies: true, qualifyingPlaces: [4, 5], offerTitle: "Offer B" },
    ]);
    expect([...allPlaces].sort((a, b) => a - b)).toEqual([2, 4, 5]);
    expect(blocks).toEqual([
      { places: [2], title: "Offer A" },
      { places: [4, 5], title: "Offer B" },
    ]);
  });

  it("merges overlapping / adjacent places into one block", () => {
    const { blocks } = buildFreeBetPlaceBlocks([
      { qualifies: true, qualifyingPlaces: [2, 3, 4], offerTitle: "Offer A" },
      { qualifies: true, qualifyingPlaces: [4, 5], offerTitle: "Offer B" },
    ]);
    expect(blocks).toEqual([{ places: [2, 3, 4, 5], title: "Free bet" }]);
  });

  it("merges adjacent single-place offers (2nd + 3rd → one block)", () => {
    const { blocks } = buildFreeBetPlaceBlocks([
      { qualifies: true, qualifyingPlaces: [2], offerTitle: "Offer A" },
      { qualifies: true, qualifyingPlaces: [3], offerTitle: "Offer B" },
    ]);
    expect(blocks).toEqual([{ places: [2, 3], title: "Free bet" }]);
  });

  it("ignores non-qualifying tags and place 1", () => {
    const { allPlaces, blocks } = buildFreeBetPlaceBlocks([
      { qualifies: false, qualifyingPlaces: [2, 3, 4], offerTitle: "Skip" },
      { qualifies: true, qualifyingPlaces: [1, 3], offerTitle: "Offer" },
    ]);
    expect([...allPlaces]).toEqual([3]);
    expect(blocks).toEqual([{ places: [3], title: "Offer" }]);
  });

  it("hatches SP-favourite offers only when the winner was the SP favourite", () => {
    const tag = {
      qualifies: true,
      qualifyingPlaces: [2],
      winnerMustBeSpFavourite: true,
      triggerText: "Bet £10 get £10 FB if 2nd to SP favourite",
    };
    expect(
      buildFreeBetPlaceBlocks([tag], {
        winnerWasSpFavourite: true,
        favouriteSpOdds: 2.5,
      }).allPlaces.has(2)
    ).toBe(true);
    expect(
      buildFreeBetPlaceBlocks([tag], {
        winnerWasSpFavourite: false,
        favouriteSpOdds: 2.5,
      }).allPlaces.size
    ).toBe(0);
    // Unknown SP fav: do not show a false-positive hatch.
    expect(
      buildFreeBetPlaceBlocks([tag], {
        winnerWasSpFavourite: null,
        favouriteSpOdds: null,
      }).allPlaces.size
    ).toBe(0);
  });

  it("suppresses hatch when favourite SP is below the offer floor", () => {
    const tag = {
      qualifies: true,
      qualifyingPlaces: [2],
      winnerMustBeSpFavourite: true,
      minFavouriteSpOdds: 2.5,
      triggerText: "Bet £10 get £10 FB if 2nd to SP favourite (min fav SP 2.5)",
    };
    expect(
      buildFreeBetPlaceBlocks([tag], {
        winnerWasSpFavourite: true,
        favouriteSpOdds: 2.2,
      }).allPlaces.size
    ).toBe(0);
    expect(
      buildFreeBetPlaceBlocks([tag], {
        winnerWasSpFavourite: true,
        favouriteSpOdds: 2.5,
      }).allPlaces.has(2)
    ).toBe(true);
  });

  it("still hatches ordinary place refunds when the winner was not SP favourite", () => {
    const { allPlaces } = buildFreeBetPlaceBlocks(
      [{ qualifies: true, qualifyingPlaces: [2, 3, 4], offerTitle: "Ordinary" }],
      { winnerWasSpFavourite: false, favouriteSpOdds: 8 }
    );
    expect([...allPlaces].sort((a, b) => a - b)).toEqual([2, 3, 4]);
  });
});
