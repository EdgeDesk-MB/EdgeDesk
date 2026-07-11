/**
 * Heuristic parsing of OCR text from bookie / exchange bet slips.
 * Label-first: Stake, Odds, Matched Stake/Odds, Returns (ignored for odds).
 */
import { parseRacingCourseFromEventName } from "@/lib/events";
import type { BetOcrFields, ScreenshotSource } from "./types";

const EXCHANGES = ["Betdaq", "Smarkets", "Matchbook", "Betfair Exchange", "Betfair"];

const BOOKMAKERS = [
  "Betfair Sportsbook",
  "Betfair",
  "Bet365",
  "William Hill",
  "Ladbrokes",
  "Coral",
  "Paddy Power",
  "Sky Bet",
  "888sport",
  "BetVictor",
  "Unibet",
  "Betway",
  "Betfred",
  "Spreadex",
  "Betdaq",
  "Smarkets",
  "Matchbook",
];

const UK_COURSES = [
  "Wolverhampton",
  "Ascot",
  "Cheltenham",
  "Aintree",
  "Newmarket",
  "York",
  "Goodwood",
  "Epsom",
  "Doncaster",
  "Kempton",
  "Sandown",
  "Haydock",
  "Lingfield",
  "Newbury",
  "Windsor",
  "Brighton",
  "Chester",
  "Ripon",
  "Bath",
  "Pontefract",
  "Redcar",
  "Catterick",
  "Ffos Las",
  "Hexham",
  "Kelso",
  "Perth",
  "Ayr",
  "Hamilton",
  "Musselburgh",
  "Downpatrick",
  "Curragh",
  "Leopardstown",
];

const SKIP_LINE =
  /^(stake|odds|returns|total|status|reference|bet result|expiry|includes|re-use|singles|betslip|bet placed|bet details|detailed)/i;

/** Normalise OCR quirks - keep newlines for label-on-next-line patterns. */
function normaliseRaw(raw: string): string {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function linesOf(text: string): string[] {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

/** Betfair-style row: Odds | Stake | Returns (horizontal or vertical in OCR). */
function parseTripletMetrics(text: string): {
  odds?: number;
  stake?: number;
  returns?: number;
} {
  const lines = linesOf(text);

  // One header line then values: "Odds Stake Returns" → "1 £50.00 £500.00"
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!/odds/i.test(line) || !/stake/i.test(line) || !/returns/i.test(line)) continue;
    if (/total/i.test(line)) continue;
    const parsed = parseTripletValueLine(lines[i + 1]);
    if (parsed) return parsed;
  }

  // Vertical stack: Odds / Stake / Returns / value / value / value
  for (let i = 0; i < lines.length - 5; i++) {
    if (!/^odds:?\.?$/i.test(lines[i])) continue;
    if (!/^stake:?\.?$/i.test(lines[i + 1])) continue;
    if (!/^returns:?\.?$/i.test(lines[i + 2])) continue;
    const parsed = parseTripletValues(lines[i + 3], lines[i + 4], lines[i + 5]);
    if (parsed) return parsed;
  }

  return {};
}

function parseTripletValueLine(line: string): ReturnType<typeof parseTripletValues> {
  const inline = line.match(
    /^(\d+(?:\.\d+)?|£[\d,.]+)\s+(£[\d,.]+|\d+(?:\.\d+)?)\s+(£[\d,.]+|\d+(?:\.\d+)?)/
  );
  if (!inline) return undefined;
  return parseTripletValues(inline[1], inline[2], inline[3]);
}

function parseTripletValues(
  oddsRaw: string,
  stakeRaw: string,
  returnsRaw: string
): { odds?: number; stake?: number; returns?: number } | undefined {
  const stake = parseMoneyValue(stakeRaw);
  const returns = parseMoneyValue(returnsRaw);
  let odds = parseOddsValue(oddsRaw.replace(/^£/, ""));

  if (stake == null && returns == null && odds == null) return undefined;

  return { odds, stake, returns };
}

/** When OCR drops a digit (11→1), derive odds from stake + returns. */
function inferOddsFromReturns(
  stake: number,
  returns: number,
  isFreeBet: boolean
): number | undefined {
  if (stake <= 0 || returns <= 0) return undefined;
  const ratio = returns / stake;
  const candidates = isFreeBet ? [ratio + 1, ratio] : [ratio, ratio + 1];
  for (const n of candidates) {
    if (n >= 1.01 && n <= 1000) return Math.round(n * 100) / 100;
  }
  return undefined;
}

function reconcileOdds(
  rawOdds: number | undefined,
  stake: number | undefined,
  returns: number | undefined,
  isFreeBet: boolean
): number | undefined {
  const inferred =
    stake != null && returns != null ? inferOddsFromReturns(stake, returns, isFreeBet) : undefined;

  if (rawOdds != null && rawOdds >= 1.01) {
    if (inferred != null && Math.abs(rawOdds - inferred) / inferred > 0.15) {
      return inferred;
    }
    return rawOdds;
  }

  return inferred;
}

