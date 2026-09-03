/**
 * Important / must-not-forget offer terms.
 * Stored inside offers.rules JSON (alongside racing rules when present).
 */

import type { OfferRow } from "@/lib/db/schema";
import { formatClockTime } from "@/lib/time-format";
import type { BetGetFreePlaceRules } from "@/lib/offers/racing-offer-rules";

/** How a stake must be placed (qualifier or free-bet reward). Legacy omit → single. */
export type BetScope = "single" | "acca" | "bet_builder";

/** @deprecated Use BetScope */
export type QualifierShape = BetScope;

export const BET_SCOPES: readonly BetScope[] = ["single", "acca", "bet_builder"] as const;

export function isBetScope(value: unknown): value is BetScope {
  return value === "single" || value === "acca" || value === "bet_builder";
}

export function betScopeLabel(scope: BetScope): string {
  if (scope === "acca") return "Acca";
  if (scope === "bet_builder") return "Bet builder";
  return "Single";
}

/** Canonical order, unique, never empty (defaults to single). */
export function normalizeScopes(value: unknown): BetScope[] {
  const set = new Set<BetScope>();
  if (Array.isArray(value)) {
    for (const v of value) {
      if (isBetScope(v)) set.add(v);
    }
  } else if (isBetScope(value)) {
    set.add(value);
  }
  if (set.size === 0) return ["single"];
  return BET_SCOPES.filter((s) => set.has(s));
}

export function scopesInclude(scopes: readonly BetScope[], scope: BetScope): boolean {
  return scopes.includes(scope);
}

export function scopesNeedMinSelections(scopes: readonly BetScope[]): boolean {
  return scopesInclude(scopes, "acca") || scopesInclude(scopes, "bet_builder");
}

export function isDefaultScopes(scopes: readonly BetScope[]): boolean {
  return scopes.length === 1 && scopes[0] === "single";
}

/** Omit default single-only sets from JSON. */
export function scopesForJson(scopes: readonly BetScope[]): BetScope[] | null {
  return isDefaultScopes(scopes) ? null : [...scopes];
}

