/**
 * Thin normalizers for region/country codes already provided by upstream APIs.
 * Prefer API values; only map known aliases (e.g. Racing API "IRE" → ISO "IE").
 *
 * Football home nations use subdivision flag codes (ENG / SCT / WLS). Racing
 * still treats England / Scotland / Wales as GB (UK meetings).
 */

/** ISO 3166-1 alpha-2, or ENG / SCT / WLS for home-nation football flags. */
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
  // Football flags: no ISO alpha-2 for the home nations
  if (raw === "ENG" || raw === "SCT" || raw === "WLS") return raw;

  // Already ISO alpha-2
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return null;
}

const HOME_NATION_LABEL_TO_FLAG: Record<string, string> = {
  england: "ENG",
  scotland: "SCT",
  wales: "WLS",
};

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
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

/** Country label from API-Football (e.g. "England", "Spain") → flag code. */
export function countryLabelToIso(country?: string | null): string | null {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  if (key === "world" || key === "international") return null;
  const homeNation = HOME_NATION_LABEL_TO_FLAG[key];
  if (homeNation) return homeNation;
  const fromCode = toIsoCountryCode(country);
  if (fromCode) return fromCode;
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

export function flagLabelFromIso(iso: string): string | null {
  switch (iso.toUpperCase()) {
    case "ENG":
      return "England";
    case "SCT":
      return "Scotland";
    case "WLS":
      return "Wales";
    case "GB":
      return "UK";
    case "IE":
      return "Ireland";
    default:
      return null;
  }
}

/** Regional code for display chips (GB / IRE) matching Racing API conventions. */
export function racingRegionChip(region?: string | null): "GB" | "IRE" {
  return toIsoCountryCode(region) === "IE" ? "IRE" : "GB";
}

/** Black-flag + TAG LATIN subdivision sequences (England / Scotland / Wales). */
const HOME_NATION_FLAG_EMOJI: Record<string, string> = {
  ENG: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  SCT: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  WLS: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
};

/** Regional indicator symbols → flag emoji (no asset dependency). */
export function flagEmojiFromIso(iso: string): string {
  const cc = iso.toUpperCase();
  if (cc in HOME_NATION_FLAG_EMOJI) return HOME_NATION_FLAG_EMOJI[cc];
  if (cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}