function parseMoneyValue(raw: string): number | undefined {
  const m = raw.replace(/,/g, "").match(/£?\s*([\d]+(?:\.\d{1,2})?)/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseOddsValue(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/,/g, "");
  if (/£/.test(cleaned)) return undefined;
  const m = cleaned.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n < 1.01 || n > 1000) return undefined;
  return n;
}

/**
 * Find a value after a label - same line ("Odds 11") or next non-empty line ("Odds\n11").
 */
function valueAfterLabel(
  text: string,
  labelRe: RegExp,
  parse: (s: string) => number | undefined
): number | undefined {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inline = line.match(labelRe);
    if (inline) {
      const tail = inline[1]?.trim();
      if (tail) {
        const v = parse(tail);
        if (v != null) return v;
      }
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (SKIP_LINE.test(lines[j])) break;
        const v = parse(lines[j]);
        if (v != null) return v;
      }
    }
  }

  const block = text.match(labelRe);
  if (block?.[1]?.trim()) {
    const v = parse(block[1].trim());
    if (v != null) return v;
  }
  return undefined;
}

function parseLabelledOdds(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(`(?:^|[\\n\\s])${label}\\s*:?\\s*(.+)?$`, "im");
    const v = valueAfterLabel(text, re, parseOddsValue);
    if (v != null) return v;
  }
  return undefined;
}

function parseLabelledMoney(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(`(?:^|[\\n\\s])${label}\\s*:?\\s*(.+)?$`, "im");
    const v = valueAfterLabel(text, re, parseMoneyValue);
    if (v != null) return v;
  }
  return undefined;
}

/** Fallback odds - never pick returns/payout/stake amounts. */
function parseOddsFallback(text: string): number | undefined {
  const blocked = new Set<number>();
  for (const label of [
    "returns",
    "total returns",
    "potential returns",
    "winnings",
    "payout",
    "stake",
    "total stake",
  ]) {
    const re = new RegExp(`(?:^|[\\n\\s])${label}\\s*:?\\s*(.+)?$`, "im");
    const v = valueAfterLabel(text, re, parseMoneyValue);
    if (v != null) blocked.add(v);
  }

  const triplet = parseTripletMetrics(text);
  if (triplet.stake != null) blocked.add(triplet.stake);
  if (triplet.returns != null) blocked.add(triplet.returns);

  const at = text.match(/@\s*(\d+(?:\.\d{1,2})?)/);
  if (at) {
    const n = parseFloat(at[1]);
    if (n >= 1.01 && n <= 100 && !blocked.has(n)) return n;
  }

  const candidates: number[] = [];
  for (const m of text.matchAll(/\b(\d+(?:\.\d{1,2})?)\b/g)) {
    const n = parseFloat(m[1]);
    if (n >= 1.01 && n <= 100 && !blocked.has(n)) candidates.push(n);
  }
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => a - b)[0];
}

function parseTime(text: string): string | undefined {
  const patterns = [
    /win\s*[-–]\s*(\d{1,2}:\d{2})/i,
    /(\d{1,2}:\d{2})\s+[A-Za-z]/,
    /\b(\d{1,2}:\d{2})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const [h, min] = m[1].split(":").map(Number);
    if (h > 23 || min > 59) continue;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return undefined;
}

function parseDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!dmy) return undefined;
  let y = parseInt(dmy[3], 10);
  if (y < 100) y += 2000;
  const a = parseInt(dmy[1], 10);
  const b = parseInt(dmy[2], 10);
  const day = a > 12 ? String(a).padStart(2, "0") : String(b).padStart(2, "0");
  const month = a > 12 ? String(b).padStart(2, "0") : String(a).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

