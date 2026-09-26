import { describe, expect, it } from "vitest";
import {
  OFFER_DEEP_LINK_LEGACY_PARAM,
  OFFER_DEEP_LINK_PARAM,
  offerDeepLinkHref,
  parseOfferDeepLinkId,
} from "./offer-deep-link";
import { parsePublicDemoView } from "@/lib/demo/public-demo";

describe("offerDeepLinkHref", () => {
  it("writes the offer param, never the demo's view param", () => {
    expect(offerDeepLinkHref(5)).toBe("/offers?offer=5");
    expect(OFFER_DEEP_LINK_PARAM).not.toBe("view");
  });
});

describe("parseOfferDeepLinkId", () => {
  it("reads digits, from either the current or the legacy param", () => {
    expect(OFFER_DEEP_LINK_LEGACY_PARAM).toBe("view");
    expect(parseOfferDeepLinkId("5")).toBe(5);
    expect(parseOfferDeepLinkId(" 12 ")).toBe(12);
  });

  it("rejects anything that is not a positive offer id", () => {
    expect(parseOfferDeepLinkId(null)).toBeNull();
    expect(parseOfferDeepLinkId("")).toBeNull();
    expect(parseOfferDeepLinkId("0")).toBeNull();
    expect(parseOfferDeepLinkId("-3")).toBeNull();
    expect(parseOfferDeepLinkId("5.5")).toBeNull();
  });

  // EDGE-159: a demo plan id landing in the legacy param must not be taken
  // for an offer, or the page would open a modal and strip the preview.
  it("ignores demo plan ids", () => {
    for (const plan of ["free", "core", "edge"]) {
      expect(parsePublicDemoView(plan)).toBe(plan);
      expect(parseOfferDeepLinkId(plan)).toBeNull();
    }
  });
});
