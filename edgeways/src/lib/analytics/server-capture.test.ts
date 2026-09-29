import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureServerEvent } from "@/lib/analytics/server-capture";

const fetchMock = vi.fn(async () => new Response("{}"));

describe("captureServerEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_FORCE_ENABLE", "");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    fetchMock.mockClear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends nothing outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    captureServerEvent("user_1", "bet_logged", { source: "manual" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts one event with only the given properties on production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    captureServerEvent("user_1", "upgrade_started", { plan: "edge" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
    expect(JSON.parse(String(init.body))).toEqual({
      api_key: "phc_test",
      event: "upgrade_started",
      distinct_id: "user_1",
      properties: { plan: "edge" },
    });
  });

  it("never throws when the network fails", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(() =>
      captureServerEvent("user_1", "sign_up_completed", { method: "email" })
    ).not.toThrow();
  });
});
