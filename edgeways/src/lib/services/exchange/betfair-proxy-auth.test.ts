import { describe, expect, it } from "vitest";
import {
  betfairProxyAllowed,
  betfairRunsOnVercelNode,
  isAllowedBetfairUpstreamUrl,
} from "./betfair-proxy-auth";

describe("betfairProxyAllowed", () => {
  it("accepts the app key as a bearer token", () => {
    expect(betfairProxyAllowed("Bearer abc", "abc")).toBe(true);
  });

  it("rejects missing or mismatched secrets", () => {
    expect(betfairProxyAllowed(null, "abc")).toBe(false);
    expect(betfairProxyAllowed("Bearer abc", "xyz")).toBe(false);
    expect(betfairProxyAllowed("Bearer abc", null)).toBe(false);
  });
});

describe("betfairRunsOnVercelNode", () => {
  it("is false in local vitest", () => {
    expect(betfairRunsOnVercelNode()).toBe(false);
  });
});

describe("isAllowedBetfairUpstreamUrl", () => {
  it("allows Betfair login and betting REST paths", () => {
    expect(isAllowedBetfairUpstreamUrl("https://identitysso.betfair.com/api/login")).toBe(true);
    expect(
      isAllowedBetfairUpstreamUrl("https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/")
    ).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAllowedBetfairUpstreamUrl("https://identitysso.betfair.com/api/logout")).toBe(false);
    expect(isAllowedBetfairUpstreamUrl("https://example.com/api/login")).toBe(false);
    expect(isAllowedBetfairUpstreamUrl("http://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/")).toBe(
      false
    );
  });
});
