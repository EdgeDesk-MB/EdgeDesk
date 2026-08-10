/**
 * Daily "Your tasks today" digest content - pure selection over Do Next items.
 * Only actionable work with expiry inside the reminder horizon, soonest first.
 */

import {
  keepFirstRecurringInstance,
  compareConvertFreeBetFirst,
  type DoNextItem,
} from "@/lib/offers/do-next";
import type { OfferSummary } from "@/lib/services/offers.types";

export const DAILY_TASKS_DIGEST_CAP = 5;

export function reminderHorizonDays(reminderDays: number[]): number {
  const positive = reminderDays.filter((d) => Number.isFinite(d) && d >= 0);
  if (positive.length === 0) return 3;
  return Math.max(...positive);
}

/** Actionable Do Next rows with a known expiry inside the horizon. */
export function selectExpiryDoNextTasks(
  items: DoNextItem[],
  offers: OfferSummary[],
  horizonDays: number
): DoNextItem[] {
  const scoped = keepFirstRecurringInstance(items, offers);
  const eligible = scoped.filter((item) => {
    if (item.kind === "await_result" || item.kind === "place_mug") return false;
    if (item.daysLeft == null || item.daysLeft < 0) return false;
    return item.daysLeft <= horizonDays;
  });

  return eligible.sort((a, b) => {
    const convertCmp = compareConvertFreeBetFirst(a, b);
    if (convertCmp !== 0) return convertCmp;
    const ad = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const bd = b.daysLeft ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (b.remainingEv !== a.remainingEv) return b.remainingEv - a.remainingEv;
    return (a.offerTitle ?? a.title).localeCompare(b.offerTitle ?? b.title);
  });
}

function whenLabel(item: DoNextItem): string {
  if (item.expiryLabel?.trim()) return item.expiryLabel.trim();
  if (item.daysLeft == null) return "Soon";
  if (item.daysLeft < 1) return "Ends today";
  if (item.daysLeft === 1) return "1 day left";
  return `${Math.ceil(item.daysLeft)} days left`;
}

function taskLine(item: DoNextItem): string {
  const subject = item.offerTitle?.trim() || item.title;
  const action = item.offerTitle?.trim() ? item.title : null;
  const when = whenLabel(item);
  return action ? `${when}: ${action} · ${subject}` : `${when}: ${subject}`;
}

export function buildDailyTasksDigest(
  tasks: DoNextItem[],
  opts?: { cap?: number }
): { title: string; body: string } | null {
  if (tasks.length === 0) return null;
  const cap = opts?.cap ?? DAILY_TASKS_DIGEST_CAP;
  const top = tasks.slice(0, Math.max(1, cap));
  const count = tasks.length;
  const title =
    count === 1 ? "Your tasks today · 1 due soon" : `Your tasks today · ${count} due soon`;
  const body = top.map(taskLine).join(" · ");
  return { title, body };
}
