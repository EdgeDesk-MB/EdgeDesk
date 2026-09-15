/**
 * Desk tab titles + push-style alert overlays.
 * Alert copy uses ensureNotificationTitleEmoji (same as web push), not toast JSX.
 */

import { ensureNotificationTitleEmoji } from "@/lib/alerts/notification-title";

export const APP_DOCUMENT_NAME = "Edgeways";

/** Longest-prefix first. Labels match nav / desk naming. */
const ROUTE_TITLES: readonly { prefix: string; title: string }[] = [
  { prefix: "/early-payout", title: "Early-payout Desk" },
  { prefix: "/2up", title: "Early-payout Desk" },
  { prefix: "/calculators/ep-desk", title: "Early-payout Desk" },
  { prefix: "/calculators/each-way", title: "Each way" },
  { prefix: "/calculators/sequential-lay", title: "Sequential lay" },
  { prefix: "/calculators/refund-if", title: "Refund-if" },
  { prefix: "/calculators/odds-converter", title: "Odds converter" },
  { prefix: "/calculators/accumulator", title: "Accumulator" },
  { prefix: "/calculators/dutching", title: "Dutching" },
  { prefix: "/calculators/matched", title: "Matched betting" },
  { prefix: "/calculators/two-up", title: "Early Payout" },
  { prefix: "/calculators/rule4", title: "Rule 4" },
  { prefix: "/calculators/ev", title: "EV calculator" },
  { prefix: "/calculators", title: "Calculators" },
  { prefix: "/offers/calendar", title: "Offer calendar" },
  { prefix: "/offers", title: "Offers" },
  { prefix: "/casino/calendar", title: "Casino calendar" },
  { prefix: "/casino", title: "Casino" },
  { prefix: "/bet-builder", title: "Bet builder" },
  { prefix: "/systems", title: "Systems" },
  { prefix: "/tracked-events", title: "Tracked events" },
  { prefix: "/match-checker", title: "Match checker" },
  { prefix: "/release-notes", title: "Release notes" },
  { prefix: "/racing", title: "Racing Desk" },
  { prefix: "/tracker", title: "Profit Tracker" },
  { prefix: "/accounts", title: "Accounts" },
  { prefix: "/balances", title: "Balances" },
  { prefix: "/fixtures", title: "Fixtures" },
  { prefix: "/events", title: "Events" },
  { prefix: "/history", title: "History" },
  { prefix: "/alerts", title: "Alerts" },
  { prefix: "/boosts", title: "Boosts" },
  { prefix: "/settings", title: "Settings" },
  { prefix: "/support", title: "Guides" },
  { prefix: "/feedback", title: "Feedback" },
  { prefix: "/contact", title: "Contact" },
  { prefix: "/refund", title: "Refunds" },
  { prefix: "/terms", title: "Terms of Service" },
  { prefix: "/privacy", title: "Privacy Policy" },
  { prefix: "/roadmap", title: "Roadmap" },
  { prefix: "/report", title: "Report" },
  { prefix: "/help", title: "Guides" },
  { prefix: "/acca", title: "Accumulator" },
  { prefix: "/desk", title: "Home" },
  { prefix: "/", title: "Home" },
];

const FOREGROUND_ALERT_TITLE_MS = 6000;

let baseTitle = APP_DOCUMENT_NAME;
let unreadAlerts: { key: string; title: string }[] = [];
let foregroundRestoreTimer: ReturnType<typeof setTimeout> | null = null;

export function pageLabelFromPathname(pathname: string): string {
  const path = pathname.split("?")[0] || "/";
  for (const entry of ROUTE_TITLES) {
    if (entry.prefix === "/") {
      if (path === "/") return entry.title;
      continue;
    }
    if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
      return entry.title;
    }
  }
  return "Home";
}

export function formatDeskDocumentTitle(pageLabel: string): string {
  if (!pageLabel || pageLabel === "Home") return APP_DOCUMENT_NAME;
  return `${pageLabel} · ${APP_DOCUMENT_NAME}`;
}

/** Pure resolver for tests and SSR-friendly callers. */
export function resolveDocumentTitle(input: {
  baseTitle: string;
  unreadTitles: readonly string[];
}): string {
  if (input.unreadTitles.length === 0) return input.baseTitle;
  const latest = input.unreadTitles[input.unreadTitles.length - 1]!;
  const n = input.unreadTitles.length;
  return n > 1 ? `(${n}) ${latest}` : latest;
}

function clearForegroundRestoreTimer(): void {
  if (foregroundRestoreTimer != null) {
    clearTimeout(foregroundRestoreTimer);
    foregroundRestoreTimer = null;
  }
}

export function applyDocumentTitle(): void {
  if (typeof document === "undefined") return;
  document.title = resolveDocumentTitle({
    baseTitle,
    unreadTitles: unreadAlerts.map((a) => a.title),
  });
}

export function setDeskDocumentTitleFromPathname(pathname: string): void {
  baseTitle = formatDeskDocumentTitle(pageLabelFromPathname(pathname));
  applyDocumentTitle();
}

/**
 * Sticky / automation alerts only. Uses push title shaping (leading emoji).
 * Background tabs keep the overlay until the user returns; focused tabs
 * restore the desk title after a short beat.
 */
export function announceAlertDocumentTitle(alert: {
  key: string;
  title: string;
  delivery?: "sticky" | "ephemeral";
}): void {
  if (alert.delivery === "ephemeral") return;
  const title = ensureNotificationTitleEmoji(alert.title);
  unreadAlerts = unreadAlerts.filter((a) => a.key !== alert.key);
  unreadAlerts.push({ key: alert.key, title });
  applyDocumentTitle();

  if (typeof document === "undefined") return;
  clearForegroundRestoreTimer();
  if (!document.hidden) {
    foregroundRestoreTimer = setTimeout(() => {
      foregroundRestoreTimer = null;
      // Only auto-clear while still focused — a backgrounded tab keeps the overlay.
      if (!document.hidden) clearAlertDocumentTitles();
    }, FOREGROUND_ALERT_TITLE_MS);
  }
}

export function clearAlertDocumentTitles(): void {
  clearForegroundRestoreTimer();
  if (unreadAlerts.length === 0) {
    applyDocumentTitle();
    return;
  }
  unreadAlerts = [];
  applyDocumentTitle();
}

/** Drop one overlay title when the user dismisses that alert. */
export function dismissAlertDocumentTitle(key: string): void {
  const next = unreadAlerts.filter((a) => a.key !== key);
  if (next.length === unreadAlerts.length) return;
  unreadAlerts = next;
  applyDocumentTitle();
}

/** Cancel the foreground restore timer so a hide mid-flash keeps the overlay. */
export function onDocumentBecameHidden(): void {
  clearForegroundRestoreTimer();
}

/** When the user returns to the tab, drop the alert overlay. */
export function onDocumentBecameVisible(): void {
  clearAlertDocumentTitles();
}

/** Test helper — reset module state between cases. */
export function __resetDocumentTitleStateForTests(): void {
  clearForegroundRestoreTimer();
  baseTitle = APP_DOCUMENT_NAME;
  unreadAlerts = [];
}
