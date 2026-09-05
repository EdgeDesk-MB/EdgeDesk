import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();

vi.mock("@/hooks/use-app-state", () => ({
  api: (...args: unknown[]) => api(...args),
}));

async function loadClient() {
  return import("./offer-edge-client");
}

describe("fetchOfferEdgePlays", () => {
  beforeEach(() => {
    vi.resetModules();
    api.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("joins an in-flight request instead of starting a second build", async () => {
    let resolveFirst!: (value: { plays: unknown[]; source: string }) => void;
    api.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const { fetchOfferEdgePlays } = await loadClient();
    const a = fetchOfferEdgePlays("2026-09-05");
    const b = fetchOfferEdgePlays("2026-09-05", { force: true });
    expect(api).toHaveBeenCalledTimes(1);

    resolveFirst({ plays: [{ offerId: 1 }], source: "racing-api" });
    const [first, second] = await Promise.all([a, b]);
    expect(first.plays).toHaveLength(1);
    expect(second.plays).toHaveLength(1);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("reuses the settled cache within the TTL", async () => {
    api.mockResolvedValue({ plays: [{ offerId: 2 }], source: "racing-api" });
    const { fetchOfferEdgePlays } = await loadClient();

    await fetchOfferEdgePlays("2026-09-05");
    await fetchOfferEdgePlays("2026-09-05");
    expect(api).toHaveBeenCalledTimes(1);
  });
});
