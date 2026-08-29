import { describe, expect, it } from "vitest";
import {
  liveBundleConfigFromSettings,
  parseAdminLivePushCursor,
  parseAdminLiveSettings,
} from "./live-settings-shared";

describe("parseAdminLiveSettings", () => {
  it("returns safe defaults for empty or junk JSON", () => {
    expect(parseAdminLiveSettings(null).pollMs).toBe(5000);
    expect(parseAdminLiveSettings("not-json").bundleStart).toBe(10);
  });

  it("clamps poll interval and bundle steps", () => {
    const parsed = parseAdminLiveSettings(
      JSON.stringify({
        toastsEnabled: false,
        pushEnabled: false,
        pollMs: 500,
        bundleStart: 1,
        bundleHigh: 3,
        windowMinutes: 1,
      })
    );
    expect(parsed.toastsEnabled).toBe(false);
    expect(parsed.pushEnabled).toBe(false);
    expect(parsed.pollMs).toBe(3000);
    expect(parsed.bundleStart).toBe(2);
    expect(parsed.bundleHigh).toBe(3);
    expect(parsed.windowMinutes).toBe(5);
  });

  it("keeps high step at or above the start step", () => {
    const parsed = parseAdminLiveSettings(
      JSON.stringify({ bundleStart: 20, bundleHigh: 10 })
    );
    expect(parsed.bundleStart).toBe(20);
    expect(parsed.bundleHigh).toBe(20);
  });
});

describe("liveBundleConfigFromSettings", () => {
  it("converts minutes to a window in milliseconds", () => {
    expect(
      liveBundleConfigFromSettings(parseAdminLiveSettings(null)).windowMs
    ).toBe(60 * 60 * 1000);
  });
});

describe("parseAdminLivePushCursor", () => {
  it("drops unknown critical states", () => {
    expect(
      parseAdminLivePushCursor(
        JSON.stringify({ since: 12.9, critical: { "feed:football": "warning", x: "nope" } })
      )
    ).toEqual({
      since: 12,
      critical: { "feed:football": "warning" },
    });
  });
});
