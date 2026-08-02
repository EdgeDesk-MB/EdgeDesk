import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedGet, clearApiGetCache } from "@/lib/api-get-cache";

describe("cachedGet", () => {
  afterEach(() => {
    clearApiGetCache();
  });

  it("returns the settled value within the TTL without re-fetching", async () => {
    const fetcher = vi.fn(async () => ({ n: 1 }));
    const a = await cachedGet("/x", fetcher, 60_000);
    const b = await cachedGet("/x", fetcher, 60_000);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("dedupes in-flight requests for the same path", async () => {
    let resolve!: (v: { n: number }) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<{ n: number }>((r) => {
          resolve = r;
        })
    );
    const p1 = cachedGet("/y", fetcher, 60_000);
    const p2 = cachedGet("/y", fetcher, 60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve({ n: 2 });
    await expect(Promise.all([p1, p2])).resolves.toEqual([{ n: 2 }, { n: 2 }]);
  });

  it("refetches after clearApiGetCache", async () => {
    const fetcher = vi.fn(async () => ({ n: 3 }));
    await cachedGet("/z", fetcher, 60_000);
    clearApiGetCache();
    await cachedGet("/z", fetcher, 60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
