/**
 * AI Triggers - smart parsing of trigger text for conditional side-effects
 * and bet-win rules. Deterministic grammar (no LLM).
 *
 * Examples:
 *   "Bet £50 get £50" → £50 free bet when the bet settles
 *   "Bet £50 get £50 FB if 2nd, 3rd, 4th" → £50 free bet on those places
 *   "£50FB 2nd, 3rd, 4th" → same place trigger shorthand
 *   "Harry Kane scores first" → football bet-win rule (via parseTrigger)
 */

import type { TriggerRule } from "./trigger";
import { parseTrigger } from "./trigger";
import { formatGbp } from "@/lib/format-money";
import type { RaceResult } from "@/lib/racing";
import {
  favouriteSpOdds,
  isRaceResultIncomplete,
  selectionPosition,
  winnerIsSpFavourite,
} from "@/lib/racing";

export type AiEffect = {
  kind: "free_bet_award";
  amount: number;
  /** Empty = award when bet settles. Otherwise finishing positions, e.g. [2, 3, 4]. */
  positions: number[];
  /** Refund-If: award only when the bookie bet loses (not on a win). */
  awardOnLoss?: boolean;
  /**
   * QuinnBet-style: place only counts when the race winner was the SP favourite
   * ("2nd to the SP favourite"). Settled from recorded result SP, never pre-race odds.
   */
  winnerMustBeSpFavourite?: boolean;
  /** Optional floor on the SP favourite's Starting Price (decimal). */
  minFavouriteSpOdds?: number;
};

export interface TriggerBundle {
  v: 2;
  betWin: TriggerRule | null;
  effects: AiEffect[];
}

export interface AiTriggerPreview {
  lines: string[];
  recognised: boolean;
  bundle: TriggerBundle;
}

const ORDINAL_SUFFIX: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
function ordinal(n: number): string {
  const s = ORDINAL_SUFFIX[n] ?? "th";
  return `${n}${s}`;
}

function formatPositions(positions: number[]): string {
  if (positions.length === 0) return "";
  if (positions.length === 1) return ordinal(positions[0]);
  if (positions.length === 2) return `${ordinal(positions[0])} or ${ordinal(positions[1])}`;
  const last = positions[positions.length - 1];
  const rest = positions.slice(0, -1).map(ordinal).join(", ");
  return `${rest} or ${ordinal(last)}`;
}

export function describeAiEffect(effect: AiEffect): string {
  if (effect.kind !== "free_bet_award") return "";
  if (effect.awardOnLoss) {
    return `${formatGbp(effect.amount)} free bet if this bet loses - credits bookie balance (Refund-If)`;
  }
  if (effect.positions.length === 0) {
    return `${formatGbp(effect.amount)} free bet - credits bookie balance when this bet settles (or mark awarded early if the bookie releases it on placement)`;
  }
  if (effect.winnerMustBeSpFavourite) {
    const minSp =
      effect.minFavouriteSpOdds != null && effect.minFavouriteSpOdds > 1
        ? ` (min fav SP ${effect.minFavouriteSpOdds})`
        : "";
    return `${formatGbp(effect.amount)} free bet if selection finishes ${formatPositions(effect.positions)} to the SP favourite${minSp} - credits bookie balance`;
  }
  return `${formatGbp(effect.amount)} free bet if selection finishes ${formatPositions(effect.positions)} - credits bookie balance`;
}

/** "2nd to (the) (SP) favourite" / "second to the favourite". */
export function textRequiresSpFavouriteWinner(text: string): boolean {
  return (
    /\b(?:\d+(?:st|nd|rd|th)|second)\s+to\s+(?:the\s+)?(?:sp\s+|starting\s+price\s+)?favou?rite/i.test(
      text
    ) || /\b2nd\s+to\s+(?:the\s+)?(?:sp\s+)?fav\b/i.test(text)
  );
}

