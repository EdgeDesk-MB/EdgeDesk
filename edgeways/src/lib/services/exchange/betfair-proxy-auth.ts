/** Shared auth and URL allowlist for the London Edge Betfair proxy. */

export function betfairProxyAllowed(
  authorization: string | null,
  appKey: string | null
): boolean {
  const key = appKey?.trim();
  if (!key) return false;
  return authorization === `Bearer ${key}`;
}

/** Node on Vercel (Hobby = iad1) must not call Betfair directly. */
export function betfairRunsOnVercelNode(): boolean {
  return Boolean(process.env.VERCEL) && process.env.NEXT_RUNTIME !== "edge";
}

export function isAllowedBetfairUpstreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "identitysso.betfair.com") {
      return parsed.pathname === "/api/login";
    }
    if (host === "api.betfair.com") {
      return parsed.pathname.startsWith("/exchange/betting/rest/v1.0/");
    }
    return false;
  } catch {
    return false;
  }
}
