import type { OfferRecurrenceRule } from "@/lib/services/offers.types";

export const DEFAULT_RECURRENCE_RULE: OfferRecurrenceRule = {
  freq: "daily",
  interval: 1,
};

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function formatRecurrenceLabel(rule: OfferRecurrenceRule): string {
  let base: string;
  if (rule.freq === "daily") {
    base = rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`;
  } else if (rule.freq === "monthly") {
    const day = ordinal(rule.byMonthday ?? 1);
    base =
      rule.interval === 1
        ? `Monthly (${day})`
        : `Every ${rule.interval} months (${day})`;
  } else {
    const days = rule.byWeekday?.length
      ? rule.byWeekday
          .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
          .join(", ")
      : "Weekly";
    base = rule.interval === 1 ? `Weekly (${days})` : `Every ${rule.interval} weeks (${days})`;
  }
  if (rule.expiryOffsetDays) {
    base += ` · expires after ${rule.expiryOffsetDays + 1}d`;
  }
  return base;
}

export function recurringDetailPrefix(rule: OfferRecurrenceRule | undefined): string {
  if (!rule) return "";
  return `${formatRecurrenceLabel(rule)} · `;
}

export function parseRecurrenceRule(json: string | null | undefined): OfferRecurrenceRule | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as Partial<OfferRecurrenceRule>;
    if (raw.freq !== "daily" && raw.freq !== "weekly" && raw.freq !== "monthly") return null;
    const interval = typeof raw.interval === "number" && raw.interval >= 1 ? raw.interval : 1;
    const byWeekday =
      raw.freq === "weekly" && Array.isArray(raw.byWeekday)
        ? raw.byWeekday.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : undefined;
    const byMonthday =
      raw.freq === "monthly" &&
      typeof raw.byMonthday === "number" &&
      Number.isInteger(raw.byMonthday) &&
      raw.byMonthday >= 1 &&
      raw.byMonthday <= 31
        ? raw.byMonthday
        : raw.freq === "monthly"
          ? 1
          : undefined;
    const expiryOffsetDays =
      typeof raw.expiryOffsetDays === "number" &&
      Number.isInteger(raw.expiryOffsetDays) &&
      raw.expiryOffsetDays >= 0
        ? raw.expiryOffsetDays
        : undefined;
    return { freq: raw.freq, interval, byWeekday, byMonthday, expiryOffsetDays };
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
  const anchor = parseYmd(fromKey);

  while (cur <= toKey) {
    const curDate = parseYmd(cur);
    const weekday = curDate.getDay();
    let include = false;

    if (rule.freq === "daily") {
      include = dayIndex % rule.interval === 0;
    } else if (rule.freq === "monthly") {
      const lastDayOfMonth = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(rule.byMonthday ?? anchor.getDate(), lastDayOfMonth);
      const monthIndex =
        (curDate.getFullYear() - anchor.getFullYear()) * 12 + (curDate.getMonth() - anchor.getMonth());
      include = curDate.getDate() === targetDay && monthIndex >= 0 && monthIndex % rule.interval === 0;
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
  instanceDate: string,
  offsetDays = 0
): number | null {
  if (templateExpiresAt == null) return null;
  const template = new Date(templateExpiresAt);
  const shiftedDate = offsetDays > 0 ? addDaysYmd(instanceDate, offsetDays) : instanceDate;
  const [y, m, d] = shiftedDate.split("-").map(Number);
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

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** How far a delete of a recurring instance should reach. */
export type OfferDeleteScope = "instance" | "future";

/** Parse series skippedDatesJson into sorted unique YYYY-MM-DD keys. */
export function parseSkippedDates(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    const dates = parsed.filter((d): d is string => typeof d === "string" && YMD_RE.test(d));
    return [...new Set(dates)].sort();
  } catch {
    return [];
  }
}

export function encodeSkippedDates(dates: string[]): string {
  return JSON.stringify([...new Set(dates.filter((d) => YMD_RE.test(d)))].sort());
}
