/**
 * Detect full-cover / multiple structure and multi-leg lists from slip text.
 * Shared by text paste and screenshot OCR paths.
 */

import { parseOddsToken } from "@/lib/bets/parse-bet-text";
import type { OcrBetStructure } from "@/lib/ocr/types";

const STRUCTURE_PATTERNS: Array<{ re: RegExp; structure: OcrBetStructure }> = [
  { re: /\blucky\s*15\b/i, structure: "lucky_15" },
  { re: /\blucky\s*31\b/i, structure: "lucky_31" },
  { re: /\blucky\s*63\b/i, structure: "lucky_63" },
  { re: /\bsuper[\s-]?heinz\b/i, structure: "super_heinz" },
  { re: /\bgoliath\b/i, structure: "goliath" },
  { re: /\bheinz\b/i, structure: "heinz" },
  { re: /\bcanadian\b|\bsuper[\s-]?yankee\b/i, structure: "canadian" },
  { re: /\btrixie\b/i, structure: "trixie" },
  { re: /\bpatent\b/i, structure: "patent" },
  { re: /\byankee\b/i, structure: "yankee" },
  { re: /\bbet\s*builder\b|\bbuilder\b/i, structure: "bet_builder" },
  { re: /\bfour[\s-]?fold\b|\b4[\s-]?fold\b/i, structure: "four_fold" },
  { re: /\btreble\b/i, structure: "treble" },
  { re: /\bdouble\b/i, structure: "double" },
  { re: /\baccumulator\b|\bacca\b/i, structure: "accumulator" },
];

export function extractBetStructure(text: string): OcrBetStructure | null {
  for (const { re, structure } of STRUCTURE_PATTERNS) {
    if (re.test(text)) return structure;
  }
  return null;
}

export function extractEachWayFlag(text: string): boolean {
  return /\beach[\s-]?way\b|\be\/w\b|\bew\b/i.test(text);
}

/** Unit stake labelled on full-cover slips: "£1 per bet", "Unit stake £0.50". */
export function extractUnitStake(text: string): number | null {
  const labelled =
    text.match(/\bunit\s+stake\s*[:\s]\s*£?\s*(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/£\s*(\d+(?:\.\d{1,2})?)\s+per\s+(?:bet|line|selection)/i);
  if (!labelled) return null;
  const n = parseFloat(labelled[1]!.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Heuristic multi-leg extraction: lines like "Horse Name 5/2" or "Arsenal @ 1.90".
 * Low confidence — always review in the create dialog.
 */
export function extractSlipLegs(
  text: string
): Array<{ label: string; odds?: number }> {
  const legs: Array<{ label: string; odds?: number }> = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length < 3 || t.length > 80) continue;
    if (
      /stake|returns|total|potential|receipt|ref|bookmaker|lucky|trixie|yankee|patent|heinz|goliath|canadian|acca|each.?way/i.test(
        t
      )
    ) {
      continue;
    }
    const at = t.match(/^(.+?)\s+@\s*([0-9][^\s]+)\s*$/);
    if (at) {
      const label = at[1]!.trim();
      const odds = parseOddsToken(at[2]!);
      const key = label.toLowerCase();
      if (!seen.has(key) && label.length >= 2) {
        seen.add(key);
        legs.push({ label, odds: odds ?? undefined });
      }
      continue;
    }
    const frac = t.match(/^(.+?)\s+(\d{1,3}\s*\/\s*\d{1,3})\s*$/);
    if (frac) {
      const label = frac[1]!.trim();
      const odds = parseOddsToken(frac[2]!);
      const key = label.toLowerCase();
      if (!seen.has(key) && label.length >= 2 && !/^\d/.test(label)) {
        seen.add(key);
        legs.push({ label, odds: odds ?? undefined });
      }
      continue;
    }
    const dec = t.match(/^(.+?)\s+(\d+\.\d{2})\s*$/);
    if (dec) {
      const label = dec[1]!.trim();
      const odds = parseOddsToken(dec[2]!);
      const key = label.toLowerCase();
      if (!seen.has(key) && label.length >= 2 && odds != null && odds > 1.01) {
        seen.add(key);
        legs.push({ label, odds });
      }
    }
  }
  return legs.length >= 2 ? legs : [];
}