export function formatScopesLabel(scopes: readonly BetScope[]): string {
  const labels = scopes.map(betScopeLabel);
  if (labels.length <= 1) return labels[0] ?? "Single";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** Toggle a scope in a multi-select set; always keeps at least one. */
export function toggleScope(scopes: readonly BetScope[], scope: BetScope): BetScope[] {
  if (scopesInclude(scopes, scope)) {
    if (scopes.length <= 1) return normalizeScopes(scopes);
    return normalizeScopes(scopes.filter((s) => s !== scope));
  }
  return normalizeScopes([...scopes, scope]);
}

function readScopes(...candidates: unknown[]): BetScope[] {
  for (const c of candidates) {
    if (c == null) continue;
    if (Array.isArray(c) || isBetScope(c)) return normalizeScopes(c);
  }
  return ["single"];
}

export interface PromoTermsRules {
  type: "promo_terms";
  /** Minimum decimal odds for qualifying / free bet */
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  /** Free-text must-not-forget (SNR, etc.) */
  importantNotes?: string | null;
  /** Qualifying scopes; omit / null → single only */
  qualifierScopes?: BetScope[] | null;
  /** Free-bet / reward scopes; omit / null → single only */
  rewardScopes?: BetScope[] | null;
  /** Min legs when qualifier includes acca or bet_builder */
  minSelections?: number | null;
  /** Min legs when reward includes acca or bet_builder */
  rewardMinSelections?: number | null;
  /** O1 deposit-gated promo facts */
  promoCode?: string | null;
  minDeposit?: number | null;
  depositRequired?: boolean | null;
  rewardEventLabel?: string | null;
  rewardEventDate?: string | null;
  winningsWageringX?: number | null;
  maxConversion?: number | null;
  paymentExclusions?: string[] | null;
  /** O1 completion playbook (hybrid wizard) */
  playbook?: import("@/lib/offers/offer-playbook").OfferPlaybook | null;
  /** @deprecated Prefer qualifierScopes; singular still read */
  qualifierScope?: BetScope | BetScope[] | null;
  /** @deprecated Prefer rewardScopes */
  rewardScope?: BetScope | BetScope[] | null;
  /** @deprecated Read via qualifierScopes */
  qualifierShape?: BetScope | null;
  /** @deprecated Read via rewardScopes */
  rewardShape?: BetScope | null;
}

export type OfferRulesJson = BetGetFreePlaceRules | PromoTermsRules;

export interface OfferImportantTerms {
  minOdds: number | null;
  minStake: number | null;
  maxStake: number | null;
  importantNotes: string;
  qualifierScopes: BetScope[];
  rewardScopes: BetScope[];
  minSelections: number | null;
  rewardMinSelections: number | null;
  /** O1 — deposit promo code (e.g. UEFA) */
  promoCode: string | null;
  minDeposit: number | null;
  depositRequired: boolean;
  rewardEventLabel: string | null;
  rewardEventDate: string | null;
  winningsWageringX: number | null;
  maxConversion: number | null;
  paymentExclusions: string[];
}

export function emptyImportantTerms(): OfferImportantTerms {
  return {
    minOdds: null,
    minStake: null,
    maxStake: null,
    importantNotes: "",
    qualifierScopes: ["single"],
    rewardScopes: ["single"],
    minSelections: null,
    rewardMinSelections: null,
    promoCode: null,
    minDeposit: null,
    depositRequired: false,
    rewardEventLabel: null,
    rewardEventDate: null,
    winningsWageringX: null,
    maxConversion: null,
    paymentExclusions: [],
  };
}

function parsePaymentExclusions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

function parseOptionalMoney(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function parseMinSelections(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  return n >= 2 && n <= 12 ? n : null;
}

export function parsePromoTerms(offer: Pick<OfferRow, "rules" | "offerType">): PromoTermsRules | null {
  if (!offer.rules) return null;
  try {
    const parsed = JSON.parse(offer.rules) as OfferRulesJson;
    if (parsed.type === "promo_terms") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Read important terms from any rules payload (racing or promo_terms). */
export function readImportantTerms(
  offer: Pick<OfferRow, "rules" | "offerType">
): OfferImportantTerms {
  const empty = emptyImportantTerms();
  if (!offer.rules) return empty;
  try {
    const parsed = JSON.parse(offer.rules) as OfferRulesJson & {
      minOdds?: number | null;
      minStake?: number | null;
      maxStake?: number | null;
      importantNotes?: string | null;
      qualifierScopes?: unknown;
      rewardScopes?: unknown;
      qualifierScope?: unknown;
      rewardScope?: unknown;
      qualifierShape?: unknown;
      rewardShape?: unknown;
      minSelections?: number | null;
      rewardMinSelections?: number | null;
      promoCode?: string | null;
      minDeposit?: number | null;
      depositRequired?: boolean | null;
      rewardEventLabel?: string | null;
      rewardEventDate?: string | null;
      winningsWageringX?: number | null;
      maxConversion?: number | null;
      paymentExclusions?: unknown;
    };
    return {
      minOdds: typeof parsed.minOdds === "number" ? parsed.minOdds : null,
      minStake: typeof parsed.minStake === "number" ? parsed.minStake : null,
      maxStake: typeof parsed.maxStake === "number" ? parsed.maxStake : null,
      importantNotes: typeof parsed.importantNotes === "string" ? parsed.importantNotes : "",
      promoCode: parseOptionalString(parsed.promoCode),
      minDeposit: parseOptionalMoney(parsed.minDeposit),
      depositRequired: parsed.depositRequired === true,
      rewardEventLabel: parseOptionalString(parsed.rewardEventLabel),
      rewardEventDate: parseOptionalString(parsed.rewardEventDate),
      winningsWageringX: parseOptionalMoney(parsed.winningsWageringX),
      maxConversion: parseOptionalMoney(parsed.maxConversion),
      paymentExclusions: parsePaymentExclusions(parsed.paymentExclusions),
      qualifierScopes: readScopes(
        parsed.qualifierScopes,
        parsed.qualifierScope,
        parsed.qualifierShape
      ),
      rewardScopes: readScopes(parsed.rewardScopes, parsed.rewardScope, parsed.rewardShape),
      minSelections: parseMinSelections(parsed.minSelections),
      rewardMinSelections: parseMinSelections(parsed.rewardMinSelections),
    };
  } catch {
    return empty;
  }
}

export type ImportantRulesExtras = {
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  importantNotes?: string | null;
  qualifierScopes?: BetScope[] | null;
  rewardScopes?: BetScope[] | null;
  minSelections?: number | null;
  rewardMinSelections?: number | null;
  promoCode?: string | null;
  minDeposit?: number | null;
  depositRequired?: boolean | null;
  rewardEventLabel?: string | null;
  rewardEventDate?: string | null;
  winningsWageringX?: number | null;
  maxConversion?: number | null;
  paymentExclusions?: string[] | null;
  playbook?: import("@/lib/offers/offer-playbook").OfferPlaybook | null;
};

function importantFactExtras(important: OfferImportantTerms): ImportantRulesExtras {
  return {
    promoCode: important.promoCode,
    minDeposit: important.minDeposit,
    depositRequired: important.depositRequired || undefined,
    rewardEventLabel: important.rewardEventLabel,
    rewardEventDate: important.rewardEventDate,
    winningsWageringX: important.winningsWageringX,
    maxConversion: important.maxConversion,
    paymentExclusions:
      important.paymentExclusions.length > 0 ? important.paymentExclusions : null,
  };
}

function hasPlaybookFacts(important: OfferImportantTerms): boolean {
  return (
    Boolean(important.promoCode) ||
    important.minDeposit != null ||
    important.depositRequired ||
    Boolean(important.rewardEventLabel) ||
    Boolean(important.rewardEventDate) ||
    important.winningsWageringX != null ||
    important.maxConversion != null ||
    important.paymentExclusions.length > 0
  );
}

export function mergeImportantIntoRacingRules(
  rules: BetGetFreePlaceRules,
  important: OfferImportantTerms
): BetGetFreePlaceRules & ImportantRulesExtras {
  return {
    ...rules,
    minOdds: important.minOdds,
    minStake: important.minStake,
    maxStake: important.maxStake,
    importantNotes: important.importantNotes.trim() || null,
    qualifierScopes: scopesForJson(important.qualifierScopes),
    rewardScopes: scopesForJson(important.rewardScopes),
    minSelections: scopesNeedMinSelections(important.qualifierScopes)
      ? important.minSelections
      : null,
    rewardMinSelections: scopesNeedMinSelections(important.rewardScopes)
      ? important.rewardMinSelections
      : null,
    ...importantFactExtras(important),
  };
}

export function buildPromoTermsRules(important: OfferImportantTerms): PromoTermsRules | null {
  const notes = important.importantNotes.trim();
  const qScopes = scopesForJson(important.qualifierScopes);
  const rScopes = scopesForJson(important.rewardScopes);
  if (
    important.minOdds == null &&
    important.minStake == null &&
    important.maxStake == null &&
    !notes &&
    qScopes == null &&
    rScopes == null &&
    !hasPlaybookFacts(important)
  ) {
    return null;
  }
  return {
    type: "promo_terms",
    minOdds: important.minOdds,
    minStake: important.minStake,
    maxStake: important.maxStake,
    importantNotes: notes || null,
    qualifierScopes: qScopes,
    rewardScopes: rScopes,
    minSelections: qScopes ? important.minSelections : null,
    rewardMinSelections: rScopes ? important.rewardMinSelections : null,
    ...importantFactExtras(important),
  };
}

export function formatImportantTermsSummary(terms: OfferImportantTerms): string | null {
  const parts: string[] = [];
  if (terms.promoCode) parts.push(`Code ${terms.promoCode}`);
  if (terms.minDeposit != null) parts.push(`Deposit £${terms.minDeposit}+`);
  if (!isDefaultScopes(terms.qualifierScopes)) {
    parts.push(`Qualify ${formatScopesLabel(terms.qualifierScopes)}`);
  }
  if (terms.minSelections != null && scopesNeedMinSelections(terms.qualifierScopes)) {
    parts.push(`Min ${terms.minSelections} selections`);
  }
  if (!isDefaultScopes(terms.rewardScopes)) {
    parts.push(`Reward ${formatScopesLabel(terms.rewardScopes)}`);
  }
  if (terms.rewardMinSelections != null && scopesNeedMinSelections(terms.rewardScopes)) {
    parts.push(`Reward min ${terms.rewardMinSelections}`);
  }
  if (terms.minOdds != null) parts.push(`Min odds ${formatOfferOdds(terms.minOdds)}`);
  if (terms.minStake != null) parts.push(`Min stake £${terms.minStake}`);
  if (terms.maxStake != null) parts.push(`Max stake £${terms.maxStake}`);
  if (terms.rewardEventLabel) parts.push(`FB: ${terms.rewardEventLabel}`);
  if (terms.winningsWageringX != null) {
    parts.push(`${terms.winningsWageringX}× WR on FB winnings`);
  }
  if (terms.importantNotes.trim()) parts.push(terms.importantNotes.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatOfferOdds(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Local datetime-local input value from epoch ms. */
export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local string as local time → epoch ms. */
export function fromDatetimeLocalValue(value: string): number | null {
  if (!value.trim()) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function formatOfferExpiry(ms: number | null | undefined): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${formatClockTime(d)}`;
}

/**
 * Compact card/footer expiry — date only for end-of-day (23:59) deadlines,
 * which are the common promo case. Unusual cut-off times keep the clock.
 */
export function formatOfferExpiryCompact(ms: number | null | undefined): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (d.getHours() === 23 && d.getMinutes() === 59) return date;
  return `${date}, ${formatClockTime(d)}`;
}
