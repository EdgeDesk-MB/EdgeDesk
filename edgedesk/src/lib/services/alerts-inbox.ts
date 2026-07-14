/**
 * Alerts inbox (F2) - persistent record of every emitted EdgeAlert. The
 * toast/notification channels deliver; this is the source of truth, so a
 * missed alert is never a lost alert. Rows key on the rules' stable dedupe
 * keys: a re-firing rule updates its row instead of stacking copies.
 */
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db, alertsInbox, type AlertsInboxRow } from "@/lib/db";

export interface IncomingAlert {
  key: string;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
}

/** Upsert by dedupe key. Read state survives a re-fire (same condition). */
export function recordAlerts(alerts: IncomingAlert[], now = Date.now()): number {
  let recorded = 0;
  for (const alert of alerts) {
    if (!alert.key || !alert.title) continue;
    db.insert(alertsInbox)
      .values({
        dedupe: alert.key,
        kind: alert.kind,
        title: alert.title,
        body: alert.body ?? null,
        href: alert.href ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: alertsInbox.dedupe,
        set: {
          title: alert.title,
          body: alert.body ?? null,
          href: alert.href ?? null,
          updatedAt: now,
        },
      })
      .run();
    recorded++;
  }
  return recorded;
}

export function listInbox(limit = 100): AlertsInboxRow[] {
  return db
    .select()
    .from(alertsInbox)
    .orderBy(desc(alertsInbox.updatedAt))
    .limit(limit)
    .all();
}

export function unreadCount(): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(alertsInbox)
    .where(isNull(alertsInbox.readAt))
    .get();
  return row?.n ?? 0;
}

export function markRead(id: number, now = Date.now()): void {
  db.update(alertsInbox).set({ readAt: now }).where(eq(alertsInbox.id, id)).run();
}

export function markAllRead(now = Date.now()): number {
  const res = db
    .update(alertsInbox)
    .set({ readAt: now })
    .where(isNull(alertsInbox.readAt))
    .run();
  return res.changes;
}
