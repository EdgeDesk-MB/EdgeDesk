/**
 * Public /demo (EDGE-59). Cookie-scoped look at a filled desk.
 * Not the Settings file-flip (`edgeways-demo.db` / POST /api/data/demo).
 */
import type { PlanId } from "@/lib/entitlements/plans";
import { PUBLIC_SITE_ORIGIN } from "@/lib/marketing/share-metadata";

export const PUBLIC_DEMO_COOKIE = "ew_public_demo";
export const PUBLIC_DEMO_HREF = "/demo";
/** Auth / “start your desk” landings. Proxy clears the demo cookie, then strips this. */
export const PUBLIC_DEMO_LIVE_PARAM = "live";

export type DemoNoticeKind = "none" | "guest" | "account";

export type PublicDemoView = PlanId;

export function parsePublicDemoView(
  value: string | null | undefined
): PublicDemoView {
  if (value === "free" || value === "core") return value;
  return "edge";
}

/** Plan preview query param. Desks must not reuse it (EDGE-159). */
export const PUBLIC_DEMO_VIEW_PARAM = "view";

/** Only an explicit plan counts. A missing or foreign `?view=` is not "edge". */
export function readPublicDemoViewParam(
  value: string | null | undefined
): PublicDemoView | null {
  return value === "free" || value === "core" || value === "edge" ? value : null;
}

/**
 * Query string carrying `view`, or null when `search` already has it. Plain
 * nav links drop the query, so the demo writes the plan back after each
 * navigation, otherwise a reload falls through to Edge.
 */
export function publicDemoSearchWithView(
  search: string,
  view: PublicDemoView
): string | null {
  const params = new URLSearchParams(search);
  if (params.get(PUBLIC_DEMO_VIEW_PARAM) === view) return null;
  params.set(PUBLIC_DEMO_VIEW_PARAM, view);
  return `?${params.toString()}`;
}

/** Internal desk href with the demo plan attached, so new tabs keep it too. */
export function withPublicDemoView(href: string, view: PublicDemoView): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const search = queryAt === -1 ? "" : beforeHash.slice(queryAt);
  const next = publicDemoSearchWithView(search, view);
  return `${path}${next ?? search}${hash}`;
}

/**
 * Presence-only check for client UI (banners, write-blocking, FOUC skips).
 * The value is HMAC-signed (EDGE-91) and the secret never reaches the browser,
 * so any non-empty value counts here — every server gate verifies properly.
 */
export function hasPublicDemoCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => {
    const [name, value] = part.trim().split("=");
    return name === PUBLIC_DEMO_COOKIE && !!value;
  });
}

export function hasPublicDemoCookieInDocument(): boolean {
  if (typeof document === "undefined") return false;
  return hasPublicDemoCookie(document.cookie);
}

export function clearPublicDemoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PUBLIC_DEMO_COOKIE}=; Max-Age=0; path=/`;
}

export function isPublicDemoDeskPath(pathname: string): boolean {
  if (pathname === "/desk" || pathname.startsWith("/desk/")) return true;
  return [
    "/accounts",
    "/tracker",
    "/offers",
    "/report",
    "/history",
    "/acca",
    "/bet-builder",
    "/systems",
    "/tracked-events",
    "/calculators",
    "/settings",
    "/help",
    "/roadmap",
    "/boosts",
    "/casino",
    "/feedback",
    "/racing",
    "/early-payout",
    "/2up",
    "/alerts",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const PUBLIC_DEMO_APPEARANCE_KEYS = [
  "brandAccentPreset",
  "brandAccentHex",
  "uiFont",
  "headerPattern",
] as const;

/** Drop appearance fields so a demo preview cannot write the live desk prefs. */
export function stripPublicDemoAppearancePatch<T extends Record<string, unknown>>(
  patch: T,
  demoActive: boolean
): T {
  if (!demoActive) return patch;
  const next = { ...patch };
  for (const key of PUBLIC_DEMO_APPEARANCE_KEYS) {
    delete next[key];
  }
  return next;
}

export function publicDemoWriteMessage(): string {
  return "This is a look at the desk. Start a trial to use your own bookies.";
}

export function publicDemoBarLine(view: PublicDemoView): string {
  if (view === "free") {
    return "Free: calculators, a bet log you can settle, wallets that follow results, and basic P&L.";
  }
  if (view === "core") {
    return "Core: offers, Do Next, and the Edge Report.";
  }
  return "Edge: live racing, Offer Edge picks, and 2UP alerts.";
}

/** Landing-page plans section (marketing `#pricing`). */
export function publicDemoPlansHref(): string {
  return `${PUBLIC_SITE_ORIGIN}/#pricing`;
}

/** Desk with the public-demo cookie still on: advise, and prompt a live desk if signed in. */
export function demoNoticeKind(input: {
  publicDemo: boolean;
  signedIn: boolean;
}): DemoNoticeKind {
  if (!input.publicDemo) return "none";
  return input.signedIn ? "account" : "guest";
}

export function demoNoticeStorageKey(kind: Exclude<DemoNoticeKind, "none">): string {
  return `edgeways:demo-notice:${kind}`;
}

export function liveDeskHref(path: "/desk" | "/setup" = "/desk"): string {
  return `${path}?${PUBLIC_DEMO_LIVE_PARAM}=1`;
}

export function assignLiveDesk(path: "/desk" | "/setup"): void {
  clearPublicDemoCookie();
  if (typeof window === "undefined") return;
  window.location.assign(liveDeskHref(path));
}

export type SignedInDemoCta = {
  label: string;
  path: "/setup" | "/desk";
};

/**
 * One primary action for a signed-in user on the public demo.
 * Live SQLite, not the canned fixture, decides which label.
 */
export function signedInDemoCta(liveDeskStarted: boolean): SignedInDemoCta {
  if (liveDeskStarted) {
    return { label: "Back to your desk", path: "/desk" };
  }
  return { label: "Set up your desk", path: "/setup" };
}

/** Loading and failed reads use the safer return path, not setup. */
export function signedInDemoCtaForStatus(
  status: "loading" | "ready" | "error",
  liveDeskStarted: boolean
): SignedInDemoCta | null {
  if (status === "loading") return null;
  if (status === "error") return { label: "Back to your desk", path: "/desk" };
  return signedInDemoCta(liveDeskStarted);
}

export function isPublicDemoApiGet(path: string): boolean {
  return (
    path === "/api/acca" ||
    path === "/api/systems" ||
    path === "/api/bet-builder" ||
    path === "/api/casino" ||
    path === "/api/boosts" ||
    path === "/api/alerts" ||
    path.startsWith("/api/alerts?") ||
    path.startsWith("/api/racing/desk") ||
    path.startsWith("/api/offers/edge")
  );
}