function parseVenue(text: string): string | undefined {
  const winLine = text.match(/win\s*[-–]\s*\d{1,2}:\d{2}\s+([A-Za-z][A-Za-z ()'-]+)/i);
  if (winLine) return winLine[1].trim();

  const timeVenue = text.match(
    /\b(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z ()'-]+?)(?:\s*[-–]\s*win|\s+win\s+market)/i
  );
  if (timeVenue) return timeVenue[2].trim();

  for (const course of UK_COURSES) {
    if (text.toLowerCase().includes(course.toLowerCase())) return course;
  }
  return undefined;
}

function parseBookmaker(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const name of BOOKMAKERS) {
    if (name === "Betfair" || name === "Betfair Exchange") continue;
    if (lower.includes(name.toLowerCase())) return name;
  }
  if (/\bbetfair\s+sportsbook\b/i.test(text)) return "Betfair Sportsbook";
  if (/\bbetslip\b/i.test(text) && /\bbetfair\b/i.test(text)) return "Betfair Sportsbook";
  return undefined;
}

function parseExchangeName(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const name of EXCHANGES) {
    if (lower.includes(name.toLowerCase())) {
      return name === "Betfair" ? "Betfair Exchange" : name;
    }
  }
  if (/\b(?:lay|back)\s+\d+\s+/i.test(text) && /\bmatched\s+(?:odds|stake)\b/i.test(text)) {
    return "Betdaq";
  }
  return undefined;
}

function parseMarketHint(text: string): string | undefined {
  if (/\bwin\s*[-–]\s*\d{1,2}:\d{2}/i.test(text)) return "win";
  if (/\bwin\s+market\b/i.test(text)) return "win";
  if (/\bplace\s+market\b/i.test(text)) return "place";
  return undefined;
}

function parseFreeBet(text: string): boolean {
  return /\bfree\s+bet/i.test(text) || /\bincludes\s+£[\d.]+\s+in\s+free\s+bets/i.test(text);
}

function parseSelection(text: string): string | undefined {
  const patterns = [
    /(?:^|\n)(?:lay|back)\s+\d+\s+([A-Za-z][A-Za-z0-9'.\- ]{2,40})/im,
    /(?:^|\n)\d+\s+([A-Za-z][A-Za-z0-9'.\- ]{2,40})(?:\s*\n|$)/m,
    /(?:selection|runner|horse)\s*:?\s*([A-Za-z][A-Za-z0-9'.\- ]{2,40})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const sel = m[1].trim().replace(/\s+(?:win|@|odds|stake|£).*$/i, "");
      if (sel.length >= 2 && !/^(win|place|each way|singles)$/i.test(sel)) return sel;
    }
  }
  return undefined;
}

function parseFootballTeams(text: string): { home?: string; away?: string } {
  const vs = text.match(/([A-Za-z][A-Za-z\s.'-]{2,30})\s+v(?:s\.?)?\s+([A-Za-z][A-Za-z\s.'-]{2,30})/i);
  if (vs) return { home: vs[1].trim(), away: vs[2].trim() };
  return {};
}

function buildEventFields(text: string): Pick<BetOcrFields, "eventName" | "eventDate" | "eventTime" | "homeTeam" | "awayTeam"> {
  const venue = parseVenue(text);
  const time = parseTime(text);
  const date = parseDate(text);
  const teams = parseFootballTeams(text);

  let eventName: string | undefined;
  if (venue && time) eventName = `${venue} · ${time}`;
  else if (venue) eventName = venue;
  else if (teams.home && teams.away) eventName = `${teams.home} v ${teams.away}`;

  return {
    eventName,
    eventDate: date,
    eventTime: time,
    homeTeam: teams.home ?? (venue ? parseRacingCourseFromEventName(venue) : undefined),
    awayTeam: teams.away,
  };
}

export function parseBookieScreenshot(raw: string): BetOcrFields {
  const text = normaliseRaw(raw);
  const isFreeBet = parseFreeBet(text);
  const triplet = parseTripletMetrics(text);

  const backStake =
    triplet.stake ??
    parseLabelledMoney(text, ["total stake", "stake"]) ??
    parseLabelledMoney(text, ["bet"]);

  const labelledOdds = parseLabelledOdds(text, ["odds", "price", "decimal odds"]);
  const backOdds = reconcileOdds(
    labelledOdds ?? triplet.odds ?? parseOddsFallback(text),
    backStake,
    triplet.returns ??
      parseLabelledMoney(text, ["total returns", "returns", "potential returns"]),
    isFreeBet
  );

  return {
    selection: parseSelection(text),
    backStake,
    backOdds,
    bookmaker: parseBookmaker(text),
    marketHint: parseMarketHint(text),
    isFreeBet,
    ...buildEventFields(text),
  };
}

export function parseExchangeScreenshot(raw: string): BetOcrFields {
  const text = normaliseRaw(raw);

  const layOdds =
    parseLabelledOdds(text, ["matched odds", "requested odds", "odds"]) ??
    parseOddsFallback(text);

  const layStake =
    parseLabelledMoney(text, ["matched stake", "lay stake"]) ??
    parseLabelledMoney(text, ["stake"]);

  const liability = parseLabelledMoney(text, ["liability"]);

  return {
    selection: parseSelection(text),
    layOdds,
    layStake,
    liability,
    exchangeName: parseExchangeName(text),
    marketHint: parseMarketHint(text),
    ...buildEventFields(text),
  };
}

export function parseBetScreenshot(raw: string, source: ScreenshotSource): BetOcrFields {
  return source === "bookie" ? parseBookieScreenshot(raw) : parseExchangeScreenshot(raw);
}

/** Human-readable list of fields found (for toast). */
export function summariseOcrFields(fields: BetOcrFields): string[] {
  const parts: string[] = [];
  if (fields.selection) parts.push(fields.selection);
  if (fields.backStake != null) parts.push(`stake £${fields.backStake}`);
  if (fields.backOdds != null) parts.push(`odds ${fields.backOdds}`);
  if (fields.layStake != null) parts.push(`lay £${fields.layStake}`);
  if (fields.layOdds != null) parts.push(`lay odds ${fields.layOdds}`);
  if (fields.eventName) parts.push(fields.eventName);
  if (fields.eventTime) parts.push(fields.eventTime);
  if (fields.marketHint) parts.push(fields.marketHint);
  if (fields.isFreeBet) parts.push("free bet");
  return parts;
}
