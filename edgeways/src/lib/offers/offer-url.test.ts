import { describe, expect, it } from "vitest";
import {
  extractOfferUrlCandidate,
  isInvalidOfferUrlInput,
  normalizeOfferUrl,
} from "./offer-url";

describe("normalizeOfferUrl", () => {
  it("returns null for empty input", () => {
    expect(normalizeOfferUrl(null)).toBeNull();
    expect(normalizeOfferUrl("")).toBeNull();
    expect(normalizeOfferUrl("   ")).toBeNull();
  });

  it("keeps https URLs", () => {
    expect(normalizeOfferUrl("https://www.bet365.com/promo")).toBe(
      "https://www.bet365.com/promo"
    );
  });

  it("adds https for bare hosts", () => {
    expect(normalizeOfferUrl("www.skybet.com/offer")).toBe(
      "https://www.skybet.com/offer"
    );
  });

  it("rejects non-http schemes", () => {
    expect(normalizeOfferUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeOfferUrl("ftp://example.com")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(normalizeOfferUrl("not a url")).toBeNull();
  });
});

describe("isInvalidOfferUrlInput", () => {
  it("is false when blank", () => {
    expect(isInvalidOfferUrlInput("")).toBe(false);
  });

  it("is true when non-empty but unusable", () => {
    expect(isInvalidOfferUrlInput("javascript:x")).toBe(true);
  });
});

describe("extractOfferUrlCandidate", () => {
  it("returns empty for blank clipboard", () => {
    expect(extractOfferUrlCandidate("  ")).toBe("");
  });

  it("extracts https from surrounding text", () => {
    expect(
      extractOfferUrlCandidate("Claim here https://sky.bet/promo now.")
    ).toBe("https://sky.bet/promo");
  });

  it("extracts www hosts", () => {
    expect(extractOfferUrlCandidate("see www.bet365.com/offer")).toBe(
      "www.bet365.com/offer"
    );
  });
});
