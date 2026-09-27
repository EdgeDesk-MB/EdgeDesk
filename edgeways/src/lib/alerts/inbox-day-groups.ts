/**
 * Alerts inbox day bands. Same Today / Yesterday / weekday labels as History
 * (`formatOfferListGroupLabel`), newest calendar day first. Within a day,
 * alerts keep the order they arrived in. Days with no alerts are omitted.
 */
import type { AlertsInboxRow } from "@/lib/db/schema";
import {
  formatOfferListGroupLabel,
  startOfLocalDay,
} from "@/lib/offers/offer-list-groups";

export interface AlertDayGroup {
  key: string;
  label: string;
  alerts: AlertsInboxRow[];
}

/** Local calendar key, same shape as History's `history-day-YYYY-MM-DD`. */
function localDayKey(ms: number): string {
  const when = new Date(ms);
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

export function groupAlertsInboxByDay(
  alerts: readonly AlertsInboxRow[],
  nowMs = Date.now()
): AlertDayGroup[] {
  const groups: AlertDayGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const alert of alerts) {
    const key = localDayKey(alert.updatedAt);
    const existing = indexByKey.get(key);
    if (existing != null) {
      groups[existing]!.alerts.push(alert);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({
      key,
      label: formatOfferListGroupLabel(startOfLocalDay(alert.updatedAt), nowMs),
      alerts: [alert],
    });
  }

  groups.sort(
    (a, b) =>
      startOfLocalDay(b.alerts[0]!.updatedAt) - startOfLocalDay(a.alerts[0]!.updatedAt)
  );
  return groups;
}
