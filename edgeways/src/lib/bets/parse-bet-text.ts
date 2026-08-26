/**
 * Parse pasted bookie bet-confirmation text into prefill fields for Add Bet.
 * Architecture mirrors parse-offer-text.ts: small composable extractors, no side effects.
 * Returns null when nothing meaningful can be extracted (garbage input).
 */
import { matchBookmakerFromText } from "@/lib/bookmakers";
import { fractionalToDecimal } from "@/lib/calc/odds";
import {
  extractBetStructure,
  extractEachWayFlag,
  extractSlipLegs,
  extractUnitStake,
} from "@/lib/bets/parse-bet-structure";
import type { OcrBetStructure, SlipLeg } from "@/lib/ocr/types";

export interface ParsedField<T> {
  value: T;
  /** false = low-confidence match; dialog should highlight for review */
  confident: boolean;
}

export interface ParsedBet {
  bookmaker: ParsedField<string> | null;
  backStake: ParsedField<number> | null;
  backOdds: ParsedField<number> | null;
  selection: ParsedField<string> | null;
  /** "free_snr" | "free_sr" | "qualifying" */
  betType: ParsedField<"qualifying" | "free_snr" | "free_sr"> | null;
  marketHint: ParsedField<string> | null;
  isFreeBet: boolean;
  structure: ParsedField<OcrBetStructure> | null;
  unitStake: ParsedField<number> | null;
  eachWay: boolean;
  legs: SlipLeg[];
}

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

