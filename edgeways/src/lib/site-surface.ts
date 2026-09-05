/** Public deploy mode: waitlist marketing only, or full desk app.
 * Production is `app` (verified 4 Sep 2026). Unset still fails closed to
 * waitlist (EDGE-109) so a new environment never opens the desk by accident.
 */
export type SiteSurface = "waitlist" | "app";

export function getSiteSurface(): SiteSurface {
  // Fail closed (EDGE-109): only an explicit "app" opens the desk. A missing
  // env var on a new environment must serve the waitlist, not the full app.
  return process.env.SITE_SURFACE === "app" ? "app" : "waitlist";
}

/** Homepage version. Production is `launch` (verified 4 Sep 2026).
 * Unset still serves the waitlist homepage.
 */
export type LandingVariant = "waitlist" | "launch";

export function getLandingVariant(): LandingVariant {
  return process.env.LANDING_VARIANT === "launch" ? "launch" : "waitlist";
}

export function isWaitlistSurface(): boolean {
  return process.env.SITE_SURFACE !== "app";
}

/** After subscribe: desk when this deploy is the app, home when waitlist still owns /. */
export function postSubscribeNextHref(input?: {
  from?: "setup" | null;
  setupDone?: boolean;
}): string | null {
  if (input?.from === "setup") return null;
  if (isWaitlistSurface()) return "/";
  return input?.setupDone ? "/desk" : "/setup";
}

export function postSubscribeNextLabel(input?: {
  from?: "setup" | null;
  setupDone?: boolean;
}): string {
  if (input?.from === "setup") return "Now close the tab";
  if (isWaitlistSurface()) return "Back to Edgeways";
  return input?.setupDone ? "Open the desk" : "Set up the desk";
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
  // Offer inbox webhook: provider POSTs must reach the app whatever surface
  // the inbound domain lands on. The route does its own signature auth.
  if (pathname === "/api/offers/inbound") return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) return true;
  if (pathname === "/api/maintenance") return true;
  return false;
}

/** Next metadata, PWA, and build assets — never redirect these. */
export function isPublicAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  // PostHog reverse proxy (next.config.ts). Waitlist gate must not 307 this to /.
  if (pathname === "/ingest" || pathname.startsWith("/ingest/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
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

/** Google keys the Search favicon by hostname. These must 200 on www. */
export function isSearchFaviconPath(pathname: string): boolean {
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/icon" || pathname.startsWith("/icon?")) return true;
  if (pathname === "/apple-icon.png") return true;
  return /^\/icon-\d+\.png$/.test(pathname);
}

/** HTML and APIs on www go to the apex. Icon files stay so Googlebot-Image can fetch them. */
export function shouldRedirectWwwToApex(pathname: string): boolean {
  return !isSearchFaviconPath(pathname);
}

export function requestHostname(request: Pick<Request, "headers">): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host.split(",")[0]?.trim().split(":")[0] ?? "";
}
