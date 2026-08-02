/**
 * Parse pasted / OCR'd race-result text into 1st–4th horse names.
 * Handles ATR, Racing TV, Sporting Life Full Result tables, Racing Post.
 *
 * Sporting Life lists horses in finishing order as:
 *   6. DORNEY LAKE (9)   ← cloth number, not finish position
 * so we must not treat the leading digit as place.
 */

export type SpFavouritePlace = 1 | 2 | 3 | 4;

export type ParsedRacePlacings = {
  first: string;
  second: string;
  third: string;
  fourth: string;
  /** Finishing place (1–4) marked Fav / JFav in the source text. */
  spFavouritePlace?: SpFavouritePlace;
  /** Winner line carried Fav / JFav (same as spFavouritePlace === 1). */
  winnerIsSpFavourite?: boolean;
  /** Starting prices as decimals keyed by finishing place. */
  spDecimals?: Partial<Record<SpFavouritePlace, number>>;
};

/** True when a result line marks the horse as SP favourite (not 2Fav / 3Fav). */
export function lineMarksSpFavourite(raw: string): boolean {
  // Match Fav / JFav / "SP Fav" / favourite, but not "2Fav" / "3Fav".
  return /(?:^|[^\dA-Za-z])(?:J?Fav|SP\s+Fav|favou?rite)\b/i.test(raw);
}

/**
 * Tesseract often mangles ATR fractional SPs: "5/2 Fav" → "512Fav",
 * "3/1 2Fav" → "3n2Fav" / "301 2Fav", "20/1" → "201".
 */
export function repairOcrRaceResultText(text: string): string {
  let t = text;
  // "3n2Fav" → "3/1 2Fav" (slash + 1 collapsed to "n")
  t = t.replace(/\b(\d{1,2})n(2Fav)\b/gi, "$1/1 $2");
  // "7n" / "22n" / "11n" → "7/1" etc.
  t = t.replace(/\b(\d{1,2})n\b/gi, "$1/1");
  // "301 2Fav" → "3/1 2Fav" (slash read as 0)
  t = t.replace(/\b(\d{1,2})0(\d)\s*(2Fav)\b/gi, "$1/$2 $3");
  // "512Fav" → "5/2 Fav" (slash OCR'd as the digit 1)
  t = t.replace(/\b(\d{1,2})1([2-9])(J?Fav)\b/gi, "$1/$2 $3");
  // "52Fav" → "5/2 Fav" (slash dropped entirely)
  t = t.replace(/\b(\d{1,2})([2-9])(J?Fav)\b/gi, "$1/$2 $3");
  // "201 888" / "200 88-8" → "20/1 …" (trailing 0/1 was the denominator)
  t = t.replace(/\b(\d{2,3})[01](?=\s+\d{1,2}[\d\s\-]{1,6}\b)/g, "$1/1");
  // "s2Fay" / "52Fay" OCR of "5/2 Fav"
  t = t.replace(/\b[s5]2\s*Fay\b/gi, "5/2 Fav");
  t = t.replace(/\bF\s*av\b/gi, "Fav");
  // "nn"/"nm"/"mn" in the SP slot before age/weight is a common OCR of "11/1"
  t = t.replace(
    /([@©]\s*)(?:nn|nm|mn|iii)(?=\s+\d{2,4}\b|\s+\d\s*\d-\d{2})/gi,
    (_m, prefix: string) => `${prefix}11/1`
  );
  return t;
}

/** Beaten-distance word crumbs from Dist Btn (not odds). */
const DISTANCE_WORD =
  /^(?:nk|hd|shd|sn|nse|ns|nose|neck|head|dist|dht|sh|dh)$/i;

/**
 * Beaten-distance fractions OCR often emits before the real SP (e.g. "3/4", "1/4").
 * These can also be genuine short SPs, so callers score candidates rather than
 * always trusting the first fraction seen.
 */
function isDistanceFraction(num: number, den: number): boolean {
  if (den === 4 && (num === 1 || num === 3)) return true;
  return false;
}

function fractionToSpDecimal(num: number, den: number): number | undefined {
  if (!(den > 0) || num < 0) return undefined;
  if (isDistanceFraction(num, den)) return undefined;
  const dec = 1 + num / den;
  // Real UK SPs are almost never shorter than ~1.30 in result tables we care about,
  // and 1.25 from "1/4" distance is the common OCR false positive.
  if (!(dec > 1.3)) return undefined;
  return dec;
}

