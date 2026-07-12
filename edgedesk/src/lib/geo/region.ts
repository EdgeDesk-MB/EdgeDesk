/**
 * Thin normalizers for region/country codes already provided by upstream APIs.
 * Prefer API values; only map known aliases (e.g. Racing API "IRE" → ISO "IE").
 */

/** ISO 3166-1 alpha-2 for flag rendering (emoji / flagcdn). */
export function toIsoCountryCode(code?: string | null): string | null {
  if (!code) return null;
  const raw = code.trim().toUpperCase();
  if (!raw) return null;

  // Racing API / offer rules use IRE; Betfair & ISO use IE
  if (raw === "IRE" || raw === "IRL" || raw === "IRELAND") return "IE";
  if (raw === "UK" || raw === "GBR" || raw === "GREAT BRITAIN" || raw === "ENGLAND") return "GB";
  if (raw === "NI" || raw === "NIR" || raw === "NORTHERN IRELAND") return "GB";
  if (raw === "SCO" || raw === "SCOTLAND") return "GB";
  if (raw === "WAL" || raw === "WALES") return "GB";

  // Already ISO alpha-2
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return null;
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "united kingdom": "GB",
  uk: "GB",
  spain: "ES",
  italy: "IT",
  germany: "DE",
  france: "FR",
  netherlands: "NL",
  portugal: "PT",
  belgium: "BE",
  turkey: "TR",
  brazil: "BR",
  argentina: "AR",
  mexico: "MX",
  usa: "US",
  "united states": "US",
};

/** Country label from API-Football (e.g. "England", "Spain") → ISO alpha-2. */
export function countryLabelToIso(country?: string | null): string | null {
  if (!country) return null;
  const fromCode = toIsoCountryCode(country);
  if (fromCode) return fromCode;
  const key = country.trim().toLowerCase();
  if (key === "world" || key === "international") return null;
  return COUNTRY_NAME_TO_ISO[key] ?? null;
}

/** Short label for racing regions as returned by The Racing API. */
export function racingRegionLabel(region?: string | null): string {
  const iso = toIsoCountryCode(region);
  if (iso === "IE") return "Ireland";
  if (iso === "GB") return "UK";
  if (region) return region.toUpperCase();
  return "UK";
}

/** Regional code for display chips (GB / IRE) matching Racing API conventions. */
export function racingRegionChip(region?: string | null): "GB" | "IRE" {
  return toIsoCountryCode(region) === "IE" ? "IRE" : "GB";
}

/** Regional indicator symbols → flag emoji (no asset dependency). */
export function flagEmojiFromIso(iso: string): string {
  const cc = iso.toUpperCase();
  if (cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}
