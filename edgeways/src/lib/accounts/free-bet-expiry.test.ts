import { describe, expect, it } from "vitest";
import { freeBetExpiryLinkLabel, freeBetLotNoteLabel } from "./free-bet-expiry";

describe("freeBetExpiryLinkLabel", () => {
  const at = new Date(2026, 7, 20, 23, 59, 0).getTime();

  it("prompts to set when empty", () => {
    expect(freeBetExpiryLinkLabel(null)).toBe("Set expiry");
  });

  it("shows Expires X before the deadline", () => {
    expect(freeBetExpiryLinkLabel(at, at - 60_000)).toBe("Expires 20 Aug 2026");
  });

  it("shows Expired X after the deadline", () => {
    expect(freeBetExpiryLinkLabel(at, at + 60_000)).toBe("Expired 20 Aug 2026");
  });
});

describe("freeBetLotNoteLabel", () => {
  it("strips promo prefix and lot markers", () => {
    expect(freeBetLotNoteLabel("Free bet promo - Offer unlocked (Qualify · Ivybet)")).toBe(
      "Offer unlocked (Qualify · Ivybet)"
    );
    expect(freeBetLotNoteLabel("Credit [[lot:12]] leftover")).toBe("Credit leftover");
  });

  it("falls back when empty", () => {
    expect(freeBetLotNoteLabel(null)).toBe("Free bet credit");
    expect(freeBetLotNoteLabel("   ")).toBe("Free bet credit");
  });
});
