import { describe, expect, it } from "vitest";
import { mapExchangeProviders } from "./feeds";

describe("mapExchangeProviders", () => {
  it("treats connected as ok when ok is omitted", () => {
    expect(
      mapExchangeProviders([
        { provider: "betfair", status: "connected", message: "Delayed feed" },
        { provider: "betdaq", status: "not_configured" },
      ])
    ).toEqual([
      {
        provider: "betfair",
        ok: true,
        status: "connected",
        message: "Delayed feed",
      },
      { provider: "betdaq", ok: false, status: "not_configured" },
    ]);
  });

  it("keeps an explicit ok from a live test", () => {
    expect(
      mapExchangeProviders([
        { provider: "betfair", status: "disconnected", ok: true },
      ])
    ).toEqual([
      { provider: "betfair", ok: true, status: "disconnected" },
    ]);
  });
});
