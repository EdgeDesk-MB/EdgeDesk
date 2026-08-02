/**
 * Offer expiry - earliest of explicit expiresAt vs scoped race/event deadline.
 * Category-aware “Missed race / match / event” labels for expired scoped offers.
 */
import type { OfferRow } from "@/lib/db/schema";
import {
  offerCategoryById,
  offerCategoryFromSport,
  type OfferCategoryId,
} from "@/lib/offers/offer-categories";

type OfferExpiryFields = Pick<
  OfferRow,
  "expiresAt" | "eventDate" | "scopeRaceLabel" | "scopeRaceId" | "sport" | "status"
>;

/**
 * Extract off-time from labels like "3:00 · Betway Handicap" or "15:00 · Feature".
 *
 * Scope labels are built from the Racing API's `off_time`, which prints UK
 * cards on a 12-hour clock with no am/pm: "1:50" is a 13:50 race. Racing runs
 * from about 11:00 to 21:30, so 1-10 can only mean the afternoon or evening,
 * while 11 and 12 are already the right side of noon. Anything from 13 up is
 * an explicit 24-hour label and passes through untouched.
 */
export function parseScopeRaceOffTime(label: string | null | undefined): {
  hours: number;
  minutes: number;
} | null {
  if (!label?.trim()) return null;
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const rawHours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(rawHours) || !Number.isFinite(minutes)) return null;
  if (rawHours < 0 || rawHours > 23 || minutes < 0 || minutes > 59) return null;
  const hours = rawHours >= 1 && rawHours <= 10 ? rawHours + 12 : rawHours;
  return { hours, minutes };
}

/** UK calendar date + HH:MM → UTC epoch (Europe/London wall clock). */
export function ukDateTimeToUtcMs(date: string, hours: number, minutes: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const base = Date.parse(`${date}T${hh}:${mm}:00Z`);
  if (Number.isNaN(base)) return null;
  for (const offsetHours of [0, 1, -1]) {
    const candidate = base - offsetHours * 3_600_000;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(candidate));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const ymd = `${get("year")}-${get("month")}-${get("day")}`;
    const hm = `${get("hour")}:${get("minute")}`;
    if (ymd === date && hm === `${hh}:${mm}`) return candidate;
  }
  return base;
}

/**
 * Deadline from racing/event scope:
 * - Specific race → eventDate + off-time from scopeRaceLabel (UK local)
 * - Course / UK&IRE day → end of eventDate (23:59:59 UK)
 */
export function scopedEventDeadlineMs(
  offer: Pick<OfferExpiryFields, "eventDate" | "scopeRaceLabel" | "scopeRaceId">
): number | null {
  const ymd = offer.eventDate?.trim();
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const off = parseScopeRaceOffTime(offer.scopeRaceLabel);
  if (off && (offer.scopeRaceId?.trim() || offer.scopeRaceLabel?.trim())) {
    return ukDateTimeToUtcMs(ymd, off.hours, off.minutes);
  }
  return ukDateTimeToUtcMs(ymd, 23, 59);
}

/** Whichever comes first: explicit expiry or scoped race/event time. */
export function effectiveOfferExpiryMs(offer: OfferExpiryFields): number | null {
  const explicit = offer.expiresAt != null && offer.expiresAt > 0 ? offer.expiresAt : null;
  const scoped = scopedEventDeadlineMs(offer);
  if (explicit == null) return scoped;
  if (scoped == null) return explicit;
  return Math.min(explicit, scoped);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilOfferExpiry(
  expiresAt: number | null,
  now = Date.now()
): number | null {
  if (expiresAt == null) return null;
  return (expiresAt - now) / DAY_MS;
}

/** Calendar-style urgency copy — "Ends today", "Ends tomorrow", etc. */
export function formatOfferDaysLeftLabel(daysLeft: number | null): string | null {
  if (daysLeft == null) return null;
  if (daysLeft < 0) return "Expired";
  if (daysLeft < 1) return "Ends today";
  if (daysLeft < 2) return "Ends tomorrow";
  return `${Math.ceil(daysLeft)} days left`;
}

export function offerExpiryUrgency(
  daysLeft: number | null
): "today" | "tomorrow" | "normal" {
  if (daysLeft == null) return "normal";
  if (daysLeft < 1) return "today";
  if (daysLeft < 2) return "tomorrow";
  return "normal";
}

export function offerExpiryDaysLeft(
  offer: OfferExpiryFields,
  now = Date.now()
): number | null {
  return daysUntilOfferExpiry(effectiveOfferExpiryMs(offer), now);
}

export function offerHasScopedEvent(
  offer: Pick<OfferExpiryFields, "eventDate" | "scopeRaceId" | "scopeRaceLabel">
): boolean {
  return Boolean(
    offer.eventDate?.trim() || offer.scopeRaceId?.trim() || offer.scopeRaceLabel?.trim()
  );
}

/** Category-aware missed wording when a scoped window has passed. */
export function missedOfferLabel(sport: string | null | undefined): string {
  return missedOfferLabelForCategory(offerCategoryFromSport(sport));
}

export function missedOfferLabelForCategory(category: OfferCategoryId | string): string {
  const def = offerCategoryById(category);
  if (def.isRacing) return "Missed race";
  switch (def.id) {
    case "football":
      return "Missed match";
    case "casino":
      return "Expired";
    default:
      return "Missed event";
  }
}

/** Prefer Missed… when expired and the offer had a date/race/event scope. */
export function formatOfferStatusDisplay(
  offer: Pick<OfferExpiryFields, "status" | "sport" | "eventDate" | "scopeRaceId" | "scopeRaceLabel">
): string {
  if (offer.status === "expired" && offerHasScopedEvent(offer)) {
    return missedOfferLabel(offer.sport);
  }
  if (offer.status === "expired") return "Expired";
  if (offer.status === "planned") return "Planned";
  if (offer.status === "active") return "Active";
  if (offer.status === "completed") return "Completed";
  return "Expired";
}

/** Campaign card status pill — only when something went wrong (expired / missed window). */
export function offerIssueStatusLabel(
  offer: Pick<OfferExpiryFields, "status" | "sport" | "eventDate" | "scopeRaceId" | "scopeRaceLabel">
): string | null {
  if (offer.status !== "expired") return null;
  return formatOfferStatusDisplay(offer);
}
