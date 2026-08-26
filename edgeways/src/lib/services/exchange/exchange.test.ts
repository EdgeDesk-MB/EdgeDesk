import { describe, expect, it } from "vitest";
import { exchangeNameToProvider, getExchangeProviderStatus, testExchangeConnections } from "./index";
import { testBetfairConnection } from "./betfair";
import { resolveRunnerOdds } from "@/lib/racing/odds";

describe("exchangeNameToProvider", () => {
  it("maps exchange names to providers", () => {
    expect(exchangeNameToProvider("Betdaq")).toBe("betdaq");
    expect(exchangeNameToProvider("Betfair")).toBe("betfair");
    expect(exchangeNameToProvider("Smarkets")).toBe("smarkets");
    expect(exchangeNameToProvider("Matchbook")).toBe("matchbook");
  });
});

describe("getExchangeProviderStatus", () => {
  it("reports betfair not configured without env", () => {
    const status = getExchangeProviderStatus("betfair");
    expect(status.status).toBe("not_configured");
    expect(status.message).toMatch(/not connected/i);
  });

  it("reports betdaq as not configured or unsupported", () => {
    const status = getExchangeProviderStatus("betdaq");
    expect(["not_configured", "unsupported"]).toContain(status.status);
  });
});

describe("testBetfairConnection", () => {
  it("reports not configured without env", async () => {
    const result = await testBetfairConnection();
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.message).toMatch(/not connected/i);
  });
});

describe("testExchangeConnections", () => {
  it("returns all provider test results", async () => {
    const { providers } = await testExchangeConnections();
    expect(providers).toHaveLength(4);
    expect(providers.map((p) => p.provider)).toEqual([
      "betfair",
      "betdaq",
      "matchbook",
      "smarkets",
    ]);
    expect(providers.every((p) => p.testedAt)).toBe(true);
  });
});

describe("resolveRunnerOdds with exchange lay", () => {
  it("uses live exchange lay when provided", () => {
    const result = resolveRunnerOdds({
      spDecimal: 5,
      exchangeLayDecimal: 5.2,
    });
    expect(result.exchangeDecimal).toBe(5.2);
    expect(result.exchangeSource).toBe("live");
    expect(result.spreadPct).toBe(4);
  });

  it("falls back to +3% estimate when no exchange feed", () => {
    const result = resolveRunnerOdds({ spDecimal: 10 });
    expect(result.exchangeDecimal).toBe(10.3);
    expect(result.exchangeSource).toBe("estimated");
  });
});