/**
 * Pull a decimal SP from text that may contain "5/2 Fav" or "11.00".
 * Ignores beaten-distance crumbs like "1/4" / "3/4" / "4 1/4" / "nk".
 */
export function extractSpDecimal(raw: string): number | undefined {
  const repaired = repairOcrRaceResultText(raw);
  const trimmed = repaired.trim();
  if (!trimmed || DISTANCE_WORD.test(trimmed)) return undefined;
  // Compound lengths: "4 1/4", "1 1/2", "2¾" style OCR dumps — not SP.
  if (/^\d{1,2}\s+\d+\s*\/\s*\d+\s*$/.test(trimmed)) return undefined;

  // Prefer a whole-line SP (optional Fav / 2Fav).
  const clean = trimmed.match(/^(\d+)\s*\/\s*(\d+)\s*(?:J?Fav|2Fav)?$/i);
  if (clean) {
    const num = parseFloat(clean[1]!);
    const den = parseFloat(clean[2]!);
    // Bare 1/4 and 3/4 without Fav are almost always Dist Btn in ATR OCR.
    // Keep them when tagged Fav (genuine short-priced favourite).
    if (isDistanceFraction(num, den) && !/(?:J?Fav)\b/i.test(trimmed)) {
      return undefined;
    }
    // Allow genuine short odds on a clean SP line (including 1/2 → 1.50).
    if (den > 0 && num >= 0) {
      const dec = 1 + num / den;
      if (dec > 1) return dec;
    }
  }

  const frac = trimmed.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const sp = fractionToSpDecimal(parseFloat(frac[1]!), parseFloat(frac[2]!));
    if (sp != null) return sp;
  }
  const dec = trimmed.match(/\b(\d{1,3}\.\d{1,2})\b/);
  if (dec) {
    const n = parseFloat(dec[1]!);
    if (Number.isFinite(n) && n > 1.3) return n;
  }
  return undefined;
}

function withSpFavouriteMeta(
  base: Omit<ParsedRacePlacings, "spFavouritePlace" | "winnerIsSpFavourite" | "spDecimals">,
  place: SpFavouritePlace | undefined,
  spDecimals?: Partial<Record<SpFavouritePlace, number>>
): ParsedRacePlacings {
  const hasSp = spDecimals && Object.keys(spDecimals).length > 0;
  if (!place && !hasSp) return base;
  return {
    ...base,
    ...(place
      ? {
          spFavouritePlace: place,
          ...(place === 1 ? { winnerIsSpFavourite: true as const } : {}),
        }
      : {}),
    ...(hasSp ? { spDecimals } : {}),
  };
}

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
  horse: string,
  favByPos?: Partial<Record<1 | 2 | 3 | 4, boolean>>,
  trailingFav = false
) {
  if (pos < 1 || pos > 4) return;
  const cleaned = cleanHorseName(horse);
  if (!looksLikeHorseName(cleaned)) return;
  const key = pos as 1 | 2 | 3 | 4;
  if (!places[key]) {
    places[key] = cleaned;
    if (favByPos && (lineMarksSpFavourite(horse) || trailingFav)) favByPos[key] = true;
  }
}

/**
 * ATR / OCR often puts "5/2 Fav" on a later line than the horse name.
 * Scan a few following lines until the next runner / place row.
 */
function followingLineMarksSpFavourite(lines: string[], fromIndex: number): boolean {
  for (let j = fromIndex + 1; j < Math.min(fromIndex + 6, lines.length); j++) {
    const next = lines[j]!.trim();
    if (!next) continue;
    if (/^\d{1,2}(?:st|nd|rd|th)\b/i.test(next)) return false;
    if (/\b\d{1,2}\s*[.)]\s*[A-Za-z]{3,}/.test(next)) return false;
    if (/^(first|second|third|fourth|winner)\b/i.test(next)) return false;
    if (lineMarksSpFavourite(next)) return true;
  }
  return false;
}

type SpCandidate = { sp: number; score: number };