/**
 * Parse an optional floor on the SP favourite's price from trigger / offer text.
 * Accepts "min fav SP 2.5", "favourite SP 2.50+", "fav at least 5/2".
 */
export function parseMinFavouriteSpOdds(text: string): number | null {
  const decimal = text.match(
    /\bmin\s+fav(?:ourite)?\s+sp\s+(\d+(?:\.\d{1,2})?)\b/i
  );
  if (decimal) {
    const n = parseFloat(decimal[1]!);
    return n > 1 ? n : null;
  }
  const atLeast = text.match(
    /\bfav(?:ourite)?\s+(?:sp\s+)?(?:odds\s+)?(?:of\s+|at\s+least\s+|≥\s*|>=\s*)(\d+(?:\.\d{1,2})?)\+?/i
  );
  if (atLeast) {
    const n = parseFloat(atLeast[1]!);
    return n > 1 ? n : null;
  }
  const frac = text.match(
    /\bfav(?:ourite)?\s+(?:of\s+)?(\d+)\s*\/\s*(\d+)\s+(?:or\s+)?(?:bigger|longer|more)/i
  );
  if (frac) {
    const a = parseInt(frac[1]!, 10);
    const b = parseInt(frac[2]!, 10);
    if (b > 0) {
      const n = Math.round((a / b + 1) * 100) / 100;
      return n > 1 ? n : null;
    }
  }
  return null;
}

/** Parse "2nd, 3rd, 4th" or "2 3 4" into [2,3,4]. */
export function parsePlacePositions(text: string): number[] {
  const matches = text.match(/\d+(?:st|nd|rd|th)?/gi) ?? [];
  const nums = [...new Set(matches.map((m) => parseInt(m, 10)).filter((n) => n > 0))];
  return nums.sort((a, b) => a - b);
}

function parsePlacePositionsFromText(text: string): number[] {
  // Workflow appendices often restate places incorrectly ("refund if 3rd or 4th").
  // No trailing \b after ":" — ":" is non-word so `\b` before " 1." never matches.
  const trimmed = (text.split(/\bHow to match:/i)[0] ?? text).trim();
  if (!trimmed) return [];

  // First "if …" on the same line only. `(.+)$` cannot cross newlines (`.` excludes
  // `\n`), so it used to skip a headline "if 2nd…" and match a later "refund if".
  const ifMatch = trimmed.match(/\bif\s+([^\n]+)/i);
  const placePart = ifMatch?.[1]?.trim() ?? trimmed;

  // "2nd-4th" / "2-4" / "2nd – 4th"
  const rangeMatch = placePart.match(
    /(\d+)(?:st|nd|rd|th)?\s*[-–]\s*(\d+)(?:st|nd|rd|th)?/i
  );
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (a >= 1 && b <= 10 && Math.abs(b - a) <= 6) {
      const positions: number[] = [];
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) positions.push(i);
      return positions;
    }
  }

  // Prefer · / • / | segments that look like the offer place clause. Edgeways
  // labels are "Course · Horse · Offer (2nd, 3rd, 4th)" — taking only the first
  // segment used to drop places. Ignore ordinals that are only horse names
  // (e.g. "2nd Thought") by requiring free-bet / bet-get wording in the segment.
  const segments = placePart.split(/\s*[·•|]\s*/);
  const offerPlaceSegments = segments.filter(
    (s) =>
      /\b\d+(?:st|nd|rd|th)\b/i.test(s) &&
      /\b(free\s*bet|fb\b|bet\s+£?\s*\d)/i.test(s)
  );
  let clauseBase: string;
  if (offerPlaceSegments.length > 0) {
    clauseBase = offerPlaceSegments.join(" ").trim();
  } else if (ifMatch) {
    // "if 2nd, 3rd, 4th · 8+ runners" — keep ordinal segments, drop noise tails.
    const ordinalSegs = segments.filter((s) => /\b\d+(?:st|nd|rd|th)\b/i.test(s));
    clauseBase = (ordinalSegs.length > 0 ? ordinalSegs.join(" ") : placePart).trim();
  } else if (segments.length > 1) {
    // Course · Horse · unconditional offer — do not scan horse-name ordinals.
    return [];
  } else {
    clauseBase = placePart.trim();
  }
  const clause = clauseBase.split(/\brunners?\b|\bexpires?\b|\bmin\b/i)[0] ?? clauseBase;
  if (ifMatch) {
    // Within an explicit "if …" clause bare numbers are valid place positions
    const fromOrdinals = parsePlacePositions(clause).filter((n) => n >= 1 && n <= 10);
    if (fromOrdinals.length > 0) return fromOrdinals;
  } else {
    // Without an "if" clause, require the ordinal suffix (st/nd/rd/th) to avoid
    // capturing stake amounts like "£10" as position 10.
    const ordinalMatches = clause.match(/\b(\d+)(?:st|nd|rd|th)\b/gi) ?? [];
    const fromOrdinals = [
      ...new Set(ordinalMatches.map((m) => parseInt(m, 10)).filter((n) => n >= 1 && n <= 10)),
    ].sort((a, b) => a - b);
    if (fromOrdinals.length > 0) return fromOrdinals;
  }

  return [];
}

