/**
 * Sticky EdgeAlert toast age + relative countdown copy.
 * Full words ("minutes", not "mins") so singular/plural stay grammatical.
 */

/** Show "N minutes ago" once the toast has been on-screen this long. */
export const ALERT_TOAST_AGE_FOOTER_MS = 5 * 60_000;

/** Auto-dismiss sticky toasts that have sat this long (overnight / forgotten). */
export const ALERT_TOAST_STALE_DISMISS_MS = 60 * 60_000;

/** On return to the tab, dismiss sticky toasts if it was hidden this long. */
export const ALERT_TOAST_HIDDEN_DISMISS_MS = 30 * 60_000;

/** Tick age footer / stale checks. */
export const ALERT_TOAST_AGE_TICK_MS = 30_000;

/** British English minutes for countdown titles ("starts in 1 minute"). */
export function formatAlertMinutes(totalMinutes: number): string {
  const n = Math.max(1, Math.round(totalMinutes));
  return n === 1 ? "1 minute" : `${n} minutes`;
}

/** British English hours for countdown titles ("ends in 2 hours"). */
export function formatAlertHours(totalHours: number): string {
  const n = Math.max(1, Math.round(totalHours));
  return n === 1 ? "1 hour" : `${n} hours`;
}

/**
 * Relative age for the toast footer. Null while still "fresh" (< 5 minutes).
 */
export function formatAlertToastAge(
  raisedAt: number,
  now: number = Date.now()
): string | null {
  const ago = now - raisedAt;
  if (ago < ALERT_TOAST_AGE_FOOTER_MS) return null;

  const mins = Math.floor(ago / 60_000);
  if (mins < 60) {
    return `${formatAlertMinutes(mins)} ago`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 48) {
    return `${formatAlertHours(hours)} ago`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
