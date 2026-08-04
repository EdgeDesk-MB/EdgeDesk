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
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";
import type { OfferSummary } from "@/lib/services/offers.types";

function formatOdds(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Important box content — keeps workflow notes intact (no · splitting). */
export function buildCampaignImportantDisplay(
  important: OfferImportantTerms,
  rulesSummary: string | null,
  descriptionLine: string | null
): string | null {
  const covered = `${rulesSummary ?? ""} · ${descriptionLine ?? ""}`.toLowerCase();

  const structured: string[] = [];
  if (important.minOdds != null) {
    const part = `Min odds ${formatOdds(important.minOdds)}`;
    if (!covered.includes(part.toLowerCase())) structured.push(part);
  }
  if (important.minStake != null) {
    const part = `Min stake £${important.minStake}`;
    if (!covered.includes(part.toLowerCase())) structured.push(part);
  }
  if (important.maxStake != null) {
    const part = `Max stake £${important.maxStake}`;
    if (!covered.includes(part.toLowerCase())) structured.push(part);
  }

  const notes = important.importantNotes.trim();
  const normalizedNotes = notes ? normalizeOfferDetailsText(notes) : "";
  const blocks = [...structured];
  if (normalizedNotes) blocks.push(normalizedNotes);

  if (blocks.length === 0) return null;
  if (structured.length > 0 && normalizedNotes) {
    return `${structured.join(" · ")}\n\n${normalizedNotes}`;
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

export function buildCampaignDetailsContext(offer: OfferSummary) {
  const racingRules = offer.sport === "horse_racing" ? parseOfferRules(offer) : null;
  const important = readImportantTerms(offer);
  const importantSummary = formatImportantTermsSummary(important);
  const isUkIreScope = Boolean(racingRules && isRegionalScope(offer.scopeCourse));

  const rulesSummary = racingRules
    ? formatBetGetFreePlaceSummary(racingRules, { includeRegions: !isUkIreScope })
    : null;

  const descriptionLine =
    !rulesSummary && offer.description && offer.description !== offer.title
      ? normalizeOfferDetailsText(offer.description)
      : null;

  const uniqueImportant = buildCampaignImportantDisplay(
    important,
    rulesSummary,
    descriptionLine
  );
  const scopeLine = buildCampaignScopeLine(offer, rulesSummary);

  return {
    important,
    importantSummary,
    rulesSummary,
    descriptionLine,
    uniqueImportant,
    scopeLine,
  };
}
