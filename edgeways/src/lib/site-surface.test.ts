import { describe, expect, it } from "vitest";
import {
  getLandingVariant,
  isPublicAssetPath,
  isWaitlistAllowedPath,
  isWaitlistSurface,
} from "@/lib/site-surface";

describe("site surface", () => {
  it("locks only when SITE_SURFACE=waitlist", () => {
    expect(isWaitlistSurface()).toBe(false);
  });

  it("allows marketing and waitlist routes", () => {
    expect(isWaitlistAllowedPath("/")).toBe(true);
    expect(isWaitlistAllowedPath("/login")).toBe(true);
    expect(isWaitlistAllowedPath("/sign-up")).toBe(true);
    expect(isWaitlistAllowedPath("/waitlist/confirmed")).toBe(true);
    expect(isWaitlistAllowedPath("/waitlist/unsubscribed")).toBe(true);
    expect(isWaitlistAllowedPath("/api/waitlist")).toBe(true);
    expect(isWaitlistAllowedPath("/api/waitlist/confirm")).toBe(true);
    expect(isWaitlistAllowedPath("/api/waitlist/unsubscribe")).toBe(true);
  });

  it("blocks desk routes", () => {
    expect(isWaitlistAllowedPath("/desk")).toBe(false);
    expect(isWaitlistAllowedPath("/accounts")).toBe(false);
    expect(isWaitlistAllowedPath("/api/bets")).toBe(false);
  });

  it("allows public assets", () => {
    expect(isPublicAssetPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicAssetPath("/icon-192.png")).toBe(true);
    expect(isPublicAssetPath("/og")).toBe(true);
    expect(isPublicAssetPath("/opengraph-image")).toBe(true);
    expect(isPublicAssetPath("/opengraph-image-pwu6ef")).toBe(true);
    expect(isPublicAssetPath("/twitter-image-pwu6ef")).toBe(true);
    expect(isPublicAssetPath("/sw.js")).toBe(true);
  });
});

describe("landing variant", () => {
  it("defaults to waitlist so production / stays the current homepage", () => {
    const prev = process.env.LANDING_VARIANT;
    delete process.env.LANDING_VARIANT;
    expect(getLandingVariant()).toBe("waitlist");
    process.env.LANDING_VARIANT = "launch";
    expect(getLandingVariant()).toBe("launch");
    process.env.LANDING_VARIANT = "nope";
    expect(getLandingVariant()).toBe("waitlist");
    if (prev === undefined) delete process.env.LANDING_VARIANT;
    else process.env.LANDING_VARIANT = prev;
  });
});
