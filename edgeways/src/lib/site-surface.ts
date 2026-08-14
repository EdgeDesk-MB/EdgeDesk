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

const WAITLIST_PAGES = new Set([
  "/",
  "/login",
  "/sign-up",
  "/waitlist/confirmed",
  "/waitlist/unsubscribed",
]);

const WAITLIST_API_PREFIX = "/api/waitlist";

/** Paths reachable when SITE_SURFACE=waitlist. */
export function isWaitlistAllowedPath(pathname: string): boolean {
  if (WAITLIST_PAGES.has(pathname)) return true;
  if (pathname === WAITLIST_API_PREFIX || pathname.startsWith(`${WAITLIST_API_PREFIX}/`)) {
    return true;
  }
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
  if (pathname === "/opengraph-image" || pathname === "/twitter-image") return true;
  if (pathname.startsWith("/opengraph-image") || pathname.startsWith("/twitter-image")) {
    return true;
  }
  if (pathname.startsWith("/brand/")) return true;
  return false;
}
