/**
 * Daily tasks digest - compute-on-poll with a day-key latch (same pattern as
 * the Monday weekly digest). Fires once at/after 09:00 local when the desk is
 * open: one inbox + push briefing of Do Next work due inside the expiry
 * reminder horizon. Replaces the old multi-toast offer-reminder spam.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { listAllOpenFreeBetLots } from "@/lib/accounts/free-bet-lots";
import {
  buildDailyTasksDigest,
  reminderHorizonDays,
  selectExpiryDoNextTasks,
} from "@/lib/offers/daily-tasks-digest";
import { buildDoNextItems } from "@/lib/offers/do-next";
import { db, appSettings } from "@/lib/db";
import { recordAlerts } from "@/lib/services/alerts-inbox";
import { listOfferSummaries } from "@/lib/services/offers";
import { sendPush } from "@/lib/services/push";
import { getAppSettings } from "@/lib/services/settings";

const SEND_HOUR = 9;
const LATCH_KEY = "dailyTasksLastSentDay";

function readSetting(key: string): string | undefined {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function writeSetting(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
  else db.insert(appSettings).values({ key, value }).run();
}

/** Local calendar day key, e.g. "2026-08-06". */
export function localDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Due window for the 09:00 daily-tasks briefing. Latch is the caller's job. */
export function dailyTasksDigestDueWindow(nowMs: number): {
  dayKey: string;
  due: boolean;
} {
  const now = new Date(nowMs);
  const dayKey = localDayKey(now);
  const dueAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    SEND_HOUR
  ).getTime();
  return { dayKey, due: nowMs >= dueAt };
}

/**
 * Send the daily tasks digest if enabled, due and not yet sent today.
 * Returns true only when a digest actually landed in the inbox.
 */
export function maybeSendDailyTasksDigest(nowMs = Date.now()): boolean {
  const settings = getAppSettings();
  if (!settings.offerRemindersEnabled) return false;

  const window = dailyTasksDigestDueWindow(nowMs);
  const dayKey = window.dayKey;
  if (readSetting(LATCH_KEY) === dayKey) return false;
  if (!window.due) return false;

  const offers = listOfferSummaries();
  const lots = listAllOpenFreeBetLots().map((lot) => ({
    id: lot.id,
    accountId: lot.accountId,
    accountName: lot.accountName,
    remaining: lot.remaining,
    note: lot.note,
    createdAt: lot.createdAt,
  }));
  const items = buildDoNextItems(offers, lots, nowMs);
  // Cap at 3 days to match Do Next's expiringSoon boost (next-actions.ts).
  const horizon = Math.min(reminderHorizonDays(settings.offerReminderDays), 3);
  const tasks = selectExpiryDoNextTasks(items, offers, horizon);
  const content = buildDailyTasksDigest(tasks);

  // Latch even when quiet - one morning briefing window per day.
  writeSetting(LATCH_KEY, dayKey);
  if (!content) return false;

  const alert = {
    key: `daily_tasks:${dayKey}`,
    kind: "daily_tasks",
    title: content.title,
    body: content.body,
    href: "/desk",
  };
  recordAlerts([alert]);
  void sendPush(alert).catch(() => {});
  return true;
}