function hasExplicitPlaceCondition(text: string): boolean {
  return (
    /\bif\s+[\d\s,\-–ndrdth]+/i.test(text) ||
    /\b\d+(?:st|nd|rd|th)\b/i.test(text)
  );
}

function isLoseConditionalFreeBet(text: string): boolean {
  return (
    /\bif\s+(?:the\s+|your\s+)?(?:bet|horse|selection)\s+los/i.test(text) ||
    /\bif\s+bet\s+los/i.test(text) ||
    /\bmoney\s+back[\s\S]{0,80}?\blos/i.test(text)
  );
}

function freeBetEffect(amount: number, text: string): AiEffect | null {
  if (!(amount > 0)) return null;
  if (isLoseConditionalFreeBet(text)) {
    return { kind: "free_bet_award", amount, positions: [], awardOnLoss: true };
  }
  const winnerMustBeSpFavourite = textRequiresSpFavouriteWinner(text);
  let positions = hasExplicitPlaceCondition(text) ? parsePlacePositionsFromText(text) : [];
  // "2nd to the favourite" is a place-2 constraint even when the clause is sparse.
  if (winnerMustBeSpFavourite && positions.length === 0) positions = [2];
  if (winnerMustBeSpFavourite && positions.length > 0) {
    // Keep only the place ordinals; ignore stray numbers from odds like 6/4.
    positions = positions.filter((n) => n >= 2 && n <= 6);
    if (positions.length === 0) positions = [2];
  }
  const minFavouriteSpOdds = winnerMustBeSpFavourite
    ? parseMinFavouriteSpOdds(text)
    : null;
  return {
    kind: "free_bet_award",
    amount,
    positions,
    ...(winnerMustBeSpFavourite ? { winnerMustBeSpFavourite: true } : {}),
    ...(minFavouriteSpOdds != null ? { minFavouriteSpOdds } : {}),
  };
}

