/**
 * When an offer alert should interrupt: closer to impact, not on create.
 *
 * Racing course/race scope → ~15 min before the first relevant off.
 * Hard promo expiry (no race times) → ~2 h before deadline.
 */

import {
  effectiveOfferExpiryMs,
  parseScopeRaceOffTime,
  ukDateTimeToUtcMs,
} from "@/lib/offers/offer-expiry";
import {
  courseMatchesScope,
  isRegionalScope,
  parseScopeCourses,
} from "@/lib/offers/racing-offer-rules";
import { formatClockTime } from "@/lib/time-format";

/** Lead before a race / first course off. Matches race_off_soon. */
export const OFFER_RACE_LEAD_MS = 15 * 60_000;
/** Lead before a calendar / promo hard deadline with no race impact. */
export const OFFER_EXPIRY_LEAD_MS = 2 * 60 * 60_000;

export type OfferImpactSource = "edge" | "race" | "course" | "expiry";

export interface OfferImpactOffer {
  id: number;
  title: string;
  sport: string | null;
  eventDate: string | null;
  scopeCourse: string | null;
  scopeRaceId: string | null;
  scopeRaceLabel: string | null;
  expiresAt: number | null;
}

export interface OfferImpactRace {
  course: string;
  offTime: number;
}

export interface OfferImpact {
  at: number;
  source: OfferImpactSource;
  /** Course or short place label for copy, when known */
  label: string | null;
}

function isHorseRacing(sport: string | null | undefined): boolean {
  return sport === "horse_racing";
}

export type OfferImpactActionKind =
  | "place_qualifying"
  | "convert_free_bet"
  | "start_planned"
  | "review_expiry"
  | string;

/**
 * Resolve the moment the user should act for this offer.
 * Qualifying / start → race or first course off.
 * Convert / review expiry → hard promo deadline (the free bet clock).
 */
export function resolveOfferImpact(
  offer: OfferImpactOffer,
  races: OfferImpactRace[],
  edgeStartTime?: number | null,
  actionKind?: OfferImpactActionKind | null
): OfferImpact | null {
  const expiryOnly =
    actionKind === "convert_free_bet" || actionKind === "review_expiry";
  if (expiryOnly) {
    const expiry = effectiveOfferExpiryMs(offer);
    if (expiry == null) return null;
    return { at: expiry, source: "expiry", label: null };
  }

  if (edgeStartTime != null && edgeStartTime > 0) {
    const courses = parseScopeCourses(offer.scopeCourse);
    return {
      at: edgeStartTime,
      source: "edge",
      label: courses[0] ?? null,
    };
  }

  if (isHorseRacing(offer.sport)) {
    const ymd = offer.eventDate?.trim();
    const off = parseScopeRaceOffTime(offer.scopeRaceLabel);
    if (ymd && off && (offer.scopeRaceId?.trim() || offer.scopeRaceLabel?.trim())) {
      const at = ukDateTimeToUtcMs(ymd, off.hours, off.minutes);
      if (at != null) {
        const courses = parseScopeCourses(offer.scopeCourse);
        return {
          at,
          source: "race",
          label: courses[0] ?? null,
        };
      }
    }

    if (!isRegionalScope(offer.scopeCourse)) {
      const matching = races
        .filter((r) => courseMatchesScope(r.course, offer.scopeCourse))
        .map((r) => r.offTime)
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
      if (matching.length > 0) {
        // First race at the course marks meeting impact. If already past, the
        // in-play path still nudges once while the promo window is open.
        const courses = parseScopeCourses(offer.scopeCourse);
        return {
          at: matching[0]!,
          source: "course",
          label: courses[0] ?? null,
        };
      }
    }
  }

  const expiry = effectiveOfferExpiryMs(offer);
  if (expiry == null) return null;
  return { at: expiry, source: "expiry", label: null };
}

/** True when now sits in the useful reminder window for this impact. */
export function isOfferImpactAlertDue(
  impact: OfferImpact,
  now: number,
  hardExpiryMs: number | null
): boolean {
  const until = impact.at - now;
  const lead =
    impact.source === "expiry" ? OFFER_EXPIRY_LEAD_MS : OFFER_RACE_LEAD_MS;

  if (until > lead) return false; // too early
  if (until > 0) return true; // inside lead-up window

  // Impact already passed: still remind while the promo/window is open so a
  // mid-meeting create (or late open) gets one useful nudge, not silence.
  if (hardExpiryMs != null && now >= hardExpiryMs) return false;
  return true;
}

export function offerExpiringAlertCopy(args: {
  remainingEv: number;
  offerTitle: string;
  impact: OfferImpact;
  now: number;
}): { title: string; body: string } {
  const pounds = Math.max(0, Math.round(args.remainingEv));
  const until = args.impact.at - args.now;
  const place = args.impact.label?.trim() || null;

  if (args.impact.source !== "expiry" && until > 0) {
    const mins = Math.max(1, Math.round(until / 60_000));
    const where = place ?? "Meeting";
    return {
      title: `⚡ £${pounds} edge · ${where} in ${mins} min`,
      body: `${args.offerTitle} · place the qualifying bet`,
    };
  }

  if (args.impact.source !== "expiry" && until <= 0) {
    const where = place ?? "Meeting";
    return {
      title: `⚡ £${pounds} edge · ${where} under way`,
      body: `${args.offerTitle} · finish while the scope applies`,
    };
  }

  if (until > 0 && until <= OFFER_EXPIRY_LEAD_MS) {
    const mins = Math.round(until / 60_000);
    const when =
      mins >= 60
        ? `${Math.round(mins / 60)}h`
        : `${Math.max(1, mins)} min`;
    return {
      title: `⚡ £${pounds} edge ends in ${when}`,
      body: `${args.offerTitle} · expires ${formatClockTime(args.impact.at)}`,
    };
  }

  return {
    title: `⚡ £${pounds} edge ends today`,
    body: `${args.offerTitle} · claim before it expires`,
  };
}
