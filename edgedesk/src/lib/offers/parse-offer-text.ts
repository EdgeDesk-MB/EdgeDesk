/**
 * Parse Matched Betting Blog / promo email paste into offer form fields.
 * Deterministic - reuses ai-triggers for stake/place patterns.
 */
import {
  inferAiEffectsFromText,
  parsePlacePositions,
  textRequiresSpFavouriteWinner,
} from "@/lib/calc/ai-triggers";
import { matchBookmakerFromText } from "@/lib/bookmakers";
import { formatClockTime } from "@/lib/time-format";
import type { OfferCategoryId } from "@/lib/offers/offer-categories";
import { offerCategoryById } from "@/lib/offers/offer-categories";
import type { SportValue } from "@/lib/sports";
import type { OfferImportantTerms } from "@/lib/offers/offer-terms";
import { emptyImportantTerms, formatImportantTermsSummary } from "@/lib/offers/offer-terms";
import type { BetGetFreePlaceRules } from "@/lib/offers/racing-offer-rules";
import { formatBetGetFreePlaceSummary } from "@/lib/offers/racing-offer-rules";
import {
  analyzeOfferIntelligence,
  enrichImportantTerms,
  type OfferIntelligenceResult,
} from "@/lib/offers/offer-intelligence";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";

export type ParsedOfferCategory = OfferCategoryId;

