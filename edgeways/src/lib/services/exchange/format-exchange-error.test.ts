import { describe, expect, it } from "vitest";
import {
  chunkMarketIds,
  formatExchangeMatchError,
} from "./format-exchange-error";

describe("formatExchangeMatchError", () => {
  it("shortens TOO_MUCH_DATA faults", () => {
    expect(
      formatExchangeMatchError(
        'Error: Betfair listMarketBook failed (400): {"errorCode":"TOO_MUCH_DATA"}'
      )
    ).toBe("Using lay estimates for some races");
  });

  it("extracts error codes from JSON blobs", () => {
    expect(
      formatExchangeMatchError('{"errorCode":"INVALID_SESSION_INFORMATION"}')
    ).toBe("Exchange feed unavailable");
  });

  it("hides HTML parse failures behind a short note", () => {
    expect(
      formatExchangeMatchError(
        `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
      )
    ).toBe("Exchange feed unavailable");
  });
});

describe("chunkMarketIds", () => {
  it("splits market ids into batches of 40", () => {
    const ids = Array.from({ length: 85 }, (_, i) => `m${i}`);
    const batches = chunkMarketIds(ids);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(40);
    expect(batches[2]).toHaveLength(5);
  });
});
