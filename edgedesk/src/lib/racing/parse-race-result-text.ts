/**
 * Parse pasted / OCR'd race-result text into 1st–4th horse names.
 * Handles ATR, Racing TV, Sporting Life Full Result tables, Racing Post.
 *
 * Sporting Life lists horses in finishing order as:
 *   6. DORNEY LAKE (9)   ← cloth number, not finish position
 * so we must not treat the leading digit as place.
 */

export type ParsedRacePlacings = {
  first: string;
  second: string;
  third: string;
  fourth: string;
};

const SKIP_LINE =
  /^(pos(?:ition)?\.?|dist\.?\s*btn|no\.?|draw|horse|age\s*\/?\s*wt|wgt|sp|or|jockey|trainer|tote|win|place|exacta|trifecta|swinger|result|full result|future form|racecard|weighed in|winning time|off time|runners?|class\b|distance|going|surface|prize|owner|comment|non[\s-]?runner)(?:\b|$)/i;

const COMMENTARY =
  /\b(wore hood|midfield|prominent|ridden|pushed along|held up|stayed on|weakened|progress|asked for effort|final furlong|led\b|ran on|no impression|awkward start)\b/i;

const POSITION_WORD: Record<string, number> = {
  "1st": 1,
  first: 1,
  winner: 1,
  "2nd": 2,
  second: 2,
  "3rd": 3,
  third: 3,
  "4th": 4,
  fourth: 4,
};

const COUNTRY =
  "(?:IRE|GB|FR|USA|GER|AUS|NZ|ITY|SAF|JPN|HK|UAE|IRELAND|re|ire|gb|fr)";

/** Title-case ALL CAPS horse names from Sporting Life. */
export function titleCaseHorse(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  // Already mixed case - leave alone
  if (/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)) return trimmed;
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Strip country suffixes, draw, odds, and trailing junk from a horse name. */
export function cleanHorseName(raw: string): string {
  let s = raw
    .replace(/\s+/g, " ")
    .replace(/[|•·@©®]+/g, " ")
    .trim();
  // Drop leading cloth / draw numbers ("6." or "(9)" or "12 (5)")
  s = s.replace(/^\d{1,2}[.)]\s*/, "");
  s = s.replace(/^\d{1,2}\s+/, "");
  s = s.replace(/^\(\d{1,2}\)\s*/, "");
  // Odds / SP / JFav at end
  s = s.replace(/\s+\d+\/\d+\s*(?:J?Fav)?\s*$/i, "");
  s = s.replace(/\s+\d+\.\d+\s*$/, "");
  // Draw in parentheses at end: (9)
  s = s.replace(/\s*\(\d{1,2}\)\s*$/, "");
  // Country codes (incl. OCR mangling "(re)" for IRE)
  s = s.replace(new RegExp(`\\s*\\(${COUNTRY}\\)\\s*$`, "i"), "");
  // Another draw after country strip / leading draw after cloth strip
  s = s.replace(/^\(\d{1,2}\)\s*/, "");
  s = s.replace(/\s*\(\d{1,2}\)\s*$/, "");
  // Jockey / trainer prefixes
  s = s.replace(/^(?:J:|T:)\s*/i, "");
  // Trailing weight like 9-7 or 10-8t
  s = s.replace(/\s+\d{1,2}-\d{1,2}[a-z]?\s*$/i, "");
  // Trailing single junk chars from OCR icons
  s = s.replace(/[\s\[\]{}<>]+$/g, "").trim();
  return titleCaseHorse(s);
}

function looksLikeHorseName(s: string): boolean {
  const name = cleanHorseName(s);
  if (name.length < 2 || name.length > 45) return false;
  if (!/[a-zA-Z]/.test(name)) return false;
  if (SKIP_LINE.test(name)) return false;
  if (COMMENTARY.test(name)) return false;
  if (/^\d+$/.test(name)) return false;
  if (/^(j:|t:|mr |mrs |ms |miss |dr )/i.test(name)) return false;
  const letters = name.replace(/[^a-zA-Z]/g, "").length;
  return letters >= 2 && letters / name.length >= 0.45;
}

function setPlace(
  places: Partial<Record<1 | 2 | 3 | 4, string>>,
  pos: number,
  horse: string
) {
  if (pos < 1 || pos > 4) return;
  const cleaned = cleanHorseName(horse);
  if (!looksLikeHorseName(cleaned)) return;
  const key = pos as 1 | 2 | 3 | 4;
  if (!places[key]) places[key] = cleaned;
}

/**
 * Sporting Life / ATR table: horses appear in finishing order as
 * "6. DORNEY LAKE (9)" - cloth number + ALL CAPS name + draw.
 * Collect those in document order → places 1–4.
 */
