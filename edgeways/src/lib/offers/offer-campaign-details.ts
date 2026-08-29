import { formatOfferEventDay } from "@/lib/offers/offer-list-groups";
import {
  formatBetGetFreePlaceSummary,
  formatOfferScopeLabel,
  isRegionalScope,
  parseOfferRules,
} from "@/lib/offers/racing-offer-rules";
import {
  formatImportantTermsSummary,
  readImportantTerms,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";
import {
  currentPlaybookStep,
  playbookFromOffer,
} from "@/lib/offers/offer-playbook";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";
import type { OfferSummary } from "@/lib/services/offers.types";

function formatOdds(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export type CampaignImportantDisplayOptions = {
  /** Copy already shown above Details (playbook step, next-action detail). */
  alreadyShown?: Array<string | null | undefined>;
  /** Playbook owns the workflow — drop pasted "How to match" blocks. */
  stripHowToMatch?: boolean;
};

/**
 * Strip Important note bullets that repeat structured fields or copy already
 * shown in the Steps / next-action band.
 */
export function filterImportantNotesForDisplay(
  notes: string,
  important: OfferImportantTerms,
  options?: CampaignImportantDisplayOptions
): string {
  let text = normalizeOfferDetailsText(notes.trim());
  if (!text) return "";

  if (options?.stripHowToMatch) {
    text = (text.split(/\n\s*How to match:/i)[0] ?? text).trim();
  }

  const already = (options?.alreadyShown ?? [])
    .filter((s): s is string => Boolean(s?.trim()))
    .map((s) => normalizeCampaignCompare(s));

  const paragraphs = text.split(/\n\n+/);
  const head = paragraphs[0] ?? "";
  const tail = paragraphs.slice(1).join("\n\n").trim();

  const kept = head
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((seg) => {
      const n = normalizeCampaignCompare(seg);
      if (!n) return false;

      if (important.promoCode && /\bpromo\s*code\b/i.test(seg)) return false;
      if (
        (important.minDeposit != null || important.depositRequired) &&
        /^\s*deposit\b/i.test(seg)
      ) {
        return false;
      }
      if (
        (important.depositRequired || Boolean(important.promoCode?.trim())) &&
        /\bopt-?in\s+required\b/i.test(seg)
      ) {
        return false;
      }

      for (const shown of already) {
        if (shown === n) return false;
        if (n.length >= 16 && shown.includes(n)) return false;
        if (shown.length >= 16 && n.includes(shown)) return false;
      }
      return true;
    });

  const headOut = kept.join(" · ");
  return [headOut, tail].filter(Boolean).join("\n\n");
}

/** Important box content — residual facts only; no · splitting of workflow blocks. */
export function buildCampaignImportantDisplay(
  important: OfferImportantTerms,
  rulesSummary: string | null,
  descriptionLine: string | null,
  options?: CampaignImportantDisplayOptions
): string | null {
  const covered = `${rulesSummary ?? ""} · ${descriptionLine ?? ""} · ${(
    options?.alreadyShown ?? []
  ).join(" · ")}`.toLowerCase();

  const structured: string[] = [];
  if (important.minOdds != null) {
    const part = `Min odds ${formatOdds(important.minOdds)}`;
    const oddsTok = formatOdds(important.minOdds).toLowerCase();
    // Step title may say "(min odds 1.5)" without the "Min odds" label.
    if (
      !covered.includes(part.toLowerCase()) &&
      !covered.includes(`min odds ${oddsTok}`)
    ) {
      structured.push(part);
    }
  }
  if (important.minStake != null) {
    const part = `Min stake £${important.minStake}`;
    const stakeTok = String(important.minStake);
    // Qualify title "Place £20 qualifying bet" already carries the stake.
    if (
      !covered.includes(part.toLowerCase()) &&
      !covered.includes(`£${stakeTok} qualifying`) &&
      !covered.includes(`place £${stakeTok}`)
    ) {
      structured.push(part);
    }
  }
  if (important.maxStake != null) {
    const part = `Max stake £${important.maxStake}`;
    if (!covered.includes(part.toLowerCase())) structured.push(part);
  }

  const notes = important.importantNotes.trim();
  const filteredNotes = notes
    ? filterImportantNotesForDisplay(notes, important, options)
    : "";

  const blocks = [...structured];
  if (filteredNotes) blocks.push(filteredNotes);

  if (blocks.length === 0) return null;
  if (structured.length > 0 && filteredNotes) {
    return `${structured.join(" · ")}\n\n${filteredNotes}`;
  }
  return blocks.join(structured.length > 0 ? " · " : "");
}

/** Scope line under details — hides parser junk like "any" and redundant UK labels. */
export function buildCampaignScopeLine(
  offer: OfferSummary,
  rulesSummary: string | null
): string | null {
  if (offer.sport !== "horse_racing") return null;

  const scopeLabel = formatOfferScopeLabel(offer.scopeCourse, offer.scopeRaceLabel);
  const eventDayLabel = formatOfferEventDay(offer.eventDate);
  const expiryMs = effectiveOfferExpiryMs(offer);
  const expiryDayYmd =
    expiryMs != null
      ? (() => {
          const d = new Date(expiryMs);
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        })()
      : null;
  const showEventDay =
    Boolean(eventDayLabel) &&
    Boolean(offer.eventDate) &&
    (expiryDayYmd == null || expiryDayYmd !== offer.eventDate!.trim());

  const parts = [scopeLabel, showEventDay ? eventDayLabel : null].filter(Boolean) as string[];
  if (parts.length === 0) return null;

  const line = parts.join(" · ");
  if (/^any$/i.test(line.trim())) return null;
  if (line === "UK & Ireland" && rulesSummary?.includes("GB & IRE")) return null;
  if (scopeLabel === "UK & Ireland" && !showEventDay && rulesSummary?.includes("GB & IRE")) {
    return null;
  }
  return line;
}

function normalizeCampaignCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when two detail blocks would read as the same copy on the card. */
export function campaignDetailTextsOverlap(a: string, b: string): boolean {
  const na = normalizeCampaignCompare(a);
  const nb = normalizeCampaignCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return shorter.length >= 32 && longer.includes(shorter);
}

/**
 * A11y / modal chrome helper. Visible dialog subtitle was removed (duplicated
 * the card title). Kept exported so Turbopack HMR never leaves a dangling
 * `buildCampaignDialogDescription` call unbound after a partial refresh.
 */
export function buildCampaignDialogDescription(
  offerTitle: string,
  _nextActionLabel?: string | null
): string {
  return offerTitle;
}

export function buildCampaignDetailsContext(offer: OfferSummary) {
  const racingRules = offer.sport === "horse_racing" ? parseOfferRules(offer) : null;
  const important = readImportantTerms(offer);
  const importantSummary = formatImportantTermsSummary(important);
  const isUkIreScope = Boolean(racingRules && isRegionalScope(offer.scopeCourse));

  const rulesSummary = racingRules
    ? formatBetGetFreePlaceSummary(racingRules, { includeRegions: !isUkIreScope })
    : null;

  const rawPb = playbookFromOffer(offer);
  const playbookStep =
    rawPb && offer.status !== "completed" && offer.status !== "expired"
      ? currentPlaybookStep(rawPb)
      : null;
  const playbookActive =
    playbookStep != null && playbookStep.kind !== "done";

  const descriptionLine =
    !rulesSummary &&
    !playbookActive &&
    offer.description &&
    offer.description !== offer.title
      ? normalizeOfferDetailsText(offer.description)
      : null;

  const uniqueImportant = buildCampaignImportantDisplay(
    important,
    rulesSummary,
    descriptionLine,
    {
      alreadyShown: playbookActive
        ? [playbookStep.title, playbookStep.detail]
        : [],
      stripHowToMatch: playbookActive,
    }
  );
  const scopeLine = buildCampaignScopeLine(offer, rulesSummary);

  let resolvedRulesSummary = rulesSummary;
  let resolvedDescriptionLine = descriptionLine;
  if (uniqueImportant) {
    if (resolvedRulesSummary && campaignDetailTextsOverlap(resolvedRulesSummary, uniqueImportant)) {
      resolvedRulesSummary = null;
    }
    if (
      resolvedDescriptionLine &&
      campaignDetailTextsOverlap(resolvedDescriptionLine, uniqueImportant)
    ) {
      resolvedDescriptionLine = null;
    }
  }

  return {
    important,
    importantSummary,
    rulesSummary: resolvedRulesSummary,
    descriptionLine: resolvedDescriptionLine,
    uniqueImportant,
    scopeLine,
    playbookActive,
  };
}
