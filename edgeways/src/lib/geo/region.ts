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
  // NI is ISO Nicaragua. Racing Northern Ireland is NIR, not the ISO code.
  if (raw === "NIR" || raw === "NORTHERN IRELAND") return "GB";
  if (raw === "SCO" || raw === "SCOTLAND") return "GB";
  if (raw === "WAL" || raw === "WALES") return "GB";
  // Football flags: no ISO alpha-2 for the home nations
  if (raw === "ENG" || raw === "SCT" || raw === "WLS") return raw;

  if (raw === "RUS" || raw === "RUSSIA" || raw === "SU") return "RU";

  // Already ISO alpha-2. Skip withdrawn codes that have no emoji flag
  // (`SU` is handled above; others would paint boxed letters).
  if (/^[A-Z]{2}$/.test(raw)) {
    if (WITHDRAWN_ISO.has(raw)) return null;
    return raw;
  }
  return null;
}

const HOME_NATION_LABEL_TO_FLAG: Record<string, string> = {
  england: "ENG",
  scotland: "SCT",
  wales: "WLS",
};

/** Withdrawn ISO 3166-1 codes. `SU`’s display name is still “Russia”. */
const WITHDRAWN_ISO = new Set(["SU", "DD", "YU", "CS", "AN", "NT", "TP", "ZR"]);

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
  /** API-Football labels that do not match Intl English region names. */
  "korea republic": "KR",
  korea: "KR",
  "cote d'ivoire": "CI",
  "côte d'ivoire": "CI",
  "ivory coast": "CI",
  "bosnia and herzegovina": "BA",
  "bosnia-herzegovina": "BA",
  bosnia: "BA",
  "czech republic": "CZ",
  "china pr": "CN",
  "republic of ireland": "IE",
  "north macedonia": "MK",
  macedonia: "MK",
  russia: "RU",
  "russian federation": "RU",
};

let englishRegionNameToIso: Map<string, string> | null = null;

function englishRegionNameIndex(): Map<string, string> {
  if (englishRegionNameToIso) return englishRegionNameToIso;
  const index = new Map<string, string>();
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (WITHDRAWN_ISO.has(code)) continue;
      const name = names.of(code);
      if (!name || name === code) continue;
      const key = name.toLowerCase();
      if (index.has(key)) continue;
      index.set(key, code);
    }
  }
  englishRegionNameToIso = index;
  return index;
}

/** Country label from API-Football (e.g. "England", "Spain") → flag code. */
export function countryLabelToIso(country?: string | null): string | null {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  if (key === "world" || key === "international") return null;
  const homeNation = HOME_NATION_LABEL_TO_FLAG[key];
  if (homeNation) return homeNation;
  const fromCode = toIsoCountryCode(country);
  if (fromCode) return fromCode;
  return COUNTRY_NAME_TO_ISO[key] ?? englishRegionNameIndex().get(key) ?? null;
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