function parseFinishingOrderClothNames(lines: string[]): ParsedRacePlacings | null {
  const horses: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (SKIP_LINE.test(line) && line.length < 50) continue;
    if (COMMENTARY.test(line)) continue;
    if (/\bnon[\s-]?runner\b/i.test(line) || /\bNR\b/.test(line)) continue;

    // "6. DORNEY LAKE (9)" or "8.BAYRAAT (4)" or OCR "6 DORNEY LAKE (9)"
    // Also: "2 DICKOTHELEGEND" when OCR drops the period / spaces.
    const matches = [
      ...line.matchAll(
        /\b(\d{1,2})\s*[.)]?\s*([A-Z]{2,}(?:\s+[A-Z][A-Z'’.\-]*){0,5})(?:\s*\([^)]*\))?/g
      ),
    ];
    for (const m of matches) {
      const cloth = Number(m[1]);
      // Cloth numbers are typically 1–40; finish positions with ordinals handled elsewhere
      if (cloth < 1 || cloth <= 0 || cloth > 40) continue;
      // Require a separator OR an ALL-CAPS name of length ≥ 4 so "2 x" junk is skipped
      const rawName = m[2]!;
      if (rawName.length < 4) continue;
      // Skip if this looks like a header fragment
      if (/^(POSITION|HORSE|JOCKEY|TRAINER|DIST|FULL|FUTURE|FORM|AGE|WGT)/i.test(rawName)) {
        continue;
      }
      // Avoid matching SP fractions like "11/1" - already excluded by [A-Z]
      const cleaned = cleanHorseName(rawName);
      if (!looksLikeHorseName(cleaned)) continue;
      // Prefer names with a real word shape (at least one vowel)
      if (!/[aeiou]/i.test(cleaned)) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      horses.push(cleaned);
    }

    // Mixed-case variant: "6. Dorney Lake (9)"
    if (matches.length === 0) {
      const m = line.match(
        /\b(\d{1,2})\s*[.)]\s*([A-Z][a-zA-Z'’.\-]+(?:\s+[A-Za-z][a-zA-Z'’.\-]+){0,5})(?:\s*\(\d{1,2}\))?/
      );
      if (m) {
        const cloth = Number(m[1]);
        if (cloth >= 1 && cloth <= 40) {
          const cleaned = cleanHorseName(m[2]!);
          if (looksLikeHorseName(cleaned)) {
            const key = cleaned.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              horses.push(cleaned);
            }
          }
        }
      }
    }
  }

  if (horses.length < 1) return null;

  return {
    first: horses[0] ?? "",
    second: horses[1] ?? "",
    third: horses[2] ?? "",
    fourth: horses[3] ?? "",
  };
}

/**
 * Explicit ordinal places: "1st Sportingsilvermine", "Winner: Horse".
 */
function parseOrdinalPlaces(lines: string[]): ParsedRacePlacings | null {
  const places: Partial<Record<1 | 2 | 3 | 4, string>> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (SKIP_LINE.test(line) && line.length < 40) continue;
    if (COMMENTARY.test(line)) continue;

    // "1st Sportingsilvermine" - require ordinal suffix so cloth "6." is not a place
    let m = line.match(
      /^(?:pos\.?\s*)?(\d{1,2})(?:st|nd|rd|th)\s*[.):\-–-]?\s+(.+)$/i
    );
    if (m) {
      setPlace(places, Number(m[1]), m[2]!);
      continue;
    }

    // "1st" alone, horse on next line
    m = line.match(/^(?:pos\.?\s*)?(\d{1,2})(?:st|nd|rd|th)\.?$/i);
    if (m) {
      const pos = Number(m[1]);
      const next = lines[i + 1];
      if (next && looksLikeHorseName(next)) {
        setPlace(places, pos, next);
        i += 1;
      }
      continue;
    }

    m = line.match(
      /^(1st|2nd|3rd|4th|first|second|third|fourth|winner)\s*[:\-–-]\s*(.+)$/i
    );
    if (m) {
      const pos = POSITION_WORD[m[1]!.toLowerCase()];
      if (pos) setPlace(places, pos, m[2]!);
      continue;
    }

    const inline = [
      ...line.matchAll(
        /\b(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z][A-Za-z0-9'’.\- ]{1,35}?)(?=\s+(?:\d{1,2}(?:st|nd|rd|th)\b)|$)/gi
      ),
    ];
    if (inline.length >= 2) {
      for (const hit of inline) {
        setPlace(places, Number(hit[1]), hit[2]!);
      }
    }
  }

  if (!places[1]) return null;

  return {
    first: places[1] ?? "",
    second: places[2] ?? "",
    third: places[3] ?? "",
    fourth: places[4] ?? "",
  };
}

/**
 * Extract 1st–4th from free-form result text (paste or OCR).
 */
export function parseRaceResultText(text: string): ParsedRacePlacings | null {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return null;

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Prefer Sporting Life finishing-order cloth names when we see several ALL-CAPS entries
  const clothOrder = parseFinishingOrderClothNames(lines);
  const capsHits = (raw.match(/\b\d{1,2}\s*[.)]\s*[A-Z]{2,}(?:\s+[A-Z]{2,})+/g) ?? [])
    .length;
  if (clothOrder && capsHits >= 2) {
    return clothOrder;
  }

  const ordinal = parseOrdinalPlaces(lines);
  if (ordinal) return ordinal;

  // Fallback: cloth-order even with fewer caps hits (OCR may mangle case)
  if (clothOrder?.first) return clothOrder;

  return null;
}
