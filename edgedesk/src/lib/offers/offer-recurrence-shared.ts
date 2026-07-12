import type { OfferRecurrenceRule } from "@/lib/services/offers.types";

export const DEFAULT_RECURRENCE_RULE: OfferRecurrenceRule = {
  freq: "daily",
  interval: 1,
};

export function formatRecurrenceLabel(rule: OfferRecurrenceRule): string {
  if (rule.freq === "daily") {
    return rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`;
  }
  const days = rule.byWeekday?.length
    ? rule.byWeekday
        .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
        .join(", ")
    : "Weekly";
  return rule.interval === 1 ? `Weekly (${days})` : `Every ${rule.interval} weeks (${days})`;
}

export function recurringDetailPrefix(rule: OfferRecurrenceRule | undefined): string {
  if (!rule) return "";
  return `${formatRecurrenceLabel(rule)} · `;
}

export function parseRecurrenceRule(json: string | null | undefined): OfferRecurrenceRule | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as Partial<OfferRecurrenceRule>;
    if (raw.freq !== "daily" && raw.freq !== "weekly") return null;
    const interval = typeof raw.interval === "number" && raw.interval >= 1 ? raw.interval : 1;
    const byWeekday =
      raw.freq === "weekly" && Array.isArray(raw.byWeekday)
        ? raw.byWeekday.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : undefined;
    return { freq: raw.freq, interval, byWeekday };
  } catch {
    return null;
  }
}

export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
}

export function addDaysYmd(key: string, days: number): string {
  const d = parseYmd(key);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function expandRecurrenceDates(
  rule: OfferRecurrenceRule,
  fromKey: string,
  toKey: string
): string[] {
  if (fromKey > toKey) return [];
  const out: string[] = [];
  let cur = fromKey;
  let dayIndex = 0;

  while (cur <= toKey) {
    const weekday = parseYmd(cur).getDay();
    let include = false;

    if (rule.freq === "daily") {
      include = dayIndex % rule.interval === 0;
    } else {
      const allowed = rule.byWeekday?.length ? rule.byWeekday : [0, 1, 2, 3, 4, 5, 6];
      const weekIndex = Math.floor(dayIndex / 7);
      include = allowed.includes(weekday) && weekIndex % rule.interval === 0;
    }

    if (include) out.push(cur);
    cur = addDaysYmd(cur, 1);
    dayIndex += 1;
  }

  return out;
}

export function instanceExpiresAt(
  templateExpiresAt: number | null,
  instanceDate: string
): number | null {
  if (templateExpiresAt == null) return null;
  const template = new Date(templateExpiresAt);
  const [y, m, d] = instanceDate.split("-").map(Number);
  return new Date(
    y!,
    m! - 1,
    d!,
    template.getHours(),
    template.getMinutes(),
    template.getSeconds(),
    0
  ).getTime();
}
