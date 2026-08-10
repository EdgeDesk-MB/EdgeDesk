import { describe, expect, it } from "vitest";
import {
  buildPromoTermsRules,
  emptyImportantTerms,
  formatImportantTermsSummary,
  formatScopesLabel,
  mergeImportantIntoRacingRules,
  normalizeScopes,
  readImportantTerms,
  toggleScope,
} from "./offer-terms";
import type { BetGetFreePlaceRules } from "./racing-offer-rules";

describe("offer important terms qualifier / reward scopes", () => {
  it("defaults legacy rules to single with no min selections", () => {
    const terms = readImportantTerms({
      offerType: "promo_terms",
      rules: JSON.stringify({
        type: "promo_terms",
        minOdds: 2,
        importantNotes: "SNR",
      }),
    });
    expect(terms.qualifierScopes).toEqual(["single"]);
    expect(terms.rewardScopes).toEqual(["single"]);
    expect(terms.minSelections).toBeNull();
    expect(terms.rewardMinSelections).toBeNull();
    expect(terms.minOdds).toBe(2);
  });

  it("reads deprecated singular shape keys as scope sets", () => {
    const terms = readImportantTerms({
      offerType: "promo_terms",
      rules: JSON.stringify({
        type: "promo_terms",
        qualifierShape: "acca",
        rewardShape: "bet_builder",
        minSelections: 3,
        rewardMinSelections: 5,
      }),
    });
    expect(terms.qualifierScopes).toEqual(["acca"]);
    expect(terms.rewardScopes).toEqual(["bet_builder"]);
    expect(terms.minSelections).toBe(3);
    expect(terms.rewardMinSelections).toBe(5);
  });

  it("reads multi-scope arrays and formats Acca or Bet builder", () => {
    const terms = readImportantTerms({
      offerType: "promo_terms",
      rules: JSON.stringify({
        type: "promo_terms",
        qualifierScopes: ["bet_builder", "acca"],
        rewardScopes: ["acca", "bet_builder"],
        minSelections: 3,
        rewardMinSelections: 3,
      }),
    });
    expect(terms.qualifierScopes).toEqual(["acca", "bet_builder"]);
    expect(terms.rewardScopes).toEqual(["acca", "bet_builder"]);
    expect(formatScopesLabel(terms.qualifierScopes)).toBe("Acca or Bet builder");
    expect(formatImportantTermsSummary(terms)).toContain("Qualify Acca or Bet builder");
    expect(formatImportantTermsSummary(terms)).toContain("Reward Acca or Bet builder");
  });

  it("round-trips separate qualifier and reward scope sets", () => {
    const important = {
      ...emptyImportantTerms(),
      minOdds: 2,
      minStake: 20,
      qualifierScopes: ["single"] as const,
      rewardScopes: ["acca"] as const,
      rewardMinSelections: 4,
      importantNotes: "Free bet on Acca only",
    };
    const rules = buildPromoTermsRules({
      ...important,
      qualifierScopes: [...important.qualifierScopes],
      rewardScopes: [...important.rewardScopes],
    });
    expect(rules).toMatchObject({
      type: "promo_terms",
      qualifierScopes: null,
      rewardScopes: ["acca"],
      rewardMinSelections: 4,
      minOdds: 2,
    });
    const loaded = readImportantTerms({
      offerType: "promo_terms",
      rules: JSON.stringify(rules),
    });
    expect(loaded.qualifierScopes).toEqual(["single"]);
    expect(loaded.rewardScopes).toEqual(["acca"]);
    expect(loaded.rewardMinSelections).toBe(4);
    expect(formatImportantTermsSummary(loaded)).toContain("Reward Acca");
    expect(formatImportantTermsSummary(loaded)).toContain("Reward min 4");
  });

  it("omits single scopes from promo JSON when nothing else is set", () => {
    expect(buildPromoTermsRules(emptyImportantTerms())).toBeNull();
  });

  it("merges both scope sets into racing rules", () => {
    const racing: BetGetFreePlaceRules = {
      type: "bet_get_free_place",
      minRunners: 8,
      regions: ["GB", "IRE"],
      qualifyingPlaces: [3, 4],
      betStake: 10,
      freeBetAmount: 10,
    };
    const merged = mergeImportantIntoRacingRules(racing, {
      ...emptyImportantTerms(),
      qualifierScopes: ["acca"],
      minSelections: 3,
      rewardScopes: ["bet_builder"],
      rewardMinSelections: 5,
    });
    expect(merged.qualifierScopes).toEqual(["acca"]);
    expect(merged.rewardScopes).toEqual(["bet_builder"]);
    const loaded = readImportantTerms({
      offerType: "bet_get_free_place",
      rules: JSON.stringify(merged),
    });
    expect(loaded.qualifierScopes).toEqual(["acca"]);
    expect(loaded.rewardScopes).toEqual(["bet_builder"]);
    expect(loaded.rewardMinSelections).toBe(5);
  });

  it("toggleScope keeps at least one selection", () => {
    expect(toggleScope(["acca"], "acca")).toEqual(["acca"]);
    expect(toggleScope(["acca", "bet_builder"], "acca")).toEqual(["bet_builder"]);
    expect(normalizeScopes(["bet_builder", "single", "acca"])).toEqual([
      "single",
      "acca",
      "bet_builder",
    ]);
  });
});
