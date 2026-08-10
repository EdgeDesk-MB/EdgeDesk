/**
 * Normalise a user-entered "link to offer" URL.
 * Empty → null. Bare hosts get https://. Only http(s) are accepted.
 */
export function normalizeOfferUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** True when the user typed something that is not a usable http(s) link. */
export function isInvalidOfferUrlInput(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return false;
  return normalizeOfferUrl(trimmed) == null;
}

/**
 * Pull a likely URL out of clipboard text (plain URL, or a sentence that
 * contains one). Returns the trimmed raw string when nothing URL-like is found.
 */
export function extractOfferUrlCandidate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const https = trimmed.match(/https?:\/\/[^\s<>"'()]+/i);
  if (https) return https[0].replace(/[),.]+$/, "");
  const www = trimmed.match(/\bwww\.[^\s<>"'()]+/i);
  if (www) return www[0].replace(/[),.]+$/, "");
  return trimmed;
}
