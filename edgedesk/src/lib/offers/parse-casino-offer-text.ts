/**
 * Casino offer paste parser (H2) - turns pasted promo text / OCR output into
 * a prefill draft for the Casino log-offer dialog. Pure and client-safe;
 * mirrors parse-offer-text.ts conventions. Percentages are returned as
 * FRACTIONS (0-1) to match the calc layer and API - the dialog multiplies
 * by 100 for its percent inputs.
 */

import { matchBookmakerFromText } from "@/lib/bookmakers";

export interface ParsedCasinoOfferDraft {
  casino: string | null;
  title: string;
  bonusAmount: number | null;
  wageringMultiplier: number | null;
  /** Fraction 0-1 */
  rtp: number | null;
  /** Fraction 0-1 */
  contributionPct: number | null;
  confidence: "high" | "medium" | "low";
  notes: string[];
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;

function parseWagering(text: string): number | null {
  const patterns = [
    // "35x wagering", "40 × playthrough", "30x rollover"
    new RegExp(`${NUM}\\s*[x×]\\s*(?:wagering|playthrough|rollover)`, "i"),
    // "wagering requirement: 40x", "wagering of 35x"
    new RegExp(`wagering(?:\\s+requirements?)?\\s*(?:of|:)?\\s*${NUM}\\s*[x×]`, "i"),
    // "x30 playthrough"
    new RegExp(`[x×]\\s*${NUM}\\s*(?:wagering|playthrough|rollover)`, "i"),
    // "wagered 35 times"
    new RegExp(`wagered\\s+${NUM}\\s+times`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && v > 0 && v <= 200) return v;
    }
  }
  return null;
}

function parseBonus(text: string): number | null {
  const patterns = [
    // "50 free spins worth £5"
    new RegExp(`(?:spins?|bonus)\\s+worth\\s+£\\s*${NUM}`, "i"),
    // "100% deposit match up to £100"
    new RegExp(`up\\s+to\\s+£\\s*${NUM}`, "i"),
    // "get a £20 casino bonus", "£25 bonus", "£20 in bonus funds/site credit"
    new RegExp(`£\\s*${NUM}\\s*(?:casino\\s+)?(?:bonus|in\\s+bonus|site\\s+credit)`, "i"),
    // "bonus of £20"
    new RegExp(`bonus\\s+of\\s+£\\s*${NUM}`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return null;
}

function parseRtp(text: string): number | null {
  const m = text.match(new RegExp(`RTP\\s*(?:of|:)?\\s*${NUM}\\s*%`, "i"));
  if (!m) return null;
  const pct = Number(m[1]);
  if (!Number.isFinite(pct) || pct < 50 || pct > 100) return null;
  return pct / 100;
}

function parseContribution(text: string): number | null {
  const m = text.match(new RegExp(`contribut\\w*\\s*(?:at|:)?\\s*${NUM}\\s*%`, "i"));
  if (!m) return null;
  const pct = Number(m[1]);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return pct / 100;
}

function pickTitle(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const offerLine = lines.find((l) => /£|free\s+spins|bonus|deposit\s+match/i.test(l));
  const raw = offerLine ?? lines[0] ?? "";
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

function pickCasino(text: string): string | null {
  const brand = matchBookmakerFromText(text);
  if (brand) return brand;
  // Screenshot headers usually lead with the brand on its own short line.
  const first = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0];
  if (first && first.length <= 30 && !/[£%\d]/.test(first)) return first;
  return null;
}

export function parseCasinoOfferText(text: string): ParsedCasinoOfferDraft {
  const bonusAmount = parseBonus(text);
  const wageringMultiplier = parseWagering(text);
  const rtp = parseRtp(text);
  const contributionPct = parseContribution(text);

  const confidence =
    bonusAmount != null && wageringMultiplier != null
      ? "high"
      : bonusAmount != null || wageringMultiplier != null
        ? "medium"
        : "low";

  const notes: string[] = [];
  if (bonusAmount != null) notes.push(`Bonus: £${bonusAmount.toFixed(2)}`);
  if (wageringMultiplier != null) notes.push(`Wagering: ${wageringMultiplier}×`);
  if (contributionPct != null) notes.push(`Contribution: ${Math.round(contributionPct * 100)}%`);
  if (rtp != null) notes.push(`RTP: ${(rtp * 100).toFixed(1).replace(/\.0$/, "")}%`);

  return {
    casino: pickCasino(text),
    title: pickTitle(text),
    bonusAmount,
    wageringMultiplier,
    rtp,
    contributionPct,
    confidence,
    notes,
  };
}