export interface ParsedOfferDraft {
  category: ParsedOfferCategory;
  title: string;
  bookmaker: string | null;
  description: string | null;
  expectedProfit: number | null;
  expiresAt: number | null;
  /** YYYY-MM-DD for racing day */
  eventDate: string | null;
  scopeMode: "uk_ire" | "course" | "race";
  scopeCourse: string;
  /** HH:MM when paste mentions a specific race time (e.g. 3pm → 15:00) */
  preferredOffTime: string | null;
  scopeRegions: Array<"GB" | "IRE">;
  betStake: number | null;
  freeBetAmount: number | null;
  minRunners: number | null;
  qualifyingPlaces: number[];
  rules: BetGetFreePlaceRules | null;
  important: OfferImportantTerms;
  /** Matched-betting intelligence (archetype, EP, workflow) */
  intelligence: OfferIntelligenceResult | null;
  /** Human-readable parse notes for the preview UI */
  notes: string[];
  confidence: "high" | "medium" | "low";
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseMoney(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseMinRunners(text: string): number | null {
  const m =
    text.match(/\bmin(?:imum)?\s+(\d+)\s*runners?\b/i) ||
    text.match(/\b(\d+)\+?\s*runners?\b/i) ||
    text.match(/\bat\s+least\s+(\d+)\s*runners?\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 4 && n <= 40 ? n : null;
}

function parseFractionalOdds(raw: string): number | null {
  const m = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  if (b <= 0) return null;
  return 1 + a / b;
}

function parseOddsToken(raw: string): number | null {
  const frac = parseFractionalOdds(raw);
  if (frac != null) return Math.round(frac * 100) / 100;
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 1 ? n : null;
}

function parseMinOdds(text: string): number | null {
  if (
    /\bmin(?:imum)?\s+(?:odds|price)\s*(?:of\s*)?[:\s]*(?:evens|even\s+money)\b/i.test(text) ||
    (/\b(?:evens|even\s+money)\b/i.test(text) && /\bmin(?:imum)?\s+(?:odds|price)/i.test(text))
  ) {
    return 2;
  }
  // Fractional before decimal so "1/2" is not captured as "1"
  const oddsToken = String.raw`(\d+\s*\/\s*\d+|[0-9]+(?:\.[0-9]+)?)`;
  const patterns = [
    new RegExp(String.raw`\bmin(?:imum)?\s+(?:odds|price)\s*(?:of\s*)?[:\s]*${oddsToken}`, "i"),
    new RegExp(
      String.raw`\b(?:odds|price)\s*(?:of\s*)?(?:at\s+least|min(?:imum)?)\s*[:\s]*${oddsToken}`,
      "i"
    ),
    new RegExp(String.raw`\bmin(?:imum)?\s+${oddsToken}\s*(?:odds|price)\b`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const odds = parseOddsToken(m[1]);
    if (odds != null) return odds;
  }
  return null;
}

function parseMinMaxStake(text: string): { minStake: number | null; maxStake: number | null } {
  const minM =
    text.match(/\bmin(?:imum)?\s+stake\s*[:£]?\s*£?\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/\bstake\s+(?:at\s+least|min(?:imum)?)\s*[:£]?\s*£?\s*(\d+(?:\.\d{1,2})?)/i);
  const maxM =
    text.match(/\bmax(?:imum)?\s+stake\s*[:£]?\s*£?\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/\bstake\s+(?:up\s+to|max(?:imum)?)\s*[:£]?\s*£?\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(
      /\bmax(?:imum)?\s+stake\s+allowed\s+(?:for\s+(?:the\s+)?boost\s+)?(?:is\s+)?£?\s*(\d+(?:\.\d{1,2})?)/i
    );
  return {
    minStake: minM ? parseMoney(minM[1]) : null,
    maxStake: maxM ? parseMoney(maxM[1]) : null,
  };
}

function parseImportantNotes(text: string): string {
  const bits: string[] = [];
  if (/\bsnr\b|stake\s+not\s+returned/i.test(text)) bits.push("SNR (stake not returned)");
  if (/\bsr\b|stake\s+returned/i.test(text) && !/\bsnr\b/i.test(text)) bits.push("SR (stake returned)");
  const sels = text.match(/\bmin(?:imum)?\s+(\d+)\s+selections?\b/i);
  if (sels) bits.push(`Min ${sels[1]} selections`);
  if (/\bnew\s+customers?\s+only\b/i.test(text)) bits.push("New customers only");
  if (/\bone\s+per\s+customer\b/i.test(text)) bits.push("One per customer");
  if (/\bcash\s+out\s+(?:not\s+)?(?:eligible|allowed|void)/i.test(text)) {
    bits.push("Cash out restrictions");
  }
  if (/\bin[- ]play\s+(?:bets?\s+)?(?:not\s+)?(?:eligible|excluded)/i.test(text)) {
    bits.push("In-play restrictions");
  }
  if (/\bsingles?\s+or\s+multis?\b/i.test(text)) bits.push("Singles or Multis");
  const importantLine = text.match(
    /\b(?:important|note|must|don'?t\s+forget)\s*[:\-–]\s*(.+?)(?:\n|$)/i
  );
  if (importantLine) {
    const line = importantLine[1].trim().replace(/\s+/g, " ");
    if (line.length >= 8 && line.length <= 160) bits.push(line);
  }
  return bits.join(" · ");
}

function parseImportantTerms(text: string): OfferImportantTerms {
  const { minStake, maxStake } = parseMinMaxStake(text);
  return {
    minOdds: parseMinOdds(text),
    minStake,
    maxStake,
    importantNotes: normalizeOfferDetailsText(parseImportantNotes(text)),
  };
}

function parseRegions(text: string): Array<"GB" | "IRE"> {
  const hasGb =
    /\b(uk|gb|britain|england|scotland|wales)\b/i.test(text) ||
    /\buk\s*&\s*ireland\b/i.test(text) ||
    /\buk\s*and\s*ireland\b/i.test(text);
  const hasIre = /\b(ireland|ire|irish)\b/i.test(text);
  if (hasGb && hasIre) return ["GB", "IRE"];
  if (hasIre && !hasGb) return ["IRE"];
  if (hasGb) return ["GB", "IRE"];
  return ["GB", "IRE"];
}

/** Common UK/IRE courses - used to stop OCR from swallowing "today Opt-in here". */
const KNOWN_COURSES = [
  "Ascot",
  "Ayr",
  "Bath",
  "Beverley",
  "Brighton",
  "Carlisle",
  "Cartmel",
  "Catterick",
  "Cheltenham",
  "Chepstow",
  "Chester",
  "Doncaster",
  "Epsom",
  "Epsom Downs",
  "Exeter",
  "Fakenham",
  "Ffos Las",
  "Goodwood",
  "Hamilton",
  "Haydock",
  "Hereford",
  "Hexham",
  "Huntingdon",
  "Kelso",
  "Kempton",
  "Leicester",
  "Leopardstown",
  "Lingfield",
  "Ludlow",
  "Market Rasen",
  "Musselburgh",
  "Newbury",
  "Newcastle",
  "Newmarket",
  "Newton Abbot",
  "Nottingham",
  "Perth",
  "Plumpton",
  "Pontefract",
  "Redcar",
  "Ripon",
  "Salisbury",
  "Sandown",
  "Sedgefield",
  "Southwell",
  "Stratford",
  "Taunton",
  "Thirsk",
  "Uttoxeter",
  "Warwick",
  "Wetherby",
  "Wincanton",
  "Windsor",
  "Wolverhampton",
  "Worcester",
  "York",
  "Curragh",
  "Fairyhouse",
  "Galway",
  "Punchestown",
  "Tipperary",
  "Naas",
  "Navan",
  "Dundalk",
].sort((a, b) => b.length - a.length);

function findKnownCourses(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: { course: string; index: number }[] = [];
  for (const course of KNOWN_COURSES) {
    const re = new RegExp(`\\b${course.replace(/\s+/g, "\\s+")}\\b`, "i");
    const m = re.exec(lower);
    if (m) hits.push({ course, index: m.index });
  }
  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of hits) {
    const key = hit.course.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit.course);
  }
  return out;
}

function findKnownCourse(text: string): string | null {
  return findKnownCourses(text)[0] ?? null;
}

function parseScopeCourse(text: string): {
  mode: "uk_ire" | "course" | "race";
  course: string;
  preferredOffTime: string | null;
} {
  if (/\b(all\s+courses?|uk\s*&\s*ireland|uk\s*and\s*ireland|nationwide)\b/i.test(text)) {
    return { mode: "uk_ire", course: "", preferredOffTime: null };
  }

  const knownCourses = findKnownCourses(text);
  const known = knownCourses[0] ?? null;
  const offTime = parsePreferredOffTime(text);

  // Multi-course promo: "any Galway or Goodwood race"
  if (knownCourses.length > 1 && !offTime) {
    return {
      mode: "course",
      course: knownCourses.join(", "),
      preferredOffTime: null,
    };
  }

  // "3pm at Newmarket" / "in the 3pm at Newmarket today"
  if (known && offTime) {
    return { mode: "race", course: known, preferredOffTime: offTime };
  }

  const courseCue = new RegExp(
    String.raw`\b(?:at|only\s+at|course[:\s]+|in\s+the\s+\d|on\s+any)\b`,
    "i"
  );
  const regionalCue = new RegExp(
    String.raw`\b(all\s+courses?|uk\s*&\s*ireland|uk\s*and\s*ireland)\b`,
    "i"
  );
  const courseScoped = known != null && courseCue.test(text) && !regionalCue.test(text);
  if (known && courseScoped) {
    return { mode: "course", course: known, preferredOffTime: null };
  }

  const only = text.match(
    /\b(?:at|only\s+at|course[:\s]+)\s*([A-Za-z][A-Za-z'-]{2,24})(?:\s+(?:today|tomorrow|only)\b)?/i
  );
  if (only) {
    const course = only[1].trim();
    if (!/runners?|places?|free|bet|stake|opt|here|money|back|credit|^any$/i.test(course)) {
      return {
        mode: offTime ? "race" : "course",
        course,
        preferredOffTime: offTime,
      };
    }
  }
  return { mode: "uk_ire", course: "", preferredOffTime: null };
}

function formatOffTime(hours: number, minutes: number): string | null {
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function offTimeFromAmPm(hours: number, minutes: number, ap: string): string | null {
  let h = hours;
  const suffix = ap.toLowerCase();
  if (suffix === "pm" && h < 12) h += 12;
  if (suffix === "am" && h === 12) h = 0;
  return formatOffTime(h, minutes);
}

/** Pick the race off-time, not promo start times like "Applies from 10am 08th July". */
function parsePreferredOffTime(text: string): string | null {
  const known = findKnownCourse(text);
  const candidates: { time: string; score: number }[] = [];

  const push = (time: string | null, score: number) => {
    if (time) candidates.push({ time, score });
  };

  // "16:45 Newmarket" / "in the 16:45 Newmarket"
  if (known) {
    const courseRe = new RegExp(
      `\\b(\\d{1,2}):(\\d{2})\\s+${known.replace(/\s+/g, "\\s+")}\\b`,
      "gi"
    );
    for (const m of text.matchAll(courseRe)) {
      push(formatOffTime(parseInt(m[1], 10), parseInt(m[2], 10)), 100);
    }
  }

  // OCR headline line: "16:45 NEWMARKET"
  for (const line of text.split(/\r?\n/)) {
    const hm = line.trim().match(/^(\d{1,2}):(\d{2})\b/);
    if (hm) push(formatOffTime(parseInt(hm[1], 10), parseInt(hm[2], 10)), 92);
  }

  // "in the 16:45" (24h, no course suffix)
  for (const m of text.matchAll(/\bin\s+the\s+(\d{1,2}):(\d{2})\b/gi)) {
    push(formatOffTime(parseInt(m[1], 10), parseInt(m[2], 10)), 85);
  }

  // "3pm at Newmarket" / "in the 3.30pm at Newmarket"
  const atCourse =
    /\b(?:in\s+the\s+)?(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)\s+at\s+[A-Za-z]/gi;
  for (const m of text.matchAll(atCourse)) {
    push(
      offTimeFromAmPm(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0, m[3]),
      80
    );
  }
  // "3pm at Newmarket" without colon before am/pm
  const atCoursePlain =
    /\b(?:in\s+the\s+)?(\d{1,2})\s*(am|pm)\s+at\s+[A-Za-z]/gi;
  for (const m of text.matchAll(atCoursePlain)) {
    push(offTimeFromAmPm(parseInt(m[1], 10), 0, m[2]), 80);
  }

  const raceAt = text.match(/\b(?:off|race)\s*(?:at\s+)?(\d{1,2})[:.](\d{2})\b/i);
  if (raceAt) {
    push(formatOffTime(parseInt(raceAt[1], 10), parseInt(raceAt[2], 10)), 75);
  }

  // Bare am/pm — deprioritise promo-start phrases ("Applies from 10am …")
  for (const m of text.matchAll(
    /\b(?:in\s+the\s+)?(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)\b/gi
  )) {
    const before = text.slice(Math.max(0, m.index! - 36), m.index);
    const isPromoStart = /\b(?:applies|valid|available|runs?|starts?|from)\s*(?:from|:)?\s*$/i.test(
      before
    );
    push(
      offTimeFromAmPm(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0, m[3]),
      isPromoStart ? 8 : 55
    );
  }
  for (const m of text.matchAll(/\b(?:in\s+the\s+)?(\d{1,2})\s*(am|pm)\b/gi)) {
    const before = text.slice(Math.max(0, m.index! - 36), m.index);
    const isPromoStart = /\b(?:applies|valid|available|runs?|starts?|from)\s*(?:from|:)?\s*$/i.test(
      before
    );
    push(offTimeFromAmPm(parseInt(m[1], 10), 0, m[2]), isPromoStart ? 8 : 55);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].time;
}

/** Typical cash retained when converting an SNR free bet (~75%). */
export const FREE_BET_EV_RETENTION = 0.75;

function parseExpectedProfit(text: string): number | null {
  const m =
    text.match(/\bexpected\s+(?:profit|value|ev)\s*[:£]?\s*£?\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/\bprofit\s*[:£]\s*£?\s*(\d+(?:\.\d{1,2})?)/i);
  return m ? parseMoney(m[1]) : null;
}

function estimateFreeBetEv(freeBetAmount: number | null): number | null {
  if (freeBetAmount == null || freeBetAmount <= 0) return null;
  return Math.round(freeBetAmount * FREE_BET_EV_RETENTION * 100) / 100;
}

interface ParsedTod {
  hours: number;
  minutes: number;
}

/** Parse a UK-style clock: 09:00am, 19:00pm, 7pm, 19:00, 9.30am */
function parseClockToken(raw: string): ParsedTod | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m =
    t.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/) ||
    t.match(/^(\d{1,2})\s*(am|pm)$/);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] && !/am|pm/.test(m[2]) ? parseInt(m[2], 10) : 0;
  const ap = (m[3] ?? (m[2] && /am|pm/.test(m[2]) ? m[2] : "")).toLowerCase();
  // 19:00pm → keep 19 (already 24h); only apply am/pm when hour ≤ 12
  if (ap === "pm" && hours < 12) hours += 12;
  if (ap === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Currency amount prefix used by UK/ROI bookies: £5, €5, £/€5, €/£5.
 * Optional so "Bet 5 get 5" still matches.
 */
const MONEY_PREFIX = String.raw`(?:£\s*/\s*€|€\s*/\s*£|£|€)?\s*`;
const MONEY_AMOUNT = String.raw`(\d+(?:\.\d{1,2})?)`;

/** True when a bet-get match sits inside a T&C currency-conversion example. */
function isStakeExampleContext(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 120);
  const before = text.slice(windowStart, matchIndex);
  return /\b(?:for\s+example|e\.g\.|eg\.|advertised\s+as|such\s+as|this\s+will\s+be)\b/i.test(
    before
  );
}

/** Fix common OCR / paste glitches before parsing. */
function normalizeOfferOcrText(text: string): string {
  return text
    // Narrow NBSP / other exotic spaces from web pastes
    .replace(/[\u00a0\u202f\u2007\u2009\u200a\ufeff]/g, " ")
    .replace(/(\d{1,2})t(\s+of\s+)/gi, "$1th$2")
    .replace(/(\d{1,2})t(\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/gi, "$1th$2");
}

function parseTimeNear(text: string, dateIndex: number, dateLength: number): ParsedTod | null {
  const beforeStart = Math.max(0, dateIndex - 56);
  const before = text.slice(beforeStart, dateIndex);
  const beforeMatch = before.match(
    /(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\s*(?:on\s+(?:\w+\s+)*)?$/i
  );
  if (beforeMatch) {
    const tod = parseClockToken(beforeMatch[1]);
    if (tod) return tod;
  }
  const timeMatches = [
    ...before.matchAll(/\b(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/gi),
  ];
  if (timeMatches.length > 0) {
    const tod = parseClockToken(timeMatches[timeMatches.length - 1][1]);
    if (tod) return tod;
  }
  const after = text.slice(dateIndex + dateLength, dateIndex + dateLength + 24);
  const afterMatch = after.match(
    /^\s*(?:at\s+)?(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i
  );
  if (afterMatch) {
    const tod = parseClockToken(afterMatch[1]);
    if (tod) return tod;
  }
  return null;
}

interface UkDateParts {
  day: number;
  month: number; // 0-11
  year: number | null;
  index: number;
  length: number;
}

/** Find UK dates: DD/MM[/YYYY], DD.MM[.YYYY], DD-MM[-YYYY], 1st July [2026], Sunday 12th of July */
function findUkDates(text: string): UkDateParts[] {
  const out: UkDateParts[] = [];
  const seen = new Set<string>();

  function push(part: UkDateParts) {
    const key = `${part.day}-${part.month}-${part.year ?? "x"}-${part.index}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(part);
  }

  const numeric = /\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/g;
  let m: RegExpExecArray | null;
  while ((m = numeric.exec(text))) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year: number | null = m[3] ? parseInt(m[3], 10) : null;
    if (year != null && year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 0 || month > 11) continue;

    // Skip fractional odds mistaken as dates: "1/2 (1.5)", "odds of 5/2"
    if (year == null && m[0].includes("/")) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
      const before = text.slice(Math.max(0, m.index - 24), m.index);
      if (/\(\s*\d+(?:\.\d+)?\s*\)/.test(after) || /\bodds?\b/i.test(before)) {
        continue;
      }
      // Bare A/B with both ≤ 12 and no nearby time is ambiguous - require a time nearby
      // or a day > 12, unless it's clearly in a date/period context
      const near = text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20);
      const hasTime =
        /\d{1,2}[:.]\d{2}\s*(?:am|pm)?/i.test(near) ||
        /\b(?:expires?|until|from|period|valid|deadline|closes?)\b/i.test(near);
      if (!hasTime && day <= 12) {
        // Still allow if month-day looks like a calendar date with leading zero style "01/07"
        if (!/^0\d[\/.\-]/.test(m[0]) && !/[\/.\-]0\d$/.test(m[0])) {
          continue;
        }
      }
    }

    push({ day, month, year, index: m.index, length: m[0].length });
  }

  const weekdayOfMonth =
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})(?:st|nd|rd|th|t)?\s+of\s+([A-Za-z]+)(?:\s+(\d{4}))?\b/gi;
  while ((m = weekdayOfMonth.exec(text))) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon == null) continue;
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) continue;
    push({
      day,
      month: mon,
      year: m[3] ? parseInt(m[3], 10) : null,
      index: m.index,
      length: m[0].length,
    });
  }

  const dayOfMonth =
    /\b(\d{1,2})(?:st|nd|rd|th|t)?\s+of\s+([A-Za-z]+)(?:\s+(\d{4}))?\b/gi;
  while ((m = dayOfMonth.exec(text))) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon == null) continue;
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) continue;
    push({
      day,
      month: mon,
      year: m[3] ? parseInt(m[3], 10) : null,
      index: m.index,
      length: m[0].length,
    });
  }

  const named =
    /\b(\d{1,2})(?:st|nd|rd|th|t)?\s+(?!of\b)([A-Za-z]+)(?:\s+(\d{4}))?\b/gi;
  while ((m = named.exec(text))) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon == null) continue;
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) continue;
    push({
      day,
      month: mon,
      year: m[3] ? parseInt(m[3], 10) : null,
      index: m.index,
      length: m[0].length,
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function resolveYear(day: number, month: number, year: number | null, now: Date): number {
  if (year != null) return year;
  const y = now.getFullYear();
  const candidate = new Date(y, month, day, 23, 59, 59);
  // If date is > ~60 days in the past, assume next year (promo rolled over)
  if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) return y + 1;
  return y;
}

function toEpoch(
  day: number,
  month: number,
  year: number,
  tod: ParsedTod | null,
  endOfDayFallback: boolean
): number | null {
  const hours = tod?.hours ?? (endOfDayFallback ? 23 : 0);
  const minutes = tod?.minutes ?? (endOfDayFallback ? 59 : 0);
  const seconds = !tod && endOfDayFallback ? 59 : 0;
  const dt = new Date(year, month, day, hours, minutes, seconds);
  return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
}

/**
 * Expiry / end of qualifying window.
 * Handles: Expires…, valid until, until, ends, qualifying period … from A – B (uses B).
 */
function parseExpiry(text: string, now = new Date()): number | null {
  // Explicit "expires / valid until / until / ends / closing"
  const labelled = text.match(
    /\b(?:expires?(?:\s+(?:on|at))?|valid\s+(?:until|to|through|on)|(?:token|offer)\s+valid|available\s+until|until|ends?(?:\s+on)?|closing|deadline)\b/i
  );
  if (labelled && labelled.index != null) {
    const from = labelled.index;
    const slice = text.slice(from, from + 120);
    if (/\b(?:tonight|at\s+midnight|end\s+of\s+(?:the\s+)?day)\b/i.test(slice)) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    }
    const dates = findUkDates(slice);
    if (dates.length > 0) {
      const d =
        dates.length >= 2 && /\b(?:to|until|through)\b/i.test(slice)
          ? dates[dates.length - 1]
          : dates[0];
      const absIndex = from + d.index;
      const resolvedTod = parseTimeNear(text, absIndex, d.length);
      const year = resolveYear(d.day, d.month, d.year, now);
      return toEpoch(d.day, d.month, year, resolvedTod, true);
    }
    const iso = slice.match(/\b(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
    if (iso) {
      const [y, mo, d] = iso[1].split("-").map((x) => parseInt(x, 10));
      const hours = iso[2] != null ? parseInt(iso[2], 10) : 23;
      const minutes = iso[3] != null ? parseInt(iso[3], 10) : 59;
      return new Date(y, mo - 1, d, hours, minutes, iso[2] != null ? 0 : 59).getTime();
    }
  }

  // Qualifying / promo window: "from … – …" / "from … to …" → use end date
  const windowMatch = text.match(
    /\b(?:qualifying\s+period|promo(?:tion)?\s+period|offer\s+(?:runs|period)|runs?|available)\s*(?:from|:)?\s*/i
  );
  if (windowMatch && windowMatch.index != null) {
    const from = windowMatch.index + windowMatch[0].length;
    const slice = text.slice(from, from + 120);
    const dates = findUkDates(slice);
    if (dates.length >= 2) {
      const end = dates[dates.length - 1];
      const absIndex = from + end.index;
      const tod = parseTimeNear(text, absIndex, end.length);
      const year = resolveYear(end.day, end.month, end.year, now);
      return toEpoch(end.day, end.month, year, tod, true);
    }
    if (dates.length === 1) {
      // "until 11/07" style inside a runs-from clause with one date left
      const end = dates[0];
      const tod = parseTimeNear(text, from + end.index, end.length);
      const year = resolveYear(end.day, end.month, end.year, now);
      return toEpoch(end.day, end.month, year, tod, true);
    }
  }

  // Bare "from TIME DATE – TIME DATE" without a labelled verb
  const bareRange = text.match(
    /(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)\s+(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?)\s*(?:-|–|to)+\s*(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)\s+(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?)/i
  );
  if (bareRange) {
    const endTod = parseClockToken(bareRange[3]);
    const endDates = findUkDates(bareRange[4]);
    if (endDates.length > 0) {
      const d = endDates[0];
      const year = resolveYear(d.day, d.month, d.year, now);
      return toEpoch(d.day, d.month, year, endTod, true);
    }
  }

  // Fallback: any "DD/MM …" after expires-like words already handled; last UK date in text if "period" mentioned
  if (/\b(?:period|deadline|closes?|ends?)\b/i.test(text)) {
    const dates = findUkDates(text);
    if (dates.length > 0) {
      const end = dates[dates.length - 1];
      const tod = parseTimeNear(text, end.index, end.length);
      const year = resolveYear(end.day, end.month, end.year, now);
      return toEpoch(end.day, end.month, year, tod, true);
    }
  }

  return null;
}

function parseEventDate(text: string, now = new Date()): string | null {
  if (/\btoday\b/i.test(text)) return localYmd(now);
  if (/\btomorrow\b/i.test(text)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return localYmd(t);
  }
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const named = text.match(
    /\b(?:racing\s+day|event\s+date|on)\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?\b/i
  );
  if (named) {
    const day = parseInt(named[1], 10);
    const mon = MONTHS[named[2].toLowerCase()];
    if (mon != null) {
      const year = named[3] ? parseInt(named[3], 10) : now.getFullYear();
      return localYmd(new Date(year, mon, day));
    }
  }
  return null;
}

function looksLikeRacing(text: string, places: number[]): boolean {
  if (places.length > 0) return true;
  return (
    /\b(horse\s*racing|racecard|racecourse|runners?|place\s*refund|money\s+back|2nd.?4th|2nd\s*(?:&|and|or)\s*3rd|each.?way|tote\s+credit)\b/i.test(
      text
    ) || /\b(catterick|ascot|cheltenham|newmarket|york|doncaster|kempton)\b/i.test(text)
  );
}

function looksLikeCasino(text: string): boolean {
  return /\b(casino|slots?|roulette|blackjack|bingo|spin\s+the\s+wheel|deposit\s+match|free\s+spins?)\b/i.test(
    text
  );
}

function looksLikeFootball(text: string): boolean {
  return /\b(football|soccer|premier\s+league|epl|championship|world\s+cup|champions\s+league|acca|accumulator|correct\s+score|2\s*up|early\s+payout|goal\s*line)\b/i.test(
    text
  );
}

const SPORT_DETECTORS: { sport: SportValue; pattern: RegExp }[] = [
  { sport: "golf", pattern: /\bgolf\b/i },
  { sport: "tennis", pattern: /\btennis\b/i },
  { sport: "cricket", pattern: /\bcricket\b/i },
  { sport: "rugby_union", pattern: /\brugby\s+union\b/i },
  { sport: "rugby_league", pattern: /\brugby\s+league\b/i },
  { sport: "rugby_union", pattern: /\brugby\b/i },
  { sport: "darts", pattern: /\bdarts\b/i },
  { sport: "snooker", pattern: /\bsnooker\b/i },
  { sport: "basketball", pattern: /\b(nba|basketball)\b/i },
  { sport: "american_football", pattern: /\b(nfl|american\s+football)\b/i },
  { sport: "boxing", pattern: /\bboxing\b/i },
  { sport: "mma", pattern: /\b(ufc|mma)\b/i },
  { sport: "greyhounds", pattern: /\bgreyhound/i },
  { sport: "motorsport", pattern: /\b(motorsport|formula\s*1|f1|grand\s+prix)\b/i },
  { sport: "cycling", pattern: /\bcycling\b/i },
  { sport: "ice_hockey", pattern: /\bice\s+hockey\b/i },
  { sport: "volleyball", pattern: /\bvolleyball\b/i },
  { sport: "baseball", pattern: /\bbaseball\b/i },
  { sport: "esports", pattern: /\besports?\b/i },
];

function looksLikeSports(text: string): boolean {
  return /\b(sports?\s+book|any\s+sport)\b/i.test(text);
}

function detectSportCategory(text: string): SportValue | null {
  for (const { sport, pattern } of SPORT_DETECTORS) {
    if (pattern.test(text)) return sport;
  }
  return null;
}

function detectCategory(
  text: string,
  places: number[],
  racingHint: boolean
): OfferCategoryId {
  if (racingHint || looksLikeRacing(text, places)) return "horse_racing";
  if (looksLikeCasino(text)) return "casino";
  if (looksLikeFootball(text)) return "football";
  const sport = detectSportCategory(text);
  if (sport) return sport;
  if (looksLikeSports(text)) return "general";
  return "general";
}

function looksLikeRaceHeader(line: string): boolean {
  const t = line.trim();
  return (
    /^\d{1,2}:\d{2}\s+[A-Za-z]/i.test(t) ||
    /^\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+[A-Za-z]/i.test(t)
  );
}

function firstMeaningfulLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().replace(/^['"‘’“”]+|['"‘’“”]+$/g, "");
    if (t.length < 8) continue;
    if (/^(http|www\.|terms|t&cs|eligible|opt-in|exclusions|online only)/i.test(t)) continue;
    // Skip OCR fragments that are just a badge word or truncated junk
    if (/^(money\s+back|'?s\s+money\s+back)$/i.test(t)) continue;
    // "16:45 NEWMARKET" is scope metadata, not the offer headline
    if (looksLikeRaceHeader(t)) continue;
    return t.length > 100 ? `${t.slice(0, 97)}…` : t;
  }
  return text.trim().slice(0, 100) || "Pasted offer";
}

/** "Paying 4 Places instead of 3" extra-place headline */
function extractExtraPlaceTitle(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    const m = t.match(/\bpaying\s+(\d+)\s+places?\s+instead\s+of\s+(\d+)\b/i);
    if (m) {
      const headline = `Paying ${m[1]} places instead of ${m[2]}`;
      return t.length <= 60 ? t : headline;
    }
  }
  const inline = text.match(/\bpaying\s+(\d+)\s+places?\s+instead\s+of\s+(\d+)\b/i);
  if (inline) {
    return `Paying ${inline[1]} places instead of ${inline[2]}`;
  }
  return null;
}

/** Headline like "Money Back 2nd & 3rd" / "Money Back if 2nd or 3rd" */
function extractMoneyBackTitle(text: string): string | null {
  const m = text.match(
    /\bmoney\s+back\s+(\d+(?:st|nd|rd|th)?\s*(?:[&+/]|and|or)\s*\d+(?:st|nd|rd|th)?(?:\s*(?:[&+/]|and|or)\s*\d+(?:st|nd|rd|th)?)*)\b/i
  );
  if (!m) return null;
  const places = m[1]
    .replace(/\s+/g, " ")
    .replace(/\s*[&+/]\s*/g, " & ")
    .replace(/\s+and\s+/gi, " & ")
    .replace(/\s+or\s+/gi, " & ");
  return `Money Back ${places}`;
}

function extractBetGetStakes(text: string): {
  betStake: number | null;
  freeBetAmount: number | null;
} {
  // "Bet £5 get £5" / "Bet £/€5 Get a £/€5 Free Bet" — first non-example wins
  const betGetRe = new RegExp(
    String.raw`\bbet\s+${MONEY_PREFIX}${MONEY_AMOUNT}\+?\s+get\s+(?:a\s+)?${MONEY_PREFIX}${MONEY_AMOUNT}`,
    "gi"
  );
  for (const m of text.matchAll(betGetRe)) {
    if (m.index != null && isStakeExampleContext(text, m.index)) continue;
    const betStake = parseMoney(m[1]);
    const freeBetAmount = parseMoney(m[2]);
    if (betStake != null && freeBetAmount != null) {
      return { betStake, freeBetAmount };
    }
  }

  // Money-back / refund: "up to £10 back", "up to £/€10 in Tote Credit", "get … £10 … free bet"
  const moneyBack =
    text.match(
      new RegExp(
        String.raw`\bup\s+to\s+${MONEY_PREFIX}${MONEY_AMOUNT}\s*(?:back\b|in\s+\w+\s+credit\b|as\s+a\s+free\s*bet\b)?`,
        "i"
      )
    ) ||
    text.match(
      new RegExp(
        String.raw`\bget\s+(?:up\s+to\s+)?${MONEY_PREFIX}${MONEY_AMOUNT}\s+(?:back\b|in\s+\w+\s+credit\b)`,
        "i"
      )
    ) ||
    text.match(
      new RegExp(String.raw`\bsame\s+value\s+up\s+to\s+${MONEY_PREFIX}${MONEY_AMOUNT}`, "i")
    );
  if (moneyBack) {
    const amount = parseMoney(moneyBack[1]);
    // "same value up to £10" → stake and refund share the cap
    return { betStake: amount, freeBetAmount: amount };
  }

  // "Get a £/€5 Free Bet … place a £/€5+ bet" (headline without Bet X Get Y order)
  const getFree =
    text.match(
      new RegExp(
        String.raw`\bget\s+(?:a\s+)?${MONEY_PREFIX}${MONEY_AMOUNT}\s+free\s*bets?\b`,
        "i"
      )
    ) ||
    text.match(
      new RegExp(
        String.raw`\b(?:credited\s+with|receive)\s+(?:a\s+)?${MONEY_PREFIX}${MONEY_AMOUNT}\s+free\s*bets?\b`,
        "i"
      )
    );
  if (getFree) {
    const freeBetAmount = parseMoney(getFree[1]);
    const stakeOnly =
      text.match(
        new RegExp(
          String.raw`\bplace\s+a\s+${MONEY_PREFIX}${MONEY_AMOUNT}\+?\s*bets?\b`,
          "i"
        )
      ) ||
      text.match(
        new RegExp(
          String.raw`\b(?:qualifying\s+)?(?:bet|stake)\s+(?:of\s+)?${MONEY_PREFIX}${MONEY_AMOUNT}\+?`,
          "i"
        )
      );
    const betStake = stakeOnly ? parseMoney(stakeOnly[1]) : freeBetAmount;
    if (freeBetAmount != null) return { betStake, freeBetAmount };
  }

  // "Free Bet value is £10" / "free bet of £10" / "£10 free bet"
  const freeValue =
    text.match(
      new RegExp(
        String.raw`\bfree\s*bets?\s*(?:value|amount|worth)?\s*(?:is|of|=|:)?\s*${MONEY_PREFIX}${MONEY_AMOUNT}`,
        "i"
      )
    ) ||
    text.match(
      new RegExp(String.raw`\b${MONEY_PREFIX}${MONEY_AMOUNT}\s*(?:free\s*bets?|fb|back)\b`, "i")
    ) ||
    text.match(/\b(\d+(?:\.\d{1,2})?)\s*(?:free\s*bets?|fb)\b/i);
  if (freeValue) {
    const freeBetAmount = parseMoney(freeValue[1]);
    const stakeOnly = text.match(
      new RegExp(
        String.raw`\b(?:qualifying\s+)?(?:bet|stake)\s+(?:of\s+)?${MONEY_PREFIX}${MONEY_AMOUNT}\+?`,
        "i"
      )
    );
    return {
      betStake: stakeOnly ? parseMoney(stakeOnly[1]) : null,
      freeBetAmount,
    };
  }

  const effects = inferAiEffectsFromText(text);
  const award = effects.find((e) => e.kind === "free_bet_award");
  if (award) {
    const stakeOnly = text.match(
      new RegExp(String.raw`\bbet\s+${MONEY_PREFIX}${MONEY_AMOUNT}\+?`, "i")
    );
    return {
      betStake: stakeOnly ? parseMoney(stakeOnly[1]) : award.amount,
      freeBetAmount: award.amount,
    };
  }
  return { betStake: null, freeBetAmount: null };
}

function formatPlaceLabel(places: number[]): string {
  if (places.length === 3 && places[0] === 2 && places[2] === 4) return "2nd–4th";
  if (places.length === 2 && places[0] === 2 && places[1] === 3) return "2nd & 3rd";
  const ordinal = (n: number) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };
  return places.map(ordinal).join(", ");
}

function buildOfferTitle(
  text: string,
  category: OfferCategoryId,
  freeBetAmount: number | null,
  betStake: number | null,
  places: number[]
): string {
  const extraPlaceTitle = extractExtraPlaceTitle(text);
  if (extraPlaceTitle) return extraPlaceTitle;

  const moneyBackTitle = extractMoneyBackTitle(text);
  if (moneyBackTitle) return moneyBackTitle;

  if (offerCategoryById(category).isRacing && betStake != null && freeBetAmount != null) {
    if (places.length > 0) {
      return `Bet £${betStake} get £${freeBetAmount} free bet (${formatPlaceLabel(places)})`;
    }
    return `Bet £${betStake} get £${freeBetAmount} free bet`;
  }
  if (freeBetAmount != null) {
    if (/\bcricket\b/i.test(text)) return `£${freeBetAmount} free bet - Cricket`;
    if (category === "football") return `£${freeBetAmount} free bet - Football`;
    if (category === "casino") return `£${freeBetAmount} casino reward`;
    const sportLabel = offerCategoryById(category).label;
    if (sportLabel !== "General") return `£${freeBetAmount} free bet - ${sportLabel}`;
    return `£${freeBetAmount} free bet`;
  }
  return firstMeaningfulLine(text);
}

/** Extract place positions from money-back / finish wording. */
function extractQualifyingPlaces(text: string, awardPositions: number[]): number[] {
  if (awardPositions.length > 0 && awardPositions.every((n) => n <= 6)) {
    return [...awardPositions];
  }

  // "2nd-4th" / "2–4"
  const range = text.match(/\b(\d+)(?:st|nd|rd|th)?\s*[-–]\s*(\d+)(?:st|nd|rd|th)?\b/i);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (a >= 1 && b <= 10 && Math.abs(b - a) <= 6) {
      const places: number[] = [];
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) places.push(i);
      return places;
    }
  }

  // "2nd & 3rd" / "2nd or 3rd" / "2nd, 3rd or 4th" (with optional & / and)
  const list = text.match(
    /\b(\d+(?:st|nd|rd|th)?(?:\s*(?:[&+,/]|and|or)\s*\d+(?:st|nd|rd|th)?){1,5})\b/i
  );
  if (list) {
    const places = parsePlacePositions(list[1]).filter((n) => n >= 1 && n <= 10);
    // Prefer place-finish lists (start at 2nd) over random numbers
    if (places.length >= 2 && places[0] >= 2 && places.every((n) => n <= 6)) {
      return places;
    }
  }

  // "if … 2nd or 3rd" — handles "if your horse finishes", "if you finish", "if selection finishes"
  const ifClause = text.match(
    /\bif\s+(?:(?:you|your(?:\s+\w+)?)\s+)?(?:horse\s+)?(?:finishes?|finish|comes?\s*(?:in)?|places?)?\s*((?:\d+(?:st|nd|rd|th)?[\s,&+/]*(?:(?:and|or)\s+)?){1,6})/i
  );
  if (ifClause) {
    const places = parsePlacePositions(ifClause[1]).filter((n) => n <= 10);
    if (places.length > 0) return places;
  }

  // "finish 2nd" / "finishes 2nd or 3rd" — catches "if you finish 2nd" and standalone usages
  const finishNth = text.match(
    /\bfinish(?:es|ed)?\s+((?:\d+(?:st|nd|rd|th)?(?:\s*(?:[,&+/]|and|or)\s*)?){1,6})/i
  );
  if (finishNth) {
    const places = parsePlacePositions(finishNth[1]).filter((n) => n >= 1 && n <= 10);
    if (places.length > 0) return places;
  }

  if (/\b2nd.?4th|2nd,\s*3rd,?\s*(?:or\s+)?4th\b/i.test(text)) {
    return [2, 3, 4];
  }
  if (/\b2nd\s*(?:&|and|or)\s*3rd\b/i.test(text)) {
    return [2, 3];
  }

  return [];
}

/** Parse pasted promo / MBB text into an offer draft for the Offers form. */
export function parseOfferFromText(raw: string, now = new Date()): ParsedOfferDraft {
  const text = normalizeOfferOcrText(raw).trim();
  const notes: string[] = [];

  if (!text) {
    return emptyDraft("Paste was empty");
  }

  const bookmaker = matchBookmakerFromText(text);
  if (bookmaker) notes.push(`Bookie: ${bookmaker}`);

  const effects = inferAiEffectsFromText(text);
  const award = effects.find((e) => e.kind === "free_bet_award");
  const winnerMustBeSpFavourite =
    award?.winnerMustBeSpFavourite === true || textRequiresSpFavouriteWinner(text);
  const places = extractQualifyingPlaces(
    text,
    award && award.positions.length > 0 ? award.positions : []
  );

  const { betStake, freeBetAmount } = extractBetGetStakes(text);
  const racingHint = looksLikeRacing(text, places) || (betStake != null && places.length > 0);
  const category = detectCategory(text, places, racingHint);
  const isRacing = offerCategoryById(category).isRacing;
  const minRunners = parseMinRunners(text) ?? (isRacing ? 8 : null);
  const regions = parseRegions(text);
  const scope = parseScopeCourse(text);
  const statedProfit = parseExpectedProfit(text);
  const expiresAt = parseExpiry(text, now);
  const eventDate = parseEventDate(text, now);
  const important = parseImportantTerms(text);

  // Opt-in / cash bet / valid N days → important notes
  if (/\bopt[- ]?in\s+required\b/i.test(text) && !/opt-in/i.test(important.importantNotes)) {
    important.importantNotes = [important.importantNotes, "Opt-in required"]
      .filter(Boolean)
      .join(" · ");
  }
  if (/\bcash\s+bet\s+only\b/i.test(text) && !/cash bet/i.test(important.importantNotes)) {
    important.importantNotes = [important.importantNotes, "Cash bet only"]
      .filter(Boolean)
      .join(" · ");
  }
  // "7-day expiry" / "Valid 7 days" for free bet / credit
  const validDays =
    text.match(/\bvalid\s+(\d+)\s+days?\b/i) ||
    text.match(/\b(\d+)[- ]day\s+expir(?:y|es|ation)\b/i);
  if (validDays && !/valid \d+ days/i.test(important.importantNotes)) {
    important.importantNotes = [
      important.importantNotes,
      `Free bet valid ${validDays[1]} days`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (
    /\bwin\s+or\s+ew\b|\bcash\s+win\s+or\s+ew\b/i.test(text) &&
    !/win or EW/i.test(important.importantNotes)
  ) {
    important.importantNotes = [important.importantNotes, "Cash win or EW"]
      .filter(Boolean)
      .join(" · ");
  }

  const intelligence = analyzeOfferIntelligence({
    text,
    bookmaker,
    category,
    betStake,
    freeBetAmount,
    important,
    qualifyingPlaces: places,
    expiresAt,
    isRacing,
  });

  const enrichedImportant = enrichImportantTerms(important, intelligence);

  const intelEv =
    statedProfit == null ? intelligence.expectedProfit : null;
  const legacyEv = statedProfit == null ? estimateFreeBetEv(freeBetAmount) : null;
  const estimatedEv = intelEv ?? legacyEv;
  const expectedProfit = statedProfit ?? estimatedEv;

  if (betStake != null && freeBetAmount != null) {
    notes.push(`Bet £${betStake} → £${freeBetAmount} free bet`);
  } else if (freeBetAmount != null) {
    notes.push(`Free bet £${freeBetAmount}`);
  }
  if (places.length > 0) {
    notes.push(
      winnerMustBeSpFavourite
        ? `Places: ${places.join(", ")} to SP favourite`
        : `Places: ${places.join(", ")}`
    );
  }
  if (minRunners != null && isRacing) notes.push(`Min ${minRunners} runners`);
  if (statedProfit != null) notes.push(`Expected profit £${statedProfit}`);
  else if (intelligence.epExplanation) notes.push(intelligence.epExplanation);
  else if (estimatedEv != null && freeBetAmount != null) {
    notes.push(
      `Est. EV ~£${estimatedEv} (${Math.round(FREE_BET_EV_RETENTION * 100)}% of £${freeBetAmount} free bet)`
    );
  }

  if (intelligence.archetype !== "unknown") {
    notes.push(`Offer type: ${intelligence.archetypeLabel}`);
  }
  for (const step of intelligence.instructions.slice(0, 3)) {
    notes.push(`→ ${step}`);
  }
  if (expiresAt != null) {
    const d = new Date(expiresAt);
    notes.push(
      `Expires ${d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}, ${formatClockTime(d)}`
    );
  }
  const importantSummary = formatImportantTermsSummary(enrichedImportant);
  if (importantSummary) notes.push(`Important: ${importantSummary}`);

  let confidence: ParsedOfferDraft["confidence"] = "low";
  if (betStake != null && freeBetAmount != null && bookmaker) confidence = "high";
  else if (betStake != null && freeBetAmount != null) confidence = "medium";
  else if (freeBetAmount != null && expiresAt != null) confidence = "medium";
  else if (award || freeBetAmount != null) confidence = "medium";
  else if (intelligence.confidence === "high") confidence = "medium";
  else if (intelligence.confidence === "medium" && bookmaker) confidence = "medium";

  const title = buildOfferTitle(text, category, freeBetAmount, betStake, places);

  let rules: BetGetFreePlaceRules | null = null;
  // Racing bet&get stores structured rules even when unconditional. Empty
  // qualifyingPlaces means straight reward (no Best plays / place targeting).
  // Never invent 2nd–4th for "bet £5 get £5".
  if (isRacing && betStake != null && freeBetAmount != null) {
    rules = {
      type: "bet_get_free_place",
      minRunners: minRunners ?? 8,
      regions,
      qualifyingPlaces:
        places.length > 0 ? places : winnerMustBeSpFavourite ? [2] : [],
      betStake,
      freeBetAmount,
      ...(winnerMustBeSpFavourite ? { winnerMustBeSpFavourite: true } : {}),
    };
    notes.push(formatBetGetFreePlaceSummary(rules));
  } else if (isRacing && freeBetAmount != null && places.length > 0) {
    // Money-back style: refund capped at freeBetAmount for places
    rules = {
      type: "bet_get_free_place",
      minRunners: minRunners ?? 8,
      regions,
      qualifyingPlaces: places,
      betStake: betStake ?? freeBetAmount,
      freeBetAmount,
      ...(winnerMustBeSpFavourite ? { winnerMustBeSpFavourite: true } : {}),
    };
    notes.push(formatBetGetFreePlaceSummary(rules));
  }

  notes.unshift(`Detected as ${offerCategoryById(category).label.toLowerCase()} offer`);

  return {
    category,
    title,
    bookmaker,
    description: text.length > 280 ? `${text.slice(0, 277)}…` : text,
    expectedProfit,
    expiresAt,
    eventDate: eventDate ?? (isRacing ? localYmd(now) : null),
    scopeMode: scope.mode,
    scopeCourse: scope.course,
    preferredOffTime: scope.preferredOffTime,
    scopeRegions: regions,
    betStake,
    freeBetAmount,
    minRunners: minRunners ?? (isRacing ? 8 : null),
    qualifyingPlaces: places,
    rules,
    important: enrichedImportant,
    intelligence,
    notes,
    confidence,
  };
}

function emptyDraft(note: string): ParsedOfferDraft {
  return {
    category: "general",
    title: "",
    bookmaker: null,
    description: null,
    expectedProfit: null,
    expiresAt: null,
    eventDate: null,
    scopeMode: "uk_ire",
    scopeCourse: "",
    preferredOffTime: null,
    scopeRegions: ["GB", "IRE"],
    betStake: null,
    freeBetAmount: null,
    minRunners: null,
    qualifyingPlaces: [],
    rules: null,
    important: emptyImportantTerms(),
    intelligence: null,
    notes: [note],
    confidence: "low",
  };
}