/** Parse promo / offer patterns from trigger text or labels. */
export function inferAiEffectsFromText(text: string): AiEffect[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const effects: AiEffect[] = [];

  // Bet £50 get £50 | Bet £50 get £50FB | Bet £50 get £50 FB if 2nd, 3rd, 4th
  const betGetMatch = trimmed.match(
    /\bbet\s+£?\s*(\d+(?:\.\d{1,2})?)\s+get\s+£?\s*(\d+(?:\.\d{1,2})?)\s*(?:fb|free\s*bet)?/i
  );
  if (betGetMatch) {
    const effect = freeBetEffect(parseFloat(betGetMatch[2]), trimmed);
    if (effect) effects.push(effect);
    return effects;
  }

  const moneyBackLose = trimmed.match(
    /£?\s*(\d+(?:\.\d{1,2})?)\s*(?:money\s+back|back\s+as\s+a\s+free\s*bet|free\s*bet)/i
  );
  if (moneyBackLose && isLoseConditionalFreeBet(trimmed)) {
    const effect = freeBetEffect(parseFloat(moneyBackLose[1]), trimmed);
    if (effect) effects.push(effect);
    return effects;
  }

  // £50FB 2nd, 3rd, 4th | £50 free bet if 2nd-4th | 50FB
  const fbMatch = trimmed.match(
    /£?\s*(\d+(?:\.\d{1,2})?)\s*(?:fb|free\s*bet)\b(.*)?/i
  );
  if (fbMatch) {
    const effect = freeBetEffect(parseFloat(fbMatch[1]), fbMatch[2] ?? trimmed);
    if (effect) effects.push(effect);
    return effects;
  }

  return effects;
}

/** @deprecated alias */
export function inferAiEffectsFromLabel(label: string): AiEffect[] {
  return inferAiEffectsFromText(label);
}

/** True when the bet label looks like a promo / offer trigger phrase. */
export function offerTriggerDetectedInLabel(label: string): boolean {
  return inferAiEffectsFromText(label).length > 0;
}

/** Suggested offer-trigger text copied from a recognised label. */
export function offerTriggerFromLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed || !offerTriggerDetectedInLabel(trimmed)) return null;
  return trimmed;
}

export function parseTriggerBundle(raw: string | null | undefined): TriggerBundle {
  if (!raw?.trim()) return { v: 2, betWin: null, effects: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && (parsed as TriggerBundle).v === 2) {
      const b = parsed as TriggerBundle;
      return { v: 2, betWin: b.betWin ?? null, effects: b.effects ?? [] };
    }
    if (parsed && typeof parsed === "object" && "kind" in (parsed as object)) {
      return { v: 2, betWin: parsed as TriggerRule, effects: [] };
    }
  } catch {
    /* legacy */
  }
  return { v: 2, betWin: null, effects: [] };
}

export function serializeTriggerBundle(bundle: TriggerBundle): string | null {
  if (!bundle.betWin && bundle.effects.length === 0) return null;
  return JSON.stringify(bundle);
}

export function buildTriggerBundle(opts: {
  label: string;
  triggerText?: string | null;
  homeTeam?: string;
  awayTeam?: string;
}): { bundle: TriggerBundle; triggerText: string | null; preview: AiTriggerPreview } {
  const label = opts.label.trim();
  const explicit = opts.triggerText?.trim() ?? "";

  const effects = explicit
    ? inferAiEffectsFromText(explicit)
    : label
      ? inferAiEffectsFromText(label)
      : [];

  let betWin: TriggerRule | null = null;
  const lines: string[] = [];

  if (explicit) {
    const football = parseTrigger(explicit, {
      homeTeam: opts.homeTeam ?? "",
      awayTeam: opts.awayTeam ?? "",
    });
    if (football) {
      betWin = football.rule;
      lines.push(`${football.description} - settles the bet in real time`);
    }
  }

  for (const effect of effects) {
    lines.push(describeAiEffect(effect));
  }

  const recognised = lines.length > 0;
  const triggerText = explicit || (effects.length > 0 && !explicit ? label : null) || null;

  return {
    bundle: { v: 2, betWin, effects },
    triggerText: recognised ? triggerText : explicit || null,
    preview: {
      lines,
      recognised,
      bundle: { v: 2, betWin, effects },
    },
  };
}

export function previewAiTriggers(opts: {
  label?: string;
  triggerText?: string;
  homeTeam?: string;
  awayTeam?: string;
}): AiTriggerPreview {
  return buildTriggerBundle({
    label: opts.label ?? "",
    triggerText: opts.triggerText,
    homeTeam: opts.homeTeam,
    awayTeam: opts.awayTeam,
  }).preview;
}

