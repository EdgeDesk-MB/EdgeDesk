/**
 * Offer expiry reminder selection (settings toggle).
 * Collapses repeating series to the current instance, escalates into the
 * nearest configured day-threshold, and ranks/caps the toast batch.
 */
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import type { OfferRow } from "@/lib/db/schema";

const DAY_MS = 86_400_000;

export const OFFER_REMINDER_BATCH_CAP = 3;

export type OfferReminderCandidate = {
  id: number;
  title: string;
  bookmaker: string | null;
  status: OfferRow["status"];
  seriesId: number | null;
  instanceDate: string | null;
  expiresAt: number | null;
  eventDate: string | null;
  scopeRaceLabel: string | null;
  scopeRaceId: string | null;
  sport: string | null;
};

export type OfferExpiryReminder = {
  offerId: number;
  title: string;
  bookmaker: string | null;
  /** Ceil calendar days until deadline (0 only at exact deadline). */
  daysLeft: number;
  /** Reminder-day bucket that authorised this toast. */
  threshold: number;
  deadline: number;
  seenKey: string;
  message: string;
};

function localDayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function offerReminderSeenKey(
  offerId: number,
  threshold: number,
  now = Date.now()
): string {
  return `offer_reminder:${offerId}:${threshold}:${localDayKey(now)}`;
}

function isEarlierInstance(a: OfferReminderCandidate, b: OfferReminderCandidate): boolean {
  const ad = a.instanceDate ?? "";
  const bd = b.instanceDate ?? "";
  if (ad !== bd) return ad < bd;
  return a.id < b.id;
}

/** Keep one-offs plus the earliest instance of each series. */
export function keepCurrentReminderOffers(
  offers: OfferReminderCandidate[]
): OfferReminderCandidate[] {
  const firstBySeries = new Map<number, OfferReminderCandidate>();
  const oneOffs: OfferReminderCandidate[] = [];

  for (const offer of offers) {
    if (offer.seriesId == null) {
      oneOffs.push(offer);
      continue;
    }
    const current = firstBySeries.get(offer.seriesId);
    if (!current || isEarlierInstance(offer, current)) {
      firstBySeries.set(offer.seriesId, offer);
    }
  }

  return [...oneOffs, ...firstBySeries.values()];
}

/** Smallest configured threshold that still covers daysLeft (escalation). */
export function pickReminderThreshold(
  daysLeft: number,
  reminderDays: number[]
): number | null {
  if (daysLeft < 0) return null;
  const eligible = reminderDays
    .filter((d) => Number.isFinite(d) && d >= daysLeft)
    .sort((a, b) => a - b);
  return eligible[0] ?? null;
}

export function formatOfferReminderMessage(
  title: string,
  remainingMs: number,
  daysLeft: number
): string {
  if (remainingMs < DAY_MS) return `Offer expires today: ${title}`;
  if (daysLeft === 1) return `Offer expires in 1 day: ${title}`;
  return `Offer expires in ${daysLeft} days: ${title}`;
}

export function selectOfferExpiryReminders(
  offers: OfferReminderCandidate[],
  reminderDays: number[],
  now = Date.now(),
  opts?: { seen?: Set<string>; batchCap?: number }
): OfferExpiryReminder[] {
  const seen = opts?.seen ?? new Set<string>();
  const batchCap = opts?.batchCap ?? OFFER_REMINDER_BATCH_CAP;
  const thresholds = reminderDays.filter((d) => Number.isFinite(d) && d >= 0);
  if (thresholds.length === 0) return [];

  const eligible = offers.filter(
    (o) => o.status === "active" || o.status === "planned"
  );
  const current = keepCurrentReminderOffers(eligible);
  const out: OfferExpiryReminder[] = [];

  for (const offer of current) {
    const deadline = effectiveOfferExpiryMs(offer);
    if (deadline == null) continue;
    const remainingMs = deadline - now;
    if (remainingMs < 0) continue;

    const daysLeft = Math.ceil(remainingMs / DAY_MS);
    const threshold = pickReminderThreshold(daysLeft, thresholds);
    if (threshold == null) continue;

    const seenKey = offerReminderSeenKey(offer.id, threshold, now);
    if (seen.has(seenKey)) continue;

    out.push({
      offerId: offer.id,
      title: offer.title,
      bookmaker: offer.bookmaker,
      daysLeft,
      threshold,
      deadline,
      seenKey,
      message: formatOfferReminderMessage(offer.title, remainingMs, daysLeft),
    });
  }

  out.sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    if (a.deadline !== b.deadline) return a.deadline - b.deadline;
    return a.offerId - b.offerId;
  });

  return out.slice(0, Math.max(0, batchCap));
}
