import { localCalendarDate } from "@/lib/events";

/** Query + path helpers for the football crest lock-up (feeds + push icon). */

export const CREST_LOCKUP_PATH = "/api/crest-lockup";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXTERNAL_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export function isCrestLockupDate(value: string): boolean {
  return DATE_RE.test(value);
}

export function isCrestLockupExternalId(value: string): boolean {
  return EXTERNAL_ID_RE.test(value);
}

export function crestLockupIconPath(input: {
  externalId: string;
  date: string;
}): string | null {
  const id = input.externalId.trim();
  const date = input.date.trim();
  if (!isCrestLockupExternalId(id) || !isCrestLockupDate(date)) return null;
  return `${CREST_LOCKUP_PATH}?id=${encodeURIComponent(id)}&d=${encodeURIComponent(date)}`;
}

/** Settlement and 2UP keys carry the linked bet id. */
export function footballPushBetId(key: string): number | null {
  const match = /^(?:result_settled|two_up_lock):(\d+)$/.exec(key.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function crestLockupIconForEvent(event: {
  sport?: string | null;
  externalId?: string | null;
  startTime?: number | null;
}): string | null {
  if (event.sport && event.sport !== "football") return null;
  const externalId = event.externalId?.trim();
  if (!externalId || event.startTime == null) return null;
  return crestLockupIconPath({
    externalId,
    date: localCalendarDate(new Date(event.startTime)),
  });
}

export function isSafePushIconPath(icon: string): boolean {
  return (
    icon.startsWith(`${CREST_LOCKUP_PATH}?`) || icon.startsWith("/icon-192.png")
  );
}

export function parseCrestLockupSearch(search: {
  get(name: string): string | null;
}): { externalId: string; date: string } | null {
  const id = search.get("id")?.trim() ?? "";
  const date = search.get("d")?.trim() ?? "";
  if (!isCrestLockupExternalId(id) || !isCrestLockupDate(date)) return null;
  return { externalId: id, date };
}