/** Preview from the AI Triggers field only (not the bet label). */
export function previewAiTriggersFromInput(opts: {
  triggerText?: string;
  homeTeam?: string;
  awayTeam?: string;
}): AiTriggerPreview {
  return buildTriggerBundle({
    label: "",
    triggerText: opts.triggerText,
    homeTeam: opts.homeTeam,
    awayTeam: opts.awayTeam,
  }).preview;
}

export function aiEffectsForBet(
  triggerRule: string | null | undefined,
  label: string
): AiEffect[] {
  const bundle = parseTriggerBundle(triggerRule);
  if (bundle.effects.length > 0) return bundle.effects;
  return inferAiEffectsFromText(label);
}

export function betWinRuleForBet(triggerRule: string | null | undefined): TriggerRule | null {
  return parseTriggerBundle(triggerRule).betWin;
}

export function isPlaceFreeBetEffect(effect: AiEffect): boolean {
  return effect.kind === "free_bet_award" && effect.positions.length > 0;
}

export function isLossFreeBetEffect(effect: AiEffect): boolean {
  return effect.kind === "free_bet_award" && effect.awardOnLoss === true;
}

export function evaluateFreeBetAward(
  effect: AiEffect & { kind: "free_bet_award" },
  selection: string,
  race: RaceResult
): { met: boolean; reason: string } {
  if (effect.positions.length === 0) {
    return { met: false, reason: "Unconditional free bet - not a place trigger" };
  }
  // Winner-only fast results lack 2nd/3rd — wait before awarding place free bets.
  if (isRaceResultIncomplete(race)) {
    return { met: false, reason: "Result incomplete - awaiting placings" };
  }
  const pos = selectionPosition(selection, race);
  if (pos <= 0) {
    return { met: false, reason: "Selection not found in result" };
  }
  if (!effect.positions.includes(pos)) {
    return {
      met: false,
      reason: `Finished ${ordinal(pos)} (needed ${formatPositions(effect.positions)})`,
    };
  }
  if (effect.winnerMustBeSpFavourite) {
    const fav = winnerIsSpFavourite(race);
    if (fav == null) {
      return {
        met: false,
        reason: "SP favourite not recorded on result",
      };
    }
    if (!fav) {
      return {
        met: false,
        reason: `Finished ${ordinal(pos)} but winner was not the SP favourite`,
      };
    }
    const minSp = effect.minFavouriteSpOdds;
    if (minSp != null && minSp > 1) {
      const favSp = favouriteSpOdds(race);
      if (favSp == null) {
        return {
          met: false,
          reason: "Favourite SP not recorded on result",
        };
      }
      if (favSp + 0.0001 < minSp) {
        return {
          met: false,
          reason: `Favourite SP ${favSp} below min ${minSp}`,
        };
      }
    }
    return {
      met: true,
      reason: `Finished ${ordinal(pos)} to the SP favourite`,
    };
  }
  return {
    met: true,
    reason: `Finished ${ordinal(pos)}`,
  };
}

export function evaluateUnconditionalFreeBet(
  effect: AiEffect & { kind: "free_bet_award" },
  betStatus: string
): { met: boolean; reason: string } {
  if (effect.positions.length > 0) {
    return { met: false, reason: "Place trigger - not unconditional" };
  }
  if (betStatus === "open" || betStatus === "void") {
    return { met: false, reason: "Bet not settled yet" };
  }
  if (effect.awardOnLoss) {
    if (betStatus !== "lost" && betStatus !== "half_lose") {
      return { met: false, reason: "Refund-If: free bet only if the bet loses" };
    }
    return { met: true, reason: "Bet lost — money-back free bet" };
  }
  return {
    met: true,
    reason: "Offer unlocked",
  };
}