function parseMoney(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Decimal or fractional ("5/2", "Evens/EVENS", "10-1", "5-2") → decimal. */
export function parseOddsToken(raw: string): number | null {
  const t = raw.trim();
  if (/^evens?$/i.test(t)) return 2;
  // fractional with / or -
  const frac = t.match(/^(\d+(?:\.\d+)?)\s*[/\-]\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const result = fractionalToDecimal(`${frac[1]}/${frac[2]}`);
    if (result != null && result > 1) return Math.round(result * 100) / 100;
  }
  // decimal
  const n = parseFloat(t.replace(/,/g, ""));
  return Number.isFinite(n) && n > 1 ? n : null;
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractStake(text: string): ParsedField<number> | null {
  // Labelled (high confidence): "Stake: £10.00", "Total Stake £5", "Your Stake: £20"
  const labelled =
    text.match(/\b(?:total\s+)?stake\s*[:\s]\s*£\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/\byour\s+stake\s*[:\s]\s*£\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/\bbetting\s+£\s*(\d+(?:\.\d{1,2})?)/i);
  if (labelled) {
    const v = parseMoney(labelled[1]);
    if (v) return { value: v, confident: true };
  }

  // EW total → halve: "Total Stake: £10.00 (Each Way — £5.00 each side)"
  const ewTotal = text.match(/\beach[\s-]?way.*?£\s*(\d+(?:\.\d{1,2})?)\s+each/i);
  if (ewTotal) {
    const v = parseMoney(ewTotal[1]);
    if (v) return { value: v, confident: true };
  }

  // Bare £ amount that looks like a stake (medium confidence): "£10.00"
  const amounts: number[] = [];
  for (const m of text.matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)) {
    const v = parseMoney(m[1]);
    if (v != null && v >= 0.5 && v <= 10000) amounts.push(v);
  }
  if (amounts.length === 1) return { value: amounts[0], confident: false };
  // Prefer smallest (stake is typically smaller than potential returns)
  if (amounts.length >= 2) {
    const min = Math.min(...amounts);
    return { value: min, confident: false };
  }

  return null;
}

function extractOdds(text: string): ParsedField<number> | null {
  // "Odds: 3.50", "Price: 5/2", "@ 3.50", "@3.50", "Win Odds: 5/2"
  const oddsLabel =
    text.match(/\b(?:odds|price|win\s+odds)\s*[:\s]\s*([^\s]+)/i) ||
    text.match(/@\s*([0-9][^\s,\n]+)/);
  if (oddsLabel) {
    const v = parseOddsToken(oddsLabel[1]);
    if (v != null) return { value: v, confident: true };
  }

  // Fractional in parentheses: "3.50 (7/2)" — take the decimal
  const decInParen = text.match(/\b(\d+\.\d{2})\s+\([0-9]+\s*\/\s*[0-9]+\)/);
  if (decInParen) {
    const v = parseOddsToken(decInParen[1]);
    if (v != null) return { value: v, confident: true };
  }

  // Standalone fractional "5/2" or "10/1" (medium confidence — could be date)
  const frac = text.match(/\b(\d{1,3}\s*\/\s*\d{1,3})\b/);
  if (frac) {
    const v = parseOddsToken(frac[1]);
    if (v != null && v >= 1.1) return { value: v, confident: false };
  }

  // Standalone decimal "2.50" / "11.0" in context
  const decContext = text.match(/\bselection.*?(\d+\.\d{2})\b/is);
  if (decContext) {
    const v = parseOddsToken(decContext[1]);
    if (v != null) return { value: v, confident: false };
  }

  return null;
}

function extractSelection(text: string): ParsedField<string> | null {
  // Labelled: "Selection: Arsenal Win", "Your Bet: Frankel"
  const labelled =
    text.match(/\bselection\s*[:\-]\s*(.+?)(?:\n|$)/i) ||
    text.match(/\byour\s+bet\s*[:\-]\s*(.+?)(?:\n|$)/i) ||
    text.match(/\bbet\s*[:\-]\s*(.+?)(?:\n|$)/i);
  if (labelled) {
    const v = labelled[1].trim().replace(/\s+/g, " ");
    if (v.length >= 2 && v.length <= 120) {
      return { value: v, confident: true };
    }
  }

  // ALL CAPS horse name on its own line (racing slips)
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length >= 2 && t.length <= 60 && /^[A-Z][A-Z0-9' -]+$/.test(t)) {
      // Exclude common non-selection all-caps labels
      if (!/^(STAKE|ODDS|RETURNS|FREE BET|BOOKIE|TOTAL|BET|WIN|PLACE|EW|EACH WAY)$/i.test(t)) {
        return { value: t, confident: false };
      }
    }
  }

  // First non-trivial line that isn't a label
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().replace(/^['"''""\s]+|['"''""\s]+$/g, "");
    if (t.length < 4 || t.length > 120) continue;
    if (/^(http|www\.|bet\s+id|ref|reference|receipt|thank|dear|hello|hi\b)/i.test(t)) continue;
    if (/^[\d#]+$/.test(t)) continue; // bare numbers
    if (/stake|odds|returns|price|total|potential|market|event|league/i.test(t)) continue;
    return { value: t, confident: false };
  }

  return null;
}

function extractBetType(text: string): {
  betType: ParsedField<"qualifying" | "free_snr" | "free_sr"> | null;
  isFreeBet: boolean;
} {
  const isFree =
    /\bfree[\s-]?bet\b/i.test(text) ||
    /\bfb\b/i.test(text) ||
    /\bbonus\s+bet\b/i.test(text) ||
    /\busing.*?bonus\b/i.test(text);

  const isSNR = /\bsnr\b|\bstake\s+not\s+returned\b/i.test(text);
  const isSR = /\b(?:^|\s)sr\b|\bstake\s+returned\b/i.test(text);

  if (!isFree) return { betType: null, isFreeBet: false };

  if (isSR && !isSNR) {
    return { betType: { value: "free_sr", confident: true }, isFreeBet: true };
  }
  // Default free bet to SNR (most common)
  return {
    betType: { value: "free_snr", confident: isSNR },
    isFreeBet: true,
  };
}

function extractMarketHint(text: string): ParsedField<string> | null {
  if (/\beach[\s-]?way\b|e\/w\b|\bew\b/i.test(text)) return { value: "each_way", confident: true };
  if (/\bwin\s+(?:only|market|bet)\b/i.test(text) || /\bmarket\s*[:\s]\s*win\b/i.test(text)) {
    return { value: "win", confident: true };
  }
  if (/\bplace\s+(?:only|market|bet)\b/i.test(text)) {
    return { value: "place", confident: true };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse pasted bookie bet-confirmation text into prefill fields.
 * Returns null when nothing meaningful can be extracted.
 * The caller must present results for user review — never auto-submit.
 */
export function parseBetText(raw: string): ParsedBet | null {
  const text = raw.replace(/ /g, " ").trim();
  if (!text || text.length < 6) return null;

  const bookmakerName = matchBookmakerFromText(text);
  const bookmaker = bookmakerName
    ? { value: bookmakerName, confident: true }
    : null;

  const backStake = extractStake(text);
  const backOdds = extractOdds(text);
  const selection = extractSelection(text);
  const { betType, isFreeBet } = extractBetType(text);
  const marketHint = extractMarketHint(text);
  const structureRaw = extractBetStructure(text);
  const structure = structureRaw
    ? { value: structureRaw, confident: true }
    : null;
  const unitRaw = extractUnitStake(text);
  const unitStake = unitRaw != null ? { value: unitRaw, confident: true } : null;
  const eachWay = extractEachWayFlag(text);
  const legs = extractSlipLegs(text);

  // Return null if we found literally nothing useful
  if (
    !bookmaker &&
    !backStake &&
    !backOdds &&
    !selection &&
    !structure &&
    legs.length === 0
  ) {
    return null;
  }

  return {
    bookmaker,
    backStake,
    backOdds,
    selection,
    betType,
    marketHint,
    isFreeBet,
    structure,
    unitStake,
    eachWay,
    legs,
  };
}
