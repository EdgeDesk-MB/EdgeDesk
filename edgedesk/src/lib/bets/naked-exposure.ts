/**
 * Naked-exposure sentinel (B5) - the most expensive matched-betting mistake
 * is a back with no lay. Pure detection: any open qualifying/risk-free back
 * with no hedge past a threshold is exposed. Free bets (SNR longshot
 * strategy) never alert, dutch bets hedge internally, and any bet can be
 * muted with the intentional-nohedge marker.
 */

import type { BetRow } from "@/lib/db/schema";

export const INTENTIONAL_NOHEDGE_MARKER = "[intentional-nohedge]";

/** Default grace period between logging the back and logging the lay. */
const DEFAULT_THRESHOLD_MS = 10 * 60_000;
/** Tightened threshold when the event starts within the hour. */
const IMMINENT_THRESHOLD_MS = 3 * 60_000;
const IMMINENT_WINDOW_MS = 60 * 60_000;

export function isNakedExposed(
  bet: BetRow,
  now: number,
  eventStartMs?: number | null
): boolean {
  if (bet.status !== "open") return false;
  if (bet.betType !== "qualifying" && bet.betType !== "risk_free") return false;
  if (!(bet.backStake > 0)) return false;
  if (bet.layStake > 0) return false;
  if (bet.legs != null) return false; // dutch bets hedge internally
  if (bet.notes?.includes(INTENTIONAL_NOHEDGE_MARKER)) return false;

  // Starting soon OR already in play - in-play is the most urgent case of
  // all (a deliberate widening of the brief's "starting < 60 min away").
  const imminent = eventStartMs != null && eventStartMs - now <= IMMINENT_WINDOW_MS;
  const threshold = imminent ? IMMINENT_THRESHOLD_MS : DEFAULT_THRESHOLD_MS;
  return now - bet.createdAt > threshold;
}

/** All currently exposed bets, given event start times for the tighter window. */
export function detectNakedExposure(
  bets: BetRow[],
  eventStarts: Map<number, number>,
  now: number
): BetRow[] {
  return bets.filter((bet) =>
    isNakedExposed(bet, now, bet.eventId != null ? eventStarts.get(bet.eventId) : null)
  );
}

/** One-tap mute: append the marker to notes (idempotent). */
export function markIntentionalNoHedge(notes: string | null | undefined): string {
  if (notes?.includes(INTENTIONAL_NOHEDGE_MARKER)) return notes;
  return notes?.trim() ? `${notes} ${INTENTIONAL_NOHEDGE_MARKER}` : INTENTIONAL_NOHEDGE_MARKER;
}
