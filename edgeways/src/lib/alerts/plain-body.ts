/**
 * Plain-text alert body for inbox, push and OS notifications.
 * In-app toasts render the bookie as a VenueBadge instead.
 */

export function plainAlertBody(alert: {
  body: string;
  bookmaker?: string | null;
  kind?: string;
}): string {
  const bookie = alert.bookmaker?.trim();
  if (!bookie) return alert.body;
  if (alert.kind === "offer_expiring") return `${bookie} · ${alert.body}`;
  return `${alert.body} (${bookie})`;
}
