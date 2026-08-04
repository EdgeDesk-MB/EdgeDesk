import { describe, expect, it } from "vitest";
import {
  convertFractionalOddsInText,
  formatQualifyingPlacesPhrase,
  normalizeOfferDetailsText,
} from "@/lib/offers/offer-odds-text";

describe("formatQualifyingPlacesPhrase", () => {
  it("formats place lists with ordinals", () => {
    expect(formatQualifyingPlacesPhrase([4, 6])).toBe("4th or 6th");
    expect(formatQualifyingPlacesPhrase([2, 3, 4])).toBe("2nd, 3rd or 4th");
  });
});

describe("convertFractionalOddsInText", () => {
  it("converts min odds fractions to decimal", () => {
    expect(convertFractionalOddsInText("Min odds 1/2 · New customers only")).toBe(
      "Min odds 1.50 · New customers only"
    );
    expect(convertFractionalOddsInText("min odds of 5/2 or greater")).toBe(
      "min odds of 3.50 or greater"
    );
  });

  it("keeps decimal when fraction already paired", () => {
    expect(convertFractionalOddsInText("Min odds 1/2 (1.50)")).toBe("Min odds 1.50");
  });

  it("converts EW place odds phrasing", () => {
    expect(convertFractionalOddsInText("1/5 odds on EW bets")).toBe("1.20 odds on EW bets");
  });

  it("rewrites refund place slashes as ordinals", () => {
    expect(
      convertFractionalOddsInText(
        "Pick a runner in a suitable race (refund if 4/6)."
      )
    ).toBe("Pick a runner in a suitable race (refund if 4th or 6th).");
  });

  it("leaves non-odds slashes alone when not in odds context", () => {
    expect(convertFractionalOddsInText("Valid 7 days · SNR")).toBe("Valid 7 days · SNR");
  });
});

describe("normalizeOfferDetailsText", () => {
  it("trims and normalizes whitespace", () => {
    expect(normalizeOfferDetailsText("  Min odds 1/2  ")).toBe("Min odds 1.50");
  });
});
