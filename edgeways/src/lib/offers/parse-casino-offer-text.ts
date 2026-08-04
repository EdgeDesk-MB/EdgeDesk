/**
 * Casino offer paste parser (H2) - turns pasted promo text / OCR output into
 * a prefill draft for the Casino log-offer dialog. Pure and client-safe;
 * mirrors parse-offer-text.ts conventions. Percentages are returned as
 * FRACTIONS (0-1) to match the calc layer and API - the dialog multiplies
 * by 100 for its percent inputs.
 */

import { matchBookmakerFromText } from "@/lib/bookmakers";
import type { CasinoComponentType } from "@/lib/calc/casino-reward-ev";

export interface ParsedCasinoOfferDraft {
  casino: string | null;
  title: string;
  /** Qualifying stake to unlock the reward, e.g. Play/Wager £10. */
  qualifyStake: number | null;
  bonusAmount: number | null;
  wageringMultiplier: number | null;
  /** Fraction 0-1 */
  rtp: number | null;
  /** Fraction 0-1 */
  contributionPct: number | null;
  /** K1: number of spins, e.g. "20 Free Spins" */
  spins: number | null;
  /** K1: £ value per spin, only when the text disambiguates with "each"/"p each" */
  spinValue: number | null;
  /** K1: number of golden chips */
  chipCount: number | null;
  /** K1: £ value per chip */
  chipValue: number | null;
  /** K1: fraction 0-1, e.g. "10% cashback" -> 0.1 */
  cashbackPct: number | null;
  /**
   * Best guess at the reward component type (bonus / free spins / chips /
   * cashback). The log wizard uses this for the reward step after any
   * qualifying wager.
   */
  likelyComponentType: CasinoComponentType;
  confidence: "high" | "medium" | "low";
  notes: string[];
  /** The raw pasted text, so the log dialog can match eligible games against the library. */
  sourceText: string;
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

function parseSpinsCount(text: string): number | null {
  const m = text.match(new RegExp(`${NUM}\\s+free\\s+spins`, "i"));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 && v <= 1000 ? v : null;
}

/** Only matches when the text disambiguates "per spin" - a bare "worth £X" is the pre-K1 total-value phrasing (parseBonus), not per-spin. */
function parseSpinValue(text: string): number | null {
  const poundsEach = text.match(new RegExp(`worth\\s+£\\s*${NUM}\\s+each`, "i"));
  if (poundsEach) {
    const v = Number(poundsEach[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const penceEach = text.match(new RegExp(`worth\\s+${NUM}p\\s+each`, "i"));
  if (penceEach) {
    const v = Number(penceEach[1]);
    if (Number.isFinite(v) && v > 0) return v / 100;
  }
  return null;
}

function parseChipCount(text: string): number | null {
  const m = text.match(new RegExp(`${NUM}\\s+(?:golden\\s+)?chips`, "i"));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 && v <= 1000 ? v : null;
}

function parseChipValue(text: string): number | null {
  const m = text.match(new RegExp(`chips?\\s+worth\\s+£\\s*${NUM}(?:\\s+each)?`, "i"));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function parseCashbackPct(text: string): number | null {
  const m = text.match(new RegExp(`${NUM}\\s*%\\s+cashback`, "i"));
  if (!m) return null;
  const pct = Number(m[1]);
  return Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct / 100 : null;
}

function inferComponentType(input: {
  spins: number | null;
  chipCount: number | null;
  cashbackPct: number | null;
}): CasinoComponentType {
  if (input.spins != null) return "free_spins";
  if (input.chipCount != null) return "golden_chips";
  if (input.cashbackPct != null) return "cashback";
  return "bonus";
}

function parseContribution(text: string): number | null {
  const m = text.match(new RegExp(`contribut\\w*\\s*(?:at|:)?\\s*${NUM}\\s*%`, "i"));
  if (!m) return null;
  const pct = Number(m[1]);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return pct / 100;
}

/**
 * Qualifying stake to unlock the reward (not the bonus amount, not playthrough ×).
 * Prefers explicit "stake/wager/play £X" and "£X bet requirement" phrasing.
 */
function parseQualifyStake(text: string): number | null {
  const patterns = [
    // "Stake £10 get…", "wager £100", "Play £10 on an eligible game"
    new RegExp(`(?:^|\\b)(?:stake|wager|play|bet)\\s+£\\s*${NUM}\\b`, "i"),
    // "completing the £10 bet requirement", "£10 bet requirement"
    new RegExp(`£\\s*${NUM}\\s+(?:bet\\s+)?requirement\\b`, "i"),
    // "when £100 has been wagered"
    new RegExp(`£\\s*${NUM}\\s+has\\s+been\\s+wagered`, "i"),
    // "when you stake/play/wager £10"
    new RegExp(`when\\s+(?:you\\s+)?(?:stake|play|wager)\\s+£\\s*${NUM}\\b`, "i"),
    // "after completing the £10 …" (Betfair long-form)
    new RegExp(`(?:after\\s+)?complet(?:e|ing)\\s+(?:the\\s+)?£\\s*${NUM}\\b`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && v > 0 && v <= 10_000) return v;
    }
  }
  return null;
}

function formatPoundShort(amount: number): string {
  if (!Number.isFinite(amount)) return "£0";
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `£${rounded}`;
  return `£${rounded.toFixed(2)}`;
}

/** Reward clause for the synthesised campaign title. */
function describeReward(input: {
  bonusAmount: number | null;
  spins: number | null;
  chipCount: number | null;
  cashbackPct: number | null;
  likelyComponentType: CasinoComponentType;
}): string | null {
  if (input.likelyComponentType === "free_spins" && input.spins != null) {
    return `${input.spins} free spin${input.spins === 1 ? "" : "s"}`;
  }
  if (input.likelyComponentType === "golden_chips" && input.chipCount != null) {
    return `${input.chipCount} golden chip${input.chipCount === 1 ? "" : "s"}`;
  }
  if (input.likelyComponentType === "cashback" && input.cashbackPct != null) {
    return `${Math.round(input.cashbackPct * 100)}% cashback`;
  }
  if (input.bonusAmount != null) {
    return `${formatPoundShort(input.bonusAmount)} bonus`;
  }
  return null;
}

/**
 * Prefer a neat "Wager £X get …" title when qualify + reward are known.
 * Falls back to the first promo-looking line for deposit-match / unstructured pastes.
 */
function buildCasinoTitle(
  text: string,
  input: {
    bonusAmount: number | null;
    spins: number | null;
    chipCount: number | null;
    cashbackPct: number | null;
    likelyComponentType: CasinoComponentType;
  }
): string {
  const stake = parseQualifyStake(text);
  const reward = describeReward(input);
  if (stake != null && reward) {
    return `Wager ${formatPoundShort(stake)} get ${reward}`;
  }
  return pickTitle(text);
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

/** True when the paste describes a reward step (bonus, spins, chips, cashback). */
export function draftHasRewardStep(draft: ParsedCasinoOfferDraft): boolean {
  if (draft.likelyComponentType === "free_spins" && draft.spins != null) return true;
  if (draft.likelyComponentType === "golden_chips" && draft.chipCount != null) return true;
  if (draft.likelyComponentType === "cashback" && draft.cashbackPct != null) return true;
  return draft.bonusAmount != null;
}

/** Wager-then-reward campaigns: wizard should collect qualify first, then reward. */
export function draftNeedsQualifyThenReward(draft: ParsedCasinoOfferDraft): boolean {
  return draft.qualifyStake != null && draftHasRewardStep(draft);
}

export function parseCasinoOfferText(text: string): ParsedCasinoOfferDraft {
  const qualifyStake = parseQualifyStake(text);
  const bonusAmount = parseBonus(text);
  const wageringMultiplier = parseWagering(text);
  const rtp = parseRtp(text);
  const contributionPct = parseContribution(text);
  const spins = parseSpinsCount(text);
  const spinValue = parseSpinValue(text);
  const chipCount = parseChipCount(text);
  const chipValue = parseChipValue(text);
  const cashbackPct = parseCashbackPct(text);
  const likelyComponentType = inferComponentType({ spins, chipCount, cashbackPct });

  const confidence =
    bonusAmount != null && wageringMultiplier != null
      ? "high"
      : bonusAmount != null || wageringMultiplier != null || qualifyStake != null
        ? "medium"
        : "low";

  const notes: string[] = [];
  if (qualifyStake != null) notes.push(`Qualify: £${qualifyStake.toFixed(2)}`);
  if (bonusAmount != null) notes.push(`Bonus: £${bonusAmount.toFixed(2)}`);
  if (wageringMultiplier != null) notes.push(`Wagering: ${wageringMultiplier}×`);
  if (contributionPct != null) notes.push(`Contribution: ${Math.round(contributionPct * 100)}%`);
  if (rtp != null) notes.push(`RTP: ${(rtp * 100).toFixed(1).replace(/\.0$/, "")}%`);
  if (spins != null) notes.push(`Spins: ${spins}`);
  if (spinValue != null) notes.push(`Spin value: £${spinValue.toFixed(2)}`);
  if (chipCount != null) notes.push(`Chips: ${chipCount}`);
  if (chipValue != null) notes.push(`Chip value: £${chipValue.toFixed(2)}`);
  if (cashbackPct != null) notes.push(`Cashback: ${Math.round(cashbackPct * 100)}%`);

  return {
    casino: pickCasino(text),
    title: buildCasinoTitle(text, {
      bonusAmount,
      spins,
      chipCount,
      cashbackPct,
      likelyComponentType,
    }),
    qualifyStake,
    bonusAmount,
    wageringMultiplier,
    rtp,
    contributionPct,
    spins,
    spinValue,
    chipCount,
    chipValue,
    cashbackPct,
    likelyComponentType,
    confidence,
    notes,
    sourceText: text,
  };
}
