/** Public deploy mode: waitlist marketing only, or full desk app. */
export type SiteSurface = "waitlist" | "app";

export function getSiteSurface(): SiteSurface {
  return process.env.SITE_SURFACE === "waitlist" ? "waitlist" : "app";
}

/** Homepage version. Production stays waitlist until this is set to launch. */
export type LandingVariant = "waitlist" | "launch";

export function getLandingVariant(): LandingVariant {
  return process.env.LANDING_VARIANT === "launch" ? "launch" : "waitlist";
}

export function isWaitlistSurface(): boolean {
  return process.env.SITE_SURFACE === "waitlist";
}

/** After subscribe: desk when this deploy is the app, home when waitlist still owns /. */
export function postSubscribeNextHref(from?: "setup" | null): string | null {
  if (from === "setup") return null;
  return isWaitlistSurface() ? "/" : "/setup";
}

export function postSubscribeNextLabel(from?: "setup" | null): string {
  if (from === "setup") return "Now close the tab";
  return isWaitlistSurface() ? "Back to Edgeways" : "Set up the desk";
}

const WAITLIST_PAGES = new Set([
  "/",
  "/login",
  "/sign-up",
  "/subscribe",
  "/subscribe/success",
  "/demo",
  "/setup",
  "/waitlist/confirmed",
  "/waitlist/unsubscribed",
  "/contact",
  "/refund",
  "/terms",
  "/privacy",
]);

const WAITLIST_API_PREFIX = "/api/waitlist";
const WAITLIST_ACCOUNT_SYNC = "/api/account/sync";

/** Paths reachable when SITE_SURFACE=waitlist. */
export function isWaitlistAllowedPath(pathname: string): boolean {
  if (WAITLIST_PAGES.has(pathname)) return true;
  if (pathname === WAITLIST_ACCOUNT_SYNC || pathname.startsWith("/api/account/")) {
    return true;
  }
  if (pathname === "/api/billing/portal" || pathname.startsWith("/api/billing/")) {
    return true;
  }
  if (pathname === "/api/demo/state" || pathname.startsWith("/api/demo/")) {
    return true;
  }
  if (pathname === WAITLIST_API_PREFIX || pathname.startsWith(`${WAITLIST_API_PREFIX}/`)) {
    return true;
  }
  if (pathname === "/api/health") return true;
  return false;
}

/** Next metadata, PWA, and build assets — never redirect these. */
export function isPublicAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname === "/sw.js") return true;
  if (pathname === "/icon" || pathname.startsWith("/icon?")) return true;
  if (pathname === "/apple-icon.png") return true;
  if (/^\/icon-\d+\.png$/.test(pathname)) return true;
  if (pathname === "/badge-192.png") return true;
  if (pathname === "/og" || pathname.startsWith("/og?")) return true;
  if (pathname === "/opengraph-image" || pathname === "/twitter-image") return true;
  if (pathname.startsWith("/opengraph-image") || pathname.startsWith("/twitter-image")) {
    return true;
  }
  if (pathname.startsWith("/brand/")) return true;
  return false;
}
