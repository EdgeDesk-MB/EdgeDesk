import { describe, expect, it } from "vitest";
import {
  POSTHOG_PRODUCTION_HOSTS,
  shouldCapturePosthogOnHost,
  shouldCapturePosthogOnServer,
} from "./posthog-gate";

describe("shouldCapturePosthogOnHost", () => {
  it("captures on every production host", () => {
    for (const host of POSTHOG_PRODUCTION_HOSTS) {
      expect(shouldCapturePosthogOnHost(host, undefined)).toBe(true);
    }
  });

  it("skips localhost, loopback and Vercel previews", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "edgeways-git-branch-sam.vercel.app",
      "staging.edgeways.app",
      "",
    ]) {
      expect(shouldCapturePosthogOnHost(host, undefined)).toBe(false);
    }
  });

  it("captures anywhere when force-enabled with true", () => {
    expect(shouldCapturePosthogOnHost("localhost", "true")).toBe(true);
    expect(shouldCapturePosthogOnHost("localhost", " TRUE ")).toBe(true);
  });

  it("ignores other force values", () => {
    for (const value of ["false", "", "1", "yes"]) {
      expect(shouldCapturePosthogOnHost("localhost", value)).toBe(false);
    }
  });
});

describe("shouldCapturePosthogOnServer", () => {
  it("captures only on the Vercel production deploy", () => {
    expect(shouldCapturePosthogOnServer({ VERCEL_ENV: "production" })).toBe(true);
    expect(shouldCapturePosthogOnServer({ VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldCapturePosthogOnServer({ VERCEL_ENV: "development" })).toBe(false);
    expect(shouldCapturePosthogOnServer({})).toBe(false);
  });

  it("captures anywhere when force-enabled", () => {
    expect(
      shouldCapturePosthogOnServer({ NEXT_PUBLIC_POSTHOG_FORCE_ENABLE: "true" })
    ).toBe(true);
    expect(
      shouldCapturePosthogOnServer({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_POSTHOG_FORCE_ENABLE: "false",
      })
    ).toBe(false);
  });
});
