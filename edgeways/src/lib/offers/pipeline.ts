import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { localCalendarDate, londonWallToUtcMs } from "@/lib/events";
import { parseScopeRaceOffTime } from "@/lib/offers/offer-expiry";
import { formatClockString, formatClockTime } from "@/lib/time-format";
import type { OfferSummary } from "@/lib/services/offers.types";

export type OfferPipelineStage =
  | "planned"
  | "qualifying"
  | "awaiting"
  | "awarded"
  | "converting"
  | "completed"
  | "settled"
  | "expired";

export const OFFER_PIPELINE_STAGES: {
  id: OfferPipelineStage;
  label: string;
}[] = [
  { id: "planned", label: "Planned" },
  { id: "qualifying", label: "Qualifying" },
  { id: "awaiting", label: "Awaiting result" },
  { id: "awarded", label: "Free bet awarded" },
  { id: "converting", label: "Converting" },
  { id: "completed", label: "Completed" },
  { id: "settled", label: "Settled" },
];

/** Progress UI steps — planned is implicit (offer exists) and omitted from the bar. */
export const OFFER_PIPELINE_PROGRESS_STAGES = OFFER_PIPELINE_STAGES.filter(
  (s) => s.id !== "planned"
);

export function pipelineProgressIndex(stage: OfferPipelineStage): number {
  if (stage === "planned" || stage === "expired") return -1;
  const idx = OFFER_PIPELINE_PROGRESS_STAGES.findIndex((s) => s.id === stage);
  return idx >= 0 ? idx : 0;
}

export type TerminalPipelineStage = "completed" | "settled";

/** Terminal stages — no progress bar; show status chip instead. */
export function isTerminalPipelineStage(
  stage: OfferPipelineStage
): stage is TerminalPipelineStage {
  return stage === "completed" || stage === "settled";
}

/** Map offer + profit breakdown to a campaign pipeline stage. */
export function deriveOfferPipelineStage(offer: OfferSummary): OfferPipelineStage {
  if (offer.status === "expired") return "expired";

  const { profit } = offer;

  // Financial closure — free-bet (or linked) legs have results and P&L is final.
  if (profit.freeBetStage === "settled") return "settled";

  // Campaign marked complete — workflow done; may still await a future result.
  if (offer.status === "completed") return "completed";

  if (profit.freeBetStage === "in_use") return "converting";
  if (profit.freeBetStage === "awarded") return "awarded";
  if (profit.freeBetStage === "awaiting_result") return "awaiting";
  if (profit.qualifyingOpenCount > 0) return "qualifying";
  if (profit.qualifyingSettledCount > 0 && profit.freeBetStage === "not_awarded") {
    return "awaiting";
  }
  if (profit.qualifyingSettledCount > 0 || profit.qualifyingOpenCount > 0) {
    return "qualifying";
  }
  if (offer.status === "planned" || offer.betCount === 0) return "planned";
  return "qualifying";
}

export function offerPipelineHasStarted(offer: OfferSummary): boolean {
  return deriveOfferPipelineStage(offer) !== "planned";
}

export function pipelineStageIndex(stage: OfferPipelineStage): number {
  if (stage === "expired") return -1;
  const idx = OFFER_PIPELINE_STAGES.findIndex((s) => s.id === stage);
  return idx >= 0 ? idx : 0;
}

function relativeEventDayPhrase(
  eventDate: string | null | undefined,
  now = Date.now()
): string | null {
  const ymd = eventDate?.trim();
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const today = localCalendarDate(new Date(now));
  if (ymd === today) return "today";
  const noon = londonWallToUtcMs(today, "12:00") ?? now;
  const tomorrow = localCalendarDate(new Date(noon + 86_400_000));
  if (ymd === tomorrow) return "tomorrow";
  return null;
}

export type AwaitingBetLike = {
  status: string;
  eventId?: number | null;
  purpose?: string | null;
};

/** Soonest open (non-mug) bet event — the result we are actually waiting on. */
export function earliestOpenBetEventAt(
  bets: readonly AwaitingBetLike[],
  eventsById: ReadonlyMap<number, { startTime: number }>
): number | null {
  let earliest: number | null = null;
  for (const bet of bets) {
    if (bet.status !== "open" || bet.purpose === "mug" || bet.eventId == null) continue;
    const start = eventsById.get(bet.eventId)?.startTime;
    if (start == null || !Number.isFinite(start)) continue;
    if (earliest == null || start < earliest) earliest = start;
  }
  return earliest;
}

function formatAwaitingAt(atMs: number, eventDate: string | null | undefined, now: number): string {
  const time = formatClockTime(atMs, { timeZone: DEFAULT_DISPLAY_TIMEZONE });
  const ymd = localCalendarDate(new Date(atMs));
  const day = relativeEventDayPhrase(ymd || eventDate, now);
  return day ? `Awaiting result at ${time} ${day}` : `Awaiting result at ${time}`;
}

/**
 * User-facing copy for the awaiting pipeline stage.
 * Prefer the open bet's off-time, then a race-scoped label
 * ("Awaiting result at 13:50 today").
 */
export function formatAwaitingResultLabel(
  offer: Pick<OfferSummary, "scopeRaceLabel" | "eventDate"> & {
    awaitingEventAt?: number | null;
  },
  now = Date.now()
): string {
  if (offer.awaitingEventAt != null && Number.isFinite(offer.awaitingEventAt)) {
    return formatAwaitingAt(offer.awaitingEventAt, offer.eventDate, now);
  }
  const off = parseScopeRaceOffTime(offer.scopeRaceLabel);
  if (!off) return "Awaiting result";
  const hhmm = `${String(off.hours).padStart(2, "0")}:${String(off.minutes).padStart(2, "0")}`;
  const time = formatClockString(hhmm);
  const day = relativeEventDayPhrase(offer.eventDate, now);
  return day ? `Awaiting result at ${time} ${day}` : `Awaiting result at ${time}`;
}

/** Stage label for UI — awaiting includes race time when known. */
export function formatOfferPipelineStageLabel(
  offer: OfferSummary,
  stage: OfferPipelineStage = deriveOfferPipelineStage(offer),
  now = Date.now()
): string {
  if (stage === "expired") return "Expired";
  if (stage === "awaiting") return formatAwaitingResultLabel(offer, now);
  return OFFER_PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
}
