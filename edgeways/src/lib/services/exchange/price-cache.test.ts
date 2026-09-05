import { describe, expect, it } from "vitest";
import { cachedFetch, type PriceCache } from "./price-cache";

describe("cachedFetch", () => {
  it("joins in-flight fetchers for the same key", async () => {
    const cache: PriceCache<string> = new Map();
    let starts = 0;
    const fetcher = () => {
      starts += 1;
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve("ok"), 20);
      });
    };

    const [a, b] = await Promise.all([
      cachedFetch(cache, "day", 60_000, fetcher),
      cachedFetch(cache, "day", 60_000, fetcher),
    ]);

    expect(starts).toBe(1);
    expect(a).toEqual({ data: "ok", stale: false });
    expect(b).toEqual({ data: "ok", stale: false });
  });
});
