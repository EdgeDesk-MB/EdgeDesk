/**
 * Weekly digest trigger (H1) - compute-on-poll with a week-key latch. The
 * server only runs while the desk is open (local-first, no cron), so the
 * digest fires on the first state poll at/after Monday 09:00 local, exactly
 * once per ISO week. Missed weeks do not backfill: only the most recently
 * completed week is summarised.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db, accounts, appSettings, bets, offers } from "@/lib/db";
import { computeBookmakerStats } from "@/lib/accounts/bookmaker-stats";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { buildWeeklyDigest } from "@/lib/offers/weekly-digest-content";
import { recordAlerts } from "@/lib/services/alerts-inbox";
import { getAllSnapshots } from "@/lib/services/ev-snapshot";
import { sendPush } from "@/lib/services/push";
import { getAppSettings } from "@/lib/services/settings";

const SEND_HOUR = 9;
const LATCH_KEY = "digestLastSentWeek";

function readSetting(key: string): string | undefined {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function writeSetting(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
  else db.insert(appSettings).values({ key, value }).run();
}

/** ISO 8601 week key, e.g. "2026-W29" (local date). */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // Thursday decides the week-year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Monday 00:00 local of the week containing `d` (DST-safe via Date fields). */
function mondayStart(d: Date): Date {
  const daysSinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday);
}

/** Due window for the Monday morning digest. Latch is the caller's job. */
export function weeklyDigestDueWindow(nowMs: number): {
  weekKey: string;
  weekStartMs: number;
  weekEndMs: number;
  due: boolean;
} {
  const now = new Date(nowMs);
  const currentMonday = mondayStart(now);
  const weekKey = isoWeekKey(currentMonday);
  const dueAt = new Date(
    currentMonday.getFullYear(),
    currentMonday.getMonth(),
    currentMonday.getDate(),
    SEND_HOUR
  ).getTime();
  const weekStartMs = new Date(
    currentMonday.getFullYear(),
    currentMonday.getMonth(),
    currentMonday.getDate() - 7
  ).getTime();
  return {
    weekKey,
    weekStartMs,
    weekEndMs: currentMonday.getTime(),
    due: nowMs >= dueAt,
  };
}

/**
 * Send the weekly digest if enabled, due and not yet sent this week.
 * Returns true only when a digest actually landed in the inbox.
 */
export function maybeSendWeeklyDigest(nowMs = Date.now()): boolean {
  const settings = getAppSettings();
  if (!settings.digestWeekly) return false;

  const window = weeklyDigestDueWindow(nowMs);
  const weekKey = window.weekKey;
  if (readSetting(LATCH_KEY) === weekKey) return false;
  if (!window.due) return false;

  const weekStart = window.weekStartMs;
  const weekEnd = window.weekEndMs;

  const allBets = db.select().from(bets).all();
  const league = computeBookmakerStats({
    accounts: db.select().from(accounts).all(),
    bets: allBets,
    offers: db.select().from(offers).all(),
    now: nowMs,
    droughtNudgeDays: settings.tuning.droughtNudgeDays,
  });

  const content = buildWeeklyDigest({
    snapshots: getAllSnapshots() as EvSnapshotRow[],
    bets: allBets,
    league,
    weekStartMs: weekStart,
    weekEndMs: weekEnd,
  });

  // Latch even when the week was empty - the window is closed either way,
  // and campaigns settling today belong to NEXT Monday's digest.
  writeSetting(LATCH_KEY, weekKey);
  if (!content) return false;

  const alert = {
    key: `digest:${weekKey}`,
    kind: "weekly_digest",
    title: content.title,
    body: content.body,
    href: "/report",
  };
  recordAlerts([alert]);
  void sendPush(alert).catch(() => {});
  return true;
}
