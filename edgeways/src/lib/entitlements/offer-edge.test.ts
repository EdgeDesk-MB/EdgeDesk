import { describe, expect, it } from "vitest";
import { canUseOfferEdge } from "./offer-edge";

describe("canUseOfferEdge", () => {
  it("defaults to unlocked when settings omit planPreview", () => {
    expect(canUseOfferEdge(null)).toBe(true);
    expect(canUseOfferEdge({})).toBe(true);
    expect(canUseOfferEdge({ planPreview: "unlocked" })).toBe(true);
  });

  it("allows Edge preview only among paid tiers", () => {
    expect(canUseOfferEdge({ planPreview: "edge" })).toBe(true);
    expect(canUseOfferEdge({ planPreview: "core" })).toBe(false);
  });

  it("denies Free preview", () => {
    expect(canUseOfferEdge({ planPreview: "free" })).toBe(false);
  });
});
