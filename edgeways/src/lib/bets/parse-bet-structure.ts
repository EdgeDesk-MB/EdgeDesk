/**
 * Detect full-cover / multiple structure and multi-leg lists from slip text.
 * Shared by text paste and screenshot OCR paths.
 */

import { parseOddsToken } from "@/lib/bets/parse-bet-text";
import type { OcrBetStructure, SlipLeg } from "@/lib/ocr/types";

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
  { re: /\bmultiples?\b/i, structure: "accumulator" },
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

const LEG_SKIP =
  /stake|returns|total|potential|receipt|ref|bookmaker|lucky|trixie|yankee|patent|heinz|goliath|canadian|acca|each.?way|multiples?|betslip|singles/i;

const HEADER_LINE =
  /^(?:\d+\s+)?selections?$|^\d+\s+selections?$/i;

const WIN_DETAIL =
  /^(win|place|each\s*way|e\/w)\s*[-–]\s*(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z ()'-]+)$/i;

function stripClothNumber(label: string): string {
  return label.replace(/^\d{1,2}\s+/, "").trim();
}

/** Jockey-silk icons OCR as "V*", "Vv", etc. before the cloth number. */
function stripOcrSilkPrefix(line: string): string {
  const t = line.trim();
  const cloth = t.match(/(\d{1,2}\s+[A-Za-z].*)$/);
  if (!cloth || cloth.index == null || cloth.index === 0) return t;
  return cloth[1]!.trim();
}

function parseWinDetail(line: string | undefined): Pick<
  SlipLeg,
  "market" | "eventTime" | "course"
> | null {
  const m = line?.trim().match(WIN_DETAIL);
  if (!m) return null;
  const raw = m[1]!.toLowerCase();
  const market: SlipLeg["market"] =
    raw.startsWith("place")
      ? "place"
      : raw.includes("each") || raw === "e/w"
        ? "each_way"
        : "win";
  const [h, min] = m[2]!.split(":").map(Number);
  if (h > 23 || min > 59) return null;
  return {
    market,
    eventTime: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    course: m[3]!.trim(),
  };
}

function parseStandaloneOdds(line: string | undefined): number | undefined {
  const t = line?.trim() ?? "";
  if (!t) return undefined;
  if (!/^\d+\.\d{2}$/.test(t) && !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(t)) {
    return undefined;
  }
  return parseOddsToken(t) ?? undefined;
}

function pushLeg(
  legs: SlipLeg[],
  seen: Set<string>,
  rawLabel: string,
  odds: number | undefined,
  detail: Pick<SlipLeg, "market" | "eventTime" | "course"> | null
): boolean {
  const label = stripClothNumber(rawLabel);
  const key = label.toLowerCase();
  if (!label || label.length < 2 || seen.has(key)) return false;
  if (HEADER_LINE.test(label) || LEG_SKIP.test(label)) return false;
  seen.add(key);
  legs.push({
    label,
    odds,
    ...(detail ?? {}),
  });
  return true;
}

/**
 * Heuristic multi-leg extraction: "Horse 5/2", "Arsenal @ 1.90",
 * or Sportsbook multiples "4 Notable Speech 3.50" / "Win - 15:00 York".
 * Low confidence — always review in the create dialog.
 */
export function extractSlipLegs(text: string): SlipLeg[] {
  const legs: SlipLeg[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!;
    if (t.length < 3 || t.length > 80) continue;
    if (LEG_SKIP.test(t) || HEADER_LINE.test(t) || WIN_DETAIL.test(t)) continue;
    const line = stripOcrSilkPrefix(t);

    const at = line.match(/^(.+?)\s+@\s*([0-9][^\s]+)\s*$/);
    if (at) {
      const detail = parseWinDetail(lines[i + 1]);
      if (pushLeg(legs, seen, at[1]!.trim(), parseOddsToken(at[2]!) ?? undefined, detail) && detail) {
        i += 1;
      }
      continue;
    }

    const frac = line.match(/^(.+?)\s+(\d{1,3}\s*\/\s*\d{1,3})\s*$/);
    if (frac && !/^\d/.test(frac[1]!.trim())) {
      const detail = parseWinDetail(lines[i + 1]);
      if (
        pushLeg(legs, seen, frac[1]!.trim(), parseOddsToken(frac[2]!) ?? undefined, detail) &&
        detail
      ) {
        i += 1;
      }
      continue;
    }

    const dec = line.match(/^(.+?)\s+(\d+\.\d{2})\s*$/);
    if (dec) {
      const odds = parseOddsToken(dec[2]!);
      if (odds != null && odds > 1.01) {
        const detail = parseWinDetail(lines[i + 1]);
        if (pushLeg(legs, seen, dec[1]!.trim(), odds, detail) && detail) i += 1;
        continue;
      }
    }

    const clothName = line.match(/^(\d{1,2})\s+([A-Za-z][A-Za-z0-9'.\- ]{1,40})$/);
    if (clothName) {
      const name = clothName[2]!.trim();
      const odds = parseStandaloneOdds(lines[i + 1]);
      const detailAfterOdds = odds != null ? parseWinDetail(lines[i + 2]) : null;
      const detailHere = parseWinDetail(lines[i + 1]);
      const detail = detailAfterOdds ?? detailHere;
      if (odds != null || detail) {
        if (pushLeg(legs, seen, name, odds, detail)) {
          if (odds != null) i += 1;
          if (detailAfterOdds || (detailHere && odds == null)) i += 1;
        }
      }
    }
  }
  return legs.length >= 2 ? legs : [];
}