function scoreSpLine(line: string, sp: number): number {
  let score = 1;
  const trimmed = line.trim();
  if (/^\d+\s*\/\s*\d+\s*(?:J?Fav|2Fav)?$/i.test(trimmed)) score += 10;
  if (lineMarksSpFavourite(line)) score += 8;
  if (/\b2Fav\b/i.test(line)) score += 2;
  // Prefer realistic SP range; penalise tiny values that often come from distances.
  if (sp >= 2) score += 3;
  if (sp >= 4) score += 1;
  if (sp < 1.5) score -= 6;
  if (sp < 2 && !/(?:J?Fav|2Fav)\b/i.test(trimmed)) score -= 4;
  return score;
}

/**
 * Same window as Fav look-ahead. Scores every odds-like token and picks the best
 * (clean "11/1" / "5/2 Fav" beats distance crumbs like "3/4" or "1/4").
 */
function followingSpDecimal(lines: string[], fromIndex: number, sameLine: string): number | undefined {
  const candidates: SpCandidate[] = [];
  const consider = (raw: string) => {
    const sp = extractSpDecimal(raw);
    if (sp == null) return;
    candidates.push({ sp, score: scoreSpLine(raw, sp) });
  };
  consider(sameLine);
  for (let j = fromIndex + 1; j < Math.min(fromIndex + 10, lines.length); j++) {
    const next = lines[j]!.trim();
    if (!next) continue;
    if (/^\d{1,2}(?:st|nd|rd|th)\b/i.test(next)) break;
    if (/\b\d{1,2}\s*[.)]\s*[A-Za-z]{3,}/.test(next)) break;
    if (/^(first|second|third|fourth|winner)\b/i.test(next)) break;
    // ATR OCR often tacks SP onto the end of a long commentary line for
    // places with verbose write-ups (typically 1st / 3rd). Still mine odds.
    consider(next);
  }
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.sp;
}

/**
 * Sporting Life / ATR table: horses appear in finishing order as
 * "6. DORNEY LAKE (9)" - cloth number + ALL CAPS name + draw.
 * Collect those in document order → places 1–4.
 */
function parseFinishingOrderClothNames(lines: string[]): ParsedRacePlacings | null {
  const horses: { name: string; fav: boolean; sp?: number }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (SKIP_LINE.test(line) && line.length < 50) continue;
    if (COMMENTARY.test(line)) continue;
    if (/\bnon[\s-]?runner\b/i.test(line) || /\bNR\b/.test(line)) continue;

    // "6. DORNEY LAKE (9)" or "8.BAYRAAT (4)" or OCR "6 DORNEY LAKE (9)"
    // Also: "2 DICKOTHELEGEND" when OCR drops the period / spaces.
    const matches = [
      ...line.matchAll(
        /\b(\d{1,2})\s*[.)]?\s*([A-Z]{2,}(?:\s+[A-Z][A-Z'’.\-]*){0,5})(?:\s*\([^)]*\))?(?:\s+\d+\/\d+\s*(?:J?Fav)?)?/g
      ),
    ];
    let addedOnLine = false;
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
      const matchFav =
        lineMarksSpFavourite(m[0]!) ||
        lineMarksSpFavourite(line) ||
        followingLineMarksSpFavourite(lines, i);
      horses.push({
        name: cleaned,
        fav: matchFav,
        sp: followingSpDecimal(lines, i, `${m[0]!} ${line}`),
      });
      addedOnLine = true;
    }

    // Mixed-case variant: "6. Dorney Lake (9)"
    if (!addedOnLine && matches.length === 0) {
      const m = line.match(
        /\b(\d{1,2})\s*[.)]\s*([A-Z][a-zA-Z'’.\-]+(?:\s+[A-Za-z][a-zA-Z'’.\-]+){0,5})(?:\s*\(\d{1,2}\))?(?:\s+\d+\/\d+\s*(?:J?Fav)?)?/
      );
      if (m) {
        const cloth = Number(m[1]);
        if (cloth >= 1 && cloth <= 40) {
          const cleaned = cleanHorseName(m[2]!);
          if (looksLikeHorseName(cleaned)) {
            const key = cleaned.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              horses.push({
                name: cleaned,
                fav:
                  lineMarksSpFavourite(m[0]!) ||
                  lineMarksSpFavourite(line) ||
                  followingLineMarksSpFavourite(lines, i),
                sp: followingSpDecimal(lines, i, `${m[0]!} ${line}`),
              });
            }
          }
        }
      }
    }
  }

  if (horses.length < 1) return null;

  const favIndex = horses.findIndex((h) => h.fav);
  const favPlace =
    favIndex >= 0 && favIndex < 4 ? ((favIndex + 1) as SpFavouritePlace) : undefined;
  const spDecimals: Partial<Record<SpFavouritePlace, number>> = {};
  horses.slice(0, 4).forEach((h, idx) => {
    if (h.sp != null) spDecimals[(idx + 1) as SpFavouritePlace] = h.sp;
  });

  return withSpFavouriteMeta(
    {
      first: horses[0]?.name ?? "",
      second: horses[1]?.name ?? "",
      third: horses[2]?.name ?? "",
      fourth: horses[3]?.name ?? "",
    },
    favPlace,
    spDecimals
  );
}

