import { describe, expect, it } from "vitest";
import { emptyImportantTerms } from "./offer-terms";
import {
  evaluatePlacementBreaches,
  formatPlacementRequirementParts,
  hasPlacementBreach,
  hasPlacementRequirements,
  placementBreachMessages,
  placementRequirementsFromImportant,
  placementRequirementsFromPrefill,
  requirementPartBreached,
} from "./offer-placement-requirements";

describe("placementRequirementsFromImportant", () => {
  it("drops min stake on convert and keeps max stake and min odds", () => {
    const req = placementRequirementsFromImportant(
      {
        ...emptyImportantTerms(),
        minOdds: 1.5,
        minStake: 20,
        maxStake: 50,
        importantNotes: "SNR free bet",
      },
      { purpose: "convert" }
    );
    expect(req.minStake).toBeNull();
    expect(req.maxStake).toBe(50);
    expect(req.minOdds).toBe(1.5);
    expect(req.importantNotes).toBe("SNR free bet");
  });

  it("omits selection count unless asked", () => {
    const important = {
      ...emptyImportantTerms(),
      minOdds: 2,
      minSelections: 3,
      rewardMinSelections: 4,
    };
    expect(placementRequirementsFromImportant(important).minSelections).toBeNull();
    expect(
      placementRequirementsFromImportant(important, { includeSelections: true }).minSelections
    ).toBe(3);
    expect(
      placementRequirementsFromImportant(important, {
        purpose: "convert",
        includeSelections: true,
      }).minSelections
    ).toBe(4);
  });
});

describe("formatPlacementRequirementParts", () => {
  it("builds the Acca-style strip, convert first", () => {
    const parts = formatPlacementRequirementParts({
      purpose: "convert",
      minOdds: 1.5,
      minStake: null,
      maxStake: 25,
      minSelections: 3,
      importantNotes: "Must be next promo",
    });
    expect(parts.map((p) => p.text)).toEqual([
      "Free-bet convert",
      "Min 3 selections",
      "Min odds 1.5",
      "Max stake £25.00",
      "Must be next promo",
    ]);
  });
});

describe("evaluatePlacementBreaches", () => {
  const req = placementRequirementsFromPrefill({
    minOdds: 1.5,
    minStake: 10,
    maxStake: 20,
    minSelections: 3,
  });

  it("stays quiet until stake and odds are entered", () => {
    expect(evaluatePlacementBreaches(req, {})).toEqual({
      oddsLow: false,
      stakeLow: false,
      stakeHigh: false,
      selectionsLow: false,
    });
    expect(evaluatePlacementBreaches(req, { odds: NaN, stake: 0 })).toEqual({
      oddsLow: false,
      stakeLow: false,
      stakeHigh: false,
      selectionsLow: false,
    });
  });

  it("flags odds below the floor and stake outside the band", () => {
    const breaches = evaluatePlacementBreaches(req, {
      odds: 1.4,
      stake: 5,
      selectionCount: 2,
    });
    expect(breaches).toEqual({
      oddsLow: true,
      stakeLow: true,
      stakeHigh: false,
      selectionsLow: true,
    });
    expect(hasPlacementBreach(breaches)).toBe(true);
    expect(requirementPartBreached("minOdds", breaches)).toBe(true);
    expect(requirementPartBreached("minStake", breaches)).toBe(true);
    expect(requirementPartBreached("minSelections", breaches)).toBe(true);
  });

  it("accepts odds and stake on the boundary", () => {
    expect(
      evaluatePlacementBreaches(req, { odds: 1.5, stake: 10, selectionCount: 3 })
    ).toEqual({
      oddsLow: false,
      stakeLow: false,
      stakeHigh: false,
      selectionsLow: false,
    });
    expect(evaluatePlacementBreaches(req, { odds: 2, stake: 20 }).stakeHigh).toBe(
      false
    );
    expect(evaluatePlacementBreaches(req, { stake: 20.01 }).stakeHigh).toBe(true);
  });

  it("writes adjacent copy for stray fields", () => {
    const breaches = evaluatePlacementBreaches(req, {
      odds: 1.2,
      stake: 5,
      selectionCount: 1,
    });
    expect(placementBreachMessages(req, breaches)).toEqual([
      "Stake is below the min £10.00",
      "Odds are below the min 1.5",
      "Need at least 3 selections",
    ]);
    expect(placementBreachMessages(req, breaches, { oddsScope: "combined" })[1]).toBe(
      "Combined odds are below the min 1.5"
    );
  });

  it("hasPlacementRequirements needs a real constraint, not convert alone", () => {
    expect(
      hasPlacementRequirements(
        placementRequirementsFromImportant(emptyImportantTerms(), { purpose: "convert" })
      )
    ).toBe(false);
    expect(
      hasPlacementRequirements(placementRequirementsFromImportant(emptyImportantTerms()))
    ).toBe(false);
    expect(
      hasPlacementRequirements(
        placementRequirementsFromImportant({
          ...emptyImportantTerms(),
          minOdds: 1.5,
        })
      )
    ).toBe(true);
  });
});
