import { describe, expect, it } from "vitest";
import { isAppConsoleError, isAppPageError, isAppResponseFailure } from "./noise";

const APP = "https://edgeways.app";

describe("smoke noise filter", () => {
  it("counts app-origin console errors, including React #418", () => {
    expect(
      isAppConsoleError(
        "Minified React error #418",
        `${APP}/_next/static/chunks/main.js`,
        APP,
      ),
    ).toBe(true);
    expect(isAppConsoleError("Something broke", "", APP)).toBe(true);
  });

  it("ignores third-party origins", () => {
    expect(
      isAppConsoleError("Failed to load resource", "https://clerk.example.com/x.js", APP),
    ).toBe(false);
  });

  it("ignores Tabee, Datadog contentScript.js and CSP eval reports", () => {
    expect(isAppConsoleError("Tabee: init failed", "", APP)).toBe(false);
    expect(
      isAppConsoleError("TypeError: x is undefined", "chrome-extension://abc/contentScript.js", APP),
    ).toBe(false);
    expect(
      isAppConsoleError(
        "Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source",
        "",
        APP,
      ),
    ).toBe(false);
  });

  it("leaves resource failures to the response check", () => {
    expect(
      isAppConsoleError(
        "Failed to load resource: the server responded with a status of 403 ()",
        `${APP}/api/fixtures?date=2026-09-28`,
        APP,
      ),
    ).toBe(false);
    expect(isAppResponseFailure(`${APP}/api/fixtures`, 403, APP)).toBe(false);
    expect(isAppResponseFailure(`${APP}/api/fixtures`, 500, APP)).toBe(true);
    expect(isAppResponseFailure(`${APP}/_next/static/chunks/a.js`, 404, APP)).toBe(true);
    expect(isAppResponseFailure("https://cdn.vendor.com/x.js", 500, APP)).toBe(false);
  });

  it("counts uncaught exceptions from app chunks, skips third-party stacks", () => {
    expect(
      isAppPageError("boom", `Error: boom\n    at f (${APP}/_next/static/chunks/a.js:1:2)`, APP),
    ).toBe(true);
    expect(
      isAppPageError("boom", "Error: boom\n    at f (https://cdn.vendor.com/sdk.js:1:2)", APP),
    ).toBe(false);
    expect(isAppPageError("boom", "", APP)).toBe(true);
  });
});
