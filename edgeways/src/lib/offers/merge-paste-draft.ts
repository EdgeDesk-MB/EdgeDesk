/**
 * Provenance-aware merge of parsed paste drafts into offer / casino forms.
 * empty → paste may fill; paste → later paste may refresh; user → never overwrite.
 */

import {
  offerCategoryById,
  type OfferCategoryId,
} from "@/lib/offers/offer-categories";
import {
  isDefaultScopes,
  type BetScope,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";
import type { ParsedOfferDraft } from "@/lib/offers/parse-offer-text";
import type { ParsedCasinoOfferDraft } from "@/lib/offers/parse-casino-offer-text";

export type PasteProvenance = "empty" | "paste" | "user";

export type OfferPasteFieldKey =
  | "category"
  | "title"
  | "bookmaker"
  | "expected"
  | "expiresAtMs"
  | "startsOn"
  | "minOdds"
  | "minStake"
  | "maxStake"
  | "importantNotes"
  | "promoCode"
  | "minDeposit"
  | "depositRequired"
  | "rewardEventLabel"
  | "rewardEventDate"
  | "winningsWageringX"
  | "maxConversion"
  | "paymentExclusions"
  | "qualifierScopes"
  | "rewardScopes"
  | "minSelections"
  | "rewardMinSelections"
  | "betStake"
  | "freeBetAmount"
  | "minRunners"
  | "qualifyingPlaces"
  | "winnerMustBeSpFavourite"
  | "minFavouriteSpOdds"
  | "resultConditional"
  | "scopeMode"
  | "scopeCourse"
  | "preferredOffTime"
  | "scopeRegions"
  | "eventDate";

export type OfferPasteFormSlice = {
  category: OfferCategoryId;
  title: string;
  bookmaker: string;
  expected: string;
  expiresAtMs: number | null;
  startsOn: string;
  minOdds: string;
  minStake: string;
  maxStake: string;
  importantNotes: string;
  promoCode: string;
  minDeposit: string;
  depositRequired: boolean;
  rewardEventLabel: string;
  rewardEventDate: string;
  winningsWageringX: string;
  maxConversion: string;
  paymentExclusions: string[];
  qualifierScopes: BetScope[];
  rewardScopes: BetScope[];
  minSelections: string;
  rewardMinSelections: string;
  betStake: string;
  freeBetAmount: string;
  minRunners: string;
  qualifyingPlaces: number[];
  winnerMustBeSpFavourite: boolean;
  minFavouriteSpOdds: string;
  resultConditional: boolean;
  scopeMode: "uk_ire" | "course" | "race";
  scopeCourse: string;
  preferredOffTime: string | null;
  scopeRegions: Array<"GB" | "IRE">;
  eventDate: string;
};

export type OfferPasteProvenance = Partial<Record<OfferPasteFieldKey, PasteProvenance>>;

export type CasinoPasteFieldKey = "casino" | "title" | "draft";

export type CasinoPasteFormSlice = {
  casino: string;
  title: string;
  draft: ParsedCasinoOfferDraft | null;
};

export type CasinoPasteProvenance = Partial<Record<CasinoPasteFieldKey, PasteProvenance>>;

function canWrite(p: PasteProvenance | undefined): boolean {
  return p == null || p === "empty" || p === "paste";
}

function strEmpty(v: string): boolean {
  return !v.trim();
}

function mergeString(
  key: OfferPasteFieldKey,
  current: string,
  next: string | null | undefined,
  provenance: OfferPasteProvenance,
  outProv: OfferPasteProvenance
): string {
  const hasNext = next != null && String(next).trim() !== "";
  if (!hasNext || !canWrite(provenance[key])) {
    outProv[key] = provenance[key] ?? (strEmpty(current) ? "empty" : "user");
    return current;
  }
  outProv[key] = "paste";
  return String(next).trim();
}

function mergeBool(
  key: OfferPasteFieldKey,
  current: boolean,
  next: boolean | null | undefined,
  provenance: OfferPasteProvenance,
  outProv: OfferPasteProvenance,
  /** Only write when next is true, or when refreshing a paste-owned field */
  preferTrue = true
): boolean {
  if (next == null || !canWrite(provenance[key])) {
    outProv[key] = provenance[key] ?? (current ? "user" : "empty");
    return current;
  }
  if (preferTrue && !next && provenance[key] !== "paste") {
    outProv[key] = provenance[key] ?? "empty";
    return current;
  }
  outProv[key] = "paste";
  return next;
}

function mergeNumberList(
  key: OfferPasteFieldKey,
  current: number[],
  next: number[] | null | undefined,
  provenance: OfferPasteProvenance,
  outProv: OfferPasteProvenance
): number[] {
  if (!next?.length || !canWrite(provenance[key])) {
    outProv[key] = provenance[key] ?? (current.length ? "user" : "empty");
    return current;
  }
  outProv[key] = "paste";
  return [...next];
}

function mergeStringList(
  key: OfferPasteFieldKey,
  current: string[],
  next: string[] | null | undefined,
  provenance: OfferPasteProvenance,
  outProv: OfferPasteProvenance
): string[] {
  if (!next?.length || !canWrite(provenance[key])) {
    outProv[key] = provenance[key] ?? (current.length ? "user" : "empty");
    return current;
  }
  outProv[key] = "paste";
  return [...next];
}

function sameScopes(a: BetScope[], b: BetScope[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort().join(",");
  const bs = [...b].sort().join(",");
  return as === bs;
}

/** Scopes: write non-default paste shapes; keep default Single without a paste tick. */
function mergeScopeList(
  key: "qualifierScopes" | "rewardScopes",
  current: BetScope[],
  next: BetScope[] | null | undefined,
  provenance: OfferPasteProvenance,
  outProv: OfferPasteProvenance
): BetScope[] {
  if (!next?.length || !canWrite(provenance[key])) {
    outProv[key] = provenance[key] ?? (current.length ? "user" : "empty");
    return current;
  }
  if (isDefaultScopes(next) && isDefaultScopes(current)) {
    outProv[key] = provenance[key] === "paste" ? "paste" : "empty";
    return current;
  }
  if (isDefaultScopes(next) && !sameScopes(current, next) && provenance[key] !== "paste") {
    // Parser stayed on default; don't overwrite a user multi-select with Single.
    outProv[key] = provenance[key] ?? "user";
    return current;
  }
  outProv[key] = "paste";
  return [...next];
}

/** Cap Important notes for the form — structured fields hold the facts. */
export function trimImportantNotesForForm(notes: string, maxSteps = 4): string {
  const raw = notes.trim();
  if (!raw) return "";
  const [head, ...rest] = raw.split(/\n\s*How to match:\s*\n/i);
  const hints = (head ?? "")
    .split(/\n+/)
    .flatMap((line) => line.split(" · "))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 120)
    .filter((s) => !/add our email|contacts list|progressplay\.com/i.test(s))
    .slice(0, 6);
  const hintLine = hints.join(" · ").slice(0, 220);
  const workflow = rest.join("\n").trim();
  if (!workflow) return hintLine;
  const steps = workflow
    .split(/\n+/)
    .map((s) => s.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxSteps)
    .map((s, i) => `${i + 1}. ${s.slice(0, 100)}`);
  if (steps.length === 0) return hintLine;
  const block = `How to match:\n${steps.join("\n")}`;
  return hintLine ? `${hintLine}\n\n${block}` : block;
}

export function draftToOfferFormPatch(
  draft: ParsedOfferDraft,
  isRacing: boolean
): Partial<OfferPasteFormSlice> {
  const imp = draft.important;
  const patch: Partial<OfferPasteFormSlice> = {
    category: draft.category,
    title: draft.title,
    bookmaker: draft.bookmaker ?? "",
    expected: draft.expectedProfit != null ? String(draft.expectedProfit) : "",
    expiresAtMs: draft.expiresAt,
    startsOn: draft.startsOn ?? "",
    minOdds: imp.minOdds != null ? String(imp.minOdds) : "",
    minStake:
      imp.minStake != null
        ? String(imp.minStake)
        : draft.betStake != null
          ? String(draft.betStake)
          : "",
    maxStake: imp.maxStake != null ? String(imp.maxStake) : "",
    importantNotes: trimImportantNotesForForm(imp.importantNotes),
    promoCode: imp.promoCode ?? "",
    minDeposit: imp.minDeposit != null ? String(imp.minDeposit) : "",
    depositRequired: imp.depositRequired,
    rewardEventLabel: imp.rewardEventLabel ?? "",
    rewardEventDate: imp.rewardEventDate ?? "",
    winningsWageringX: imp.winningsWageringX != null ? String(imp.winningsWageringX) : "",
    maxConversion: imp.maxConversion != null ? String(imp.maxConversion) : "",
    paymentExclusions: [...imp.paymentExclusions],
    qualifierScopes: [...imp.qualifierScopes],
    rewardScopes: [...imp.rewardScopes],
    minSelections: imp.minSelections != null ? String(imp.minSelections) : "",
    rewardMinSelections:
      imp.rewardMinSelections != null ? String(imp.rewardMinSelections) : "",
  };

  if (isRacing) {
    const pastedPlaces = draft.qualifyingPlaces;
    const pastedSpFav = draft.rules?.winnerMustBeSpFavourite === true;
    patch.betStake = draft.betStake != null ? String(draft.betStake) : "";
    patch.freeBetAmount = draft.freeBetAmount != null ? String(draft.freeBetAmount) : "";
    patch.minRunners = draft.minRunners != null ? String(draft.minRunners) : "8";
    patch.qualifyingPlaces =
      pastedPlaces.length > 0 ? pastedPlaces : pastedSpFav ? [2] : [];
    patch.winnerMustBeSpFavourite = pastedSpFav;
    patch.minFavouriteSpOdds =
      draft.rules?.minFavouriteSpOdds != null && draft.rules.minFavouriteSpOdds > 1
        ? String(draft.rules.minFavouriteSpOdds)
        : "";
    patch.resultConditional = pastedPlaces.length > 0 || pastedSpFav;
    patch.scopeMode = draft.scopeMode;
    patch.scopeCourse = draft.scopeCourse;
    patch.preferredOffTime = draft.preferredOffTime;
    patch.scopeRegions =
      draft.scopeRegions.length > 0 ? draft.scopeRegions : ["GB", "IRE"];
    patch.eventDate = draft.eventDate ?? "";
  }

  return patch;
}

export function mergeOfferPasteDraft(
  form: OfferPasteFormSlice,
  draft: ParsedOfferDraft,
  provenance: OfferPasteProvenance
): { form: OfferPasteFormSlice; provenance: OfferPasteProvenance; filledCount: number } {
  const racing =
    offerCategoryById(draft.category).isRacing ||
    offerCategoryById(form.category).isRacing;
  const patch = draftToOfferFormPatch(draft, racing);
  const outProv: OfferPasteProvenance = { ...provenance };
  const next: OfferPasteFormSlice = { ...form };

  const assignStr = (key: OfferPasteFieldKey, cur: string, val: string | undefined) => {
    const v = mergeString(key, cur, val, provenance, outProv);
    (next as Record<string, unknown>)[key] = v;
  };

  assignStr("title", form.title, patch.title);
  assignStr("bookmaker", form.bookmaker, patch.bookmaker);
  assignStr("expected", form.expected, patch.expected);
  assignStr("startsOn", form.startsOn, patch.startsOn);
  assignStr("minOdds", form.minOdds, patch.minOdds);
  assignStr("minStake", form.minStake, patch.minStake);
  assignStr("maxStake", form.maxStake, patch.maxStake);
  assignStr("importantNotes", form.importantNotes, patch.importantNotes);
  assignStr("promoCode", form.promoCode, patch.promoCode);
  assignStr("minDeposit", form.minDeposit, patch.minDeposit);
  assignStr("rewardEventLabel", form.rewardEventLabel, patch.rewardEventLabel);
  assignStr("rewardEventDate", form.rewardEventDate, patch.rewardEventDate);
  assignStr("winningsWageringX", form.winningsWageringX, patch.winningsWageringX);
  assignStr("maxConversion", form.maxConversion, patch.maxConversion);
  assignStr("minSelections", form.minSelections, patch.minSelections);
  assignStr("rewardMinSelections", form.rewardMinSelections, patch.rewardMinSelections);

  if (canWrite(provenance.category) && patch.category) {
    next.category = patch.category;
    outProv.category = "paste";
  } else {
    outProv.category = provenance.category ?? "empty";
  }

  if (patch.expiresAtMs != null && canWrite(provenance.expiresAtMs)) {
    next.expiresAtMs = patch.expiresAtMs;
    outProv.expiresAtMs = "paste";
  } else {
    outProv.expiresAtMs =
      provenance.expiresAtMs ?? (form.expiresAtMs != null ? "user" : "empty");
  }

  next.depositRequired = mergeBool(
    "depositRequired",
    form.depositRequired,
    patch.depositRequired,
    provenance,
    outProv,
    true
  );

  next.paymentExclusions = mergeStringList(
    "paymentExclusions",
    form.paymentExclusions,
    patch.paymentExclusions,
    provenance,
    outProv
  ) as string[];

  // Only claim paste on scopes when the parser found a non-default shape
  // (Acca / Bet builder). Default Single alone is not a paste signal.
  next.qualifierScopes = mergeScopeList(
    "qualifierScopes",
    form.qualifierScopes,
    patch.qualifierScopes,
    provenance,
    outProv
  );
  next.rewardScopes = mergeScopeList(
    "rewardScopes",
    form.rewardScopes,
    patch.rewardScopes,
    provenance,
    outProv
  );

  if (racing) {
    assignStr("betStake", form.betStake, patch.betStake);
    assignStr("freeBetAmount", form.freeBetAmount, patch.freeBetAmount);
    assignStr("minRunners", form.minRunners, patch.minRunners);
    assignStr("minFavouriteSpOdds", form.minFavouriteSpOdds, patch.minFavouriteSpOdds);
    assignStr("scopeCourse", form.scopeCourse, patch.scopeCourse);
    assignStr("eventDate", form.eventDate, patch.eventDate);

    next.qualifyingPlaces = mergeNumberList(
      "qualifyingPlaces",
      form.qualifyingPlaces,
      patch.qualifyingPlaces,
      provenance,
      outProv
    );
    next.winnerMustBeSpFavourite = mergeBool(
      "winnerMustBeSpFavourite",
      form.winnerMustBeSpFavourite,
      patch.winnerMustBeSpFavourite,
      provenance,
      outProv,
      false
    );
    next.resultConditional = mergeBool(
      "resultConditional",
      form.resultConditional,
      patch.resultConditional,
      provenance,
      outProv,
      false
    );
    if (patch.scopeMode && canWrite(provenance.scopeMode)) {
      next.scopeMode = patch.scopeMode;
      outProv.scopeMode = "paste";
    } else {
      outProv.scopeMode = provenance.scopeMode ?? "empty";
    }
    if (patch.preferredOffTime != null && canWrite(provenance.preferredOffTime)) {
      next.preferredOffTime = patch.preferredOffTime;
      outProv.preferredOffTime = "paste";
    } else {
      outProv.preferredOffTime =
        provenance.preferredOffTime ?? (form.preferredOffTime ? "user" : "empty");
    }
    next.scopeRegions = mergeStringList(
      "scopeRegions",
      form.scopeRegions,
      patch.scopeRegions,
      provenance,
      outProv
    ) as Array<"GB" | "IRE">;
  }

  const filledCount = Object.values(outProv).filter((p) => p === "paste").length;
  return { form: next, provenance: outProv, filledCount };
}

export function markOfferFieldUser(
  provenance: OfferPasteProvenance,
  key: OfferPasteFieldKey
): OfferPasteProvenance {
  return { ...provenance, [key]: "user" };
}

export function countPasteFields(
  provenance: OfferPasteProvenance | CasinoPasteProvenance
): number {
  return Object.values(provenance).filter((p) => p === "paste").length;
}

export function mergeCasinoPasteDraft(
  form: CasinoPasteFormSlice,
  draft: ParsedCasinoOfferDraft,
  provenance: CasinoPasteProvenance
): { form: CasinoPasteFormSlice; provenance: CasinoPasteProvenance; filledCount: number } {
  const outProv: CasinoPasteProvenance = { ...provenance };
  const next: CasinoPasteFormSlice = { ...form };

  if (draft.casino?.trim() && canWrite(provenance.casino)) {
    next.casino = draft.casino.trim();
    outProv.casino = "paste";
  } else {
    outProv.casino = provenance.casino ?? (strEmpty(form.casino) ? "empty" : "user");
  }

  if (draft.title.trim() && canWrite(provenance.title)) {
    next.title = draft.title.trim();
    outProv.title = "paste";
  } else {
    outProv.title = provenance.title ?? (strEmpty(form.title) ? "empty" : "user");
  }

  if (canWrite(provenance.draft)) {
    next.draft = draft;
    outProv.draft = "paste";
  } else {
    outProv.draft = provenance.draft ?? (form.draft ? "user" : "empty");
  }

  const filledCount = Object.values(outProv).filter((p) => p === "paste").length;
  return { form: next, provenance: outProv, filledCount };
}

export function markCasinoFieldUser(
  provenance: CasinoPasteProvenance,
  key: CasinoPasteFieldKey
): CasinoPasteProvenance {
  return { ...provenance, [key]: "user" };
}

/** For tests / Important apply helpers */
export function importantTermsFromPasteSlice(
  slice: Pick<
    OfferPasteFormSlice,
    | "minOdds"
    | "minStake"
    | "maxStake"
    | "importantNotes"
    | "qualifierScopes"
    | "rewardScopes"
    | "minSelections"
    | "rewardMinSelections"
    | "promoCode"
    | "minDeposit"
    | "depositRequired"
    | "rewardEventLabel"
    | "rewardEventDate"
    | "winningsWageringX"
    | "maxConversion"
    | "paymentExclusions"
  >
): OfferImportantTerms {
  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  return {
    minOdds: num(slice.minOdds),
    minStake: num(slice.minStake),
    maxStake: num(slice.maxStake),
    importantNotes: slice.importantNotes,
    qualifierScopes: slice.qualifierScopes,
    rewardScopes: slice.rewardScopes,
    minSelections: (() => {
      const n = parseInt(slice.minSelections, 10);
      return Number.isFinite(n) && n >= 2 ? n : null;
    })(),
    rewardMinSelections: (() => {
      const n = parseInt(slice.rewardMinSelections, 10);
      return Number.isFinite(n) && n >= 2 ? n : null;
    })(),
    promoCode: slice.promoCode.trim() || null,
    minDeposit: num(slice.minDeposit),
    depositRequired: slice.depositRequired,
    rewardEventLabel: slice.rewardEventLabel.trim() || null,
    rewardEventDate: slice.rewardEventDate.trim() || null,
    winningsWageringX: num(slice.winningsWageringX),
    maxConversion: num(slice.maxConversion),
    paymentExclusions: slice.paymentExclusions,
  };
}