/**
 * Explicit ordinal places: "1st Sportingsilvermine", "Winner: Horse".
 */
function parseOrdinalPlaces(lines: string[]): ParsedRacePlacings | null {
  const places: Partial<Record<1 | 2 | 3 | 4, string>> = {};
  const favByPos: Partial<Record<1 | 2 | 3 | 4, boolean>> = {};
  const spByPos: Partial<Record<SpFavouritePlace, number>> = {};

  const rememberSp = (pos: number, raw: string, lineIndex: number) => {
    if (pos < 1 || pos > 4 || spByPos[pos as SpFavouritePlace] != null) return;
    const sp = followingSpDecimal(lines, lineIndex, raw);
    if (sp != null) spByPos[pos as SpFavouritePlace] = sp;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (SKIP_LINE.test(line) && line.length < 40) continue;
    if (COMMENTARY.test(line)) continue;

    // "1st Sportingsilvermine" - require ordinal suffix so cloth "6." is not a place
    let m = line.match(
      /^(?:pos\.?\s*)?(\d{1,2})(?:st|nd|rd|th)\s*[.):\-–-]?\s+(.+)$/i
    );
    if (m) {
      const pos = Number(m[1]);
      setPlace(
        places,
        pos,
        m[2]!,
        favByPos,
        followingLineMarksSpFavourite(lines, i)
      );
      rememberSp(pos, m[2]!, i);
      continue;
    }

    // "1st" alone, horse on next line
    m = line.match(/^(?:pos\.?\s*)?(\d{1,2})(?:st|nd|rd|th)\.?$/i);
    if (m) {
      const pos = Number(m[1]);
      const next = lines[i + 1];
      if (next && looksLikeHorseName(next)) {
        setPlace(
          places,
          pos,
          next,
          favByPos,
          followingLineMarksSpFavourite(lines, i + 1)
        );
        rememberSp(pos, next, i + 1);
        i += 1;
      }
      continue;
    }

    m = line.match(
      /^(1st|2nd|3rd|4th|first|second|third|fourth|winner)\s*[:\-–-]\s*(.+)$/i
    );
    if (m) {
      const pos = POSITION_WORD[m[1]!.toLowerCase()];
      if (pos) {
        setPlace(places, pos, m[2]!, favByPos, followingLineMarksSpFavourite(lines, i));
        rememberSp(pos, m[2]!, i);
      }
      continue;
    }

    const inline = [
      ...line.matchAll(
        /\b(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z][A-Za-z0-9'’.\- ]{1,35}?)(?=\s+(?:\d{1,2}(?:st|nd|rd|th)\b)|$)/gi
      ),
    ];
    if (inline.length >= 2) {
      for (const hit of inline) {
        const pos = Number(hit[1]);
        setPlace(places, pos, hit[2]!, favByPos);
        rememberSp(pos, hit[2]!, i);
      }
    }
  }

  if (!places[1]) return null;

  const favPlace = ([1, 2, 3, 4] as const).find((p) => favByPos[p]);

  return withSpFavouriteMeta(
    {
      first: places[1] ?? "",
      second: places[2] ?? "",
      third: places[3] ?? "",
      fourth: places[4] ?? "",
    },
    favPlace,
    spByPos
  );
}

/**
 * Extract 1st–4th from free-form result text (paste or OCR).
 */
export function parseRaceResultText(text: string): ParsedRacePlacings | null {
  const raw = repairOcrRaceResultText(text.replace(/\r\n/g, "\n")).trim();
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
