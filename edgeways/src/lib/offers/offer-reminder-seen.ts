/**
 * Client-side dedupe for offer expiry toasts (sessionStorage).
 * Reload in the same tab session must not replay the same reminder keys.
 */

const SEEN_KEY = "edgeways-offer-reminders-seen";

export function readSeenOfferReminderKeys(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function storeSeenOfferReminderKeys(seen: Set<string>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    /* private mode */
  }
}
