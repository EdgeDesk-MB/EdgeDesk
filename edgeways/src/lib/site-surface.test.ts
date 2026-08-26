import { describe, expect, it } from "vitest";
import {
  getLandingVariant,
  isPublicAssetPath,
  isSearchFaviconPath,
  isWaitlistAllowedPath,
  isWaitlistSurface,
  postSubscribeNextHref,
  postSubscribeNextLabel,
  requestHostname,
  shouldRedirectWwwToApex,
} from "@/lib/site-surface";

describe("site surface", () => {
  it("fails closed to waitlist unless SITE_SURFACE=app (EDGE-109)", () => {
    const prev = process.env.SITE_SURFACE;
    delete process.env.SITE_SURFACE;
    expect(isWaitlistSurface()).toBe(true);
    process.env.SITE_SURFACE = "waitlist";
    expect(isWaitlistSurface()).toBe(true);
    process.env.SITE_SURFACE = "app";
    expect(isWaitlistSurface()).toBe(false);
    if (prev === undefined) delete process.env.SITE_SURFACE;
    else process.env.SITE_SURFACE = prev;
  });

  it("allows marketing and waitlist routes", () => {
    expect(isWaitlistAllowedPath("/")).toBe(true);
    expect(isWaitlistAllowedPath("/login")).toBe(true);
    expect(isWaitlistAllowedPath("/sign-up")).toBe(true);
    expect(isWaitlistAllowedPath("/subscribe")).toBe(true);
    expect(isWaitlistAllowedPath("/subscribe/success")).toBe(true);
    expect(isWaitlistAllowedPath("/api/billing/portal")).toBe(true);
    expect(isWaitlistAllowedPath("/api/billing/session")).toBe(true);
    expect(isWaitlistAllowedPath("/api/billing/webhook")).toBe(true);
    expect(isWaitlistAllowedPath("/api/billing/account")).toBe(true);
    expect(isWaitlistAllowedPath("/waitlist/confirmed")).toBe(true);
    expect(isWaitlistAllowedPath("/waitlist/unsubscribed")).toBe(true);
    expect(isWaitlistAllowedPath("/api/waitlist")).toBe(true);
    expect(isWaitlistAllowedPath("/api/waitlist/confirm")).toBe(true);
    expect(isWaitlistAllowedPath("/api/waitlist/unsubscribe")).toBe(true);
    expect(isWaitlistAllowedPath("/api/account/sync")).toBe(true);
    expect(isWaitlistAllowedPath("/api/account/onboarding")).toBe(true);
    expect(isWaitlistAllowedPath("/contact")).toBe(true);
    expect(isWaitlistAllowedPath("/refund")).toBe(true);
    expect(isWaitlistAllowedPath("/terms")).toBe(true);
    expect(isWaitlistAllowedPath("/privacy")).toBe(true);
    expect(isWaitlistAllowedPath("/demo")).toBe(true);
    expect(isWaitlistAllowedPath("/setup")).toBe(true);
    expect(isWaitlistAllowedPath("/api/demo/state")).toBe(true);
    expect(isWaitlistAllowedPath("/api/health")).toBe(true);
    expect(isWaitlistAllowedPath("/admin")).toBe(true);
    expect(isWaitlistAllowedPath("/admin/users")).toBe(true);
    expect(isWaitlistAllowedPath("/api/admin/session")).toBe(true);
    expect(isWaitlistAllowedPath("/api/maintenance")).toBe(true);
  });

  it("blocks desk routes", () => {
    expect(isWaitlistAllowedPath("/desk")).toBe(false);
    expect(isWaitlistAllowedPath("/accounts")).toBe(false);
    expect(isWaitlistAllowedPath("/api/bets")).toBe(false);
    expect(isWaitlistAllowedPath("/api/accounts")).toBe(false);
  });

  it("allows public assets", () => {
    expect(isPublicAssetPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicAssetPath("/icon-192.png")).toBe(true);
    expect(isPublicAssetPath("/og")).toBe(true);
    expect(isPublicAssetPath("/opengraph-image")).toBe(true);
    expect(isPublicAssetPath("/opengraph-image-pwu6ef")).toBe(true);
    expect(isPublicAssetPath("/twitter-image-pwu6ef")).toBe(true);
    expect(isPublicAssetPath("/sw.js")).toBe(true);
    expect(isPublicAssetPath("/robots.txt")).toBe(true);
    expect(isPublicAssetPath("/sitemap.xml")).toBe(true);
    expect(isPublicAssetPath("/ingest")).toBe(true);
    expect(isPublicAssetPath("/ingest/e")).toBe(true);
    expect(isPublicAssetPath("/ingest/decide")).toBe(true);
    expect(isPublicAssetPath("/ingest/static/array.js")).toBe(true);
    expect(isPublicAssetPath("/ingest-not-ours")).toBe(false);
  });

  it("keeps Search favicon files on www and 308s the rest", () => {
    expect(isSearchFaviconPath("/favicon.ico")).toBe(true);
    expect(isSearchFaviconPath("/icon-192.png")).toBe(true);
    expect(isSearchFaviconPath("/icon-512.png")).toBe(true);
    expect(isSearchFaviconPath("/icon")).toBe(true);
    expect(isSearchFaviconPath("/apple-icon.png")).toBe(true);
    expect(isSearchFaviconPath("/")).toBe(false);
    expect(isSearchFaviconPath("/robots.txt")).toBe(false);
    expect(shouldRedirectWwwToApex("/")).toBe(true);
    expect(shouldRedirectWwwToApex("/terms")).toBe(true);
    expect(shouldRedirectWwwToApex("/favicon.ico")).toBe(false);
    expect(shouldRedirectWwwToApex("/icon-192.png")).toBe(false);
    expect(shouldRedirectWwwToApex("/icon")).toBe(false);
  });

  it("reads the forwarded host first", () => {
    const headers = new Headers({
      host: "edgeways.app",
      "x-forwarded-host": "www.edgeways.app",
    });
    expect(requestHostname({ headers })).toBe("www.edgeways.app");
  });
});

describe("post-subscribe next step", () => {
  it("opens the desk only on an explicit app deploy", () => {
    const prev = process.env.SITE_SURFACE;
    process.env.SITE_SURFACE = "app";
    expect(postSubscribeNextHref()).toBe("/setup");
    expect(postSubscribeNextLabel()).toBe("Set up the desk");
    expect(postSubscribeNextHref({ setupDone: true })).toBe("/desk");
    expect(postSubscribeNextLabel({ setupDone: true })).toBe("Open the desk");
    delete process.env.SITE_SURFACE;
    expect(postSubscribeNextHref()).toBe("/");
    expect(postSubscribeNextLabel()).toBe("Back to Edgeways");
    expect(postSubscribeNextHref({ setupDone: true })).toBe("/");
    process.env.SITE_SURFACE = "waitlist";
    expect(postSubscribeNextHref({ from: "setup" })).toBeNull();
    expect(postSubscribeNextLabel({ from: "setup" })).toBe("Now close the tab");
    if (prev === undefined) delete process.env.SITE_SURFACE;
    else process.env.SITE_SURFACE = prev;
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
