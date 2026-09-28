/**
 * Decides which browser errors count against a smoke page (EDGE-217).
 * Only app-origin errors fail a page. Extension and third-party noise is
 * dropped by origin, then by the explicit allowlist below.
 */

export const NOISE_ALLOWLIST: { name: string; pattern: RegExp }[] = [
  { name: "Browser extension", pattern: /(chrome|moz|safari-web)-extension:\/\//i },
  { name: "Tabee extension", pattern: /tabee/i },
  { name: "Datadog content script", pattern: /contentScript\.js|datadog/i },
  {
    name: "CSP eval report",
    pattern: /unsafe-eval|Refused to evaluate a string as JavaScript/i,
  },
];

const URL_RE = /\b(?:https?|chrome-extension|moz-extension|safari-web-extension):\/\/[^\s)'"]+/gi;

export function isAllowlisted(text: string): boolean {
  return NOISE_ALLOWLIST.some(({ pattern }) => pattern.test(text));
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Console error. `sourceUrl` is Playwright's `msg.location().url`, empty for
 * inline or browser-generated messages, which we treat as app-origin.
 * Chromium's "Failed to load resource" lines are skipped: signed-out APIs
 * answer 401/403 by design, and `isAppResponseFailure` judges responses.
 */
export function isAppConsoleError(
  text: string,
  sourceUrl: string,
  appOrigin: string,
): boolean {
  if (/^Failed to load resource/i.test(text)) return false;
  if (isAllowlisted(text) || isAllowlisted(sourceUrl)) return false;
  if (!sourceUrl) return true;
  return originOf(sourceUrl) === appOrigin;
}

/**
 * Sub-resource response. Fails on any app-origin 5xx, and on 4xx for built
 * assets under `/_next/` (a missing chunk breaks the page). The document
 * itself is judged by its own status.
 */
export function isAppResponseFailure(
  url: string,
  status: number,
  appOrigin: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.origin !== appOrigin) return false;
  if (status >= 500) return true;
  return status >= 400 && parsed.pathname.startsWith("/_next/");
}

/**
 * Uncaught exception. Counts unless every URL in its stack is from another
 * origin, so a throw inside a third-party script does not fail the page.
 */
export function isAppPageError(
  message: string,
  stack: string,
  appOrigin: string,
): boolean {
  const text = `${message}\n${stack}`;
  if (isAllowlisted(text)) return false;
  const origins = (stack.match(URL_RE) ?? []).map(originOf);
  if (origins.length === 0) return true;
  return origins.some((o) => o === appOrigin);
}
