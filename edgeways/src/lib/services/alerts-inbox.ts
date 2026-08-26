/**
 * Alerts inbox (F2) - persistent record of every emitted EdgeAlert. The
 * sticky toast and notification channels deliver; this is the source of truth, so a
 * missed alert is never a lost alert. Rows key on the rules' stable dedupe
 * keys: a re-firing rule updates its row instead of stacking copies.
 */
import { desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import {
  conditionAlertSubject,
  orphanConditionDedupes,
  type InboxSubjectTable,
} from "@/lib/alerts/inbox-orphans";
import { plainAlertBody } from "@/lib/alerts/plain-body";
import { settledResultAlertCopy } from "@/lib/alerts/rules";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { db, alertsInbox, bets, events, offers, type AlertsInboxRow } from "@/lib/db";

/**
 * The sync SQLite functions below are the LOCAL path. On hosted they stay
 * inert (the shared in-memory SQLite stand-in must never act as a per-login
 * record); request handlers use the async dispatchers at the bottom, which
 * route to db/neon-alerts-inbox.ts (EDGE-110).
 */
function hostedInboxDisabled(): boolean {
  return isNeonDesk();
}

export interface IncomingAlert {
  key: string;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
}

/** Upsert by dedupe key. Read state survives a re-fire (same condition). */
export function recordAlerts(alerts: IncomingAlert[], now = Date.now()): number {
  if (hostedInboxDisabled()) return 0;
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

/**
 * When a previously settled bet is later voided/pushed, rewrite any existing
 * result_settled inbox row so Alerts matches Profit Tracker (no signed P&L).
 * Does not create rows for bets that never had a settlement alert.
 */
export function reconcileVoidedSettlementAlerts(now = Date.now()): number {
  if (hostedInboxDisabled()) return 0;
  const revised = db
    .select({
      id: bets.id,
      label: bets.label,
      status: bets.status,
      betType: bets.betType,
      bookmaker: bets.bookmaker,
      offerId: bets.offerId,
    })
    .from(bets)
    .where(inArray(bets.status, ["void", "push"]))
    .all();
  if (revised.length === 0) return 0;

  const offerIds = [
    ...new Set(revised.map((b) => b.offerId).filter((id): id is number => id != null)),
  ];
  const offerTitleById = new Map<number, string>();
  if (offerIds.length > 0) {
    for (const row of db
      .select({ id: offers.id, title: offers.title })
      .from(offers)
      .where(inArray(offers.id, offerIds))
      .all()) {
      offerTitleById.set(row.id, row.title);
    }
  }

  let updated = 0;
  for (const bet of revised) {
    const dedupe = `result_settled:${bet.id}`;
    const existing = db
      .select()
      .from(alertsInbox)
      .where(eq(alertsInbox.dedupe, dedupe))
      .get();
    if (!existing) continue;
    const copy = settledResultAlertCopy({
      betId: bet.id,
      label: bet.label,
      profit: 0,
      status: bet.status,
      betType: bet.betType,
      offerTitle: bet.offerId != null ? offerTitleById.get(bet.offerId) ?? null : null,
      bookmaker: bet.bookmaker,
    });
    const body = plainAlertBody({
      body: copy.body,
      bookmaker: bet.bookmaker,
      kind: "result_settled",
    });
    if (existing.title === copy.title && (existing.body ?? "") === body) continue;
    db.update(alertsInbox)
      .set({
        title: copy.title,
        body,
        updatedAt: now,
      })
      .where(eq(alertsInbox.dedupe, dedupe))
      .run();
    updated++;
  }
  return updated;
}

/**
 * Drop condition rows whose bet / offer / event is gone. Public demo used to
 * write fixture "lay missing" alerts into a live or shared inbox; a new
 * empty desk must not keep them.
 */
export function pruneOrphanConditionAlerts(): number {
  if (hostedInboxDisabled()) return 0;
  const rows = db
    .select({ dedupe: alertsInbox.dedupe })
    .from(alertsInbox)
    .all();
  const subjects = rows
    .map((row) => ({
      dedupe: row.dedupe,
      subject: conditionAlertSubject(row.dedupe),
    }))
    .filter(
      (row): row is { dedupe: string; subject: NonNullable<typeof row.subject> } =>
        row.subject != null
    );
  if (subjects.length === 0) return 0;

  const idsFor = (table: InboxSubjectTable): number[] => [
    ...new Set(
      subjects.filter((row) => row.subject.table === table).map((row) => row.subject.id)
    ),
  ];
  const betIds = idsFor("bets");
  const offerIds = idsFor("offers");
  const eventIds = idsFor("events");
  const existing = {
    bets: new Set(
      betIds.length > 0
        ? db.select({ id: bets.id }).from(bets).where(inArray(bets.id, betIds)).all().map((r) => r.id)
        : []
    ),
    offers: new Set(
      offerIds.length > 0
        ? db
            .select({ id: offers.id })
            .from(offers)
            .where(inArray(offers.id, offerIds))
            .all()
            .map((r) => r.id)
        : []
    ),
    events: new Set(
      eventIds.length > 0
        ? db
            .select({ id: events.id })
            .from(events)
            .where(inArray(events.id, eventIds))
            .all()
            .map((r) => r.id)
        : []
    ),
  };
  const gone = orphanConditionDedupes(
    subjects.map((row) => row.dedupe),
    existing
  );
  if (gone.length === 0) return 0;
  return db.delete(alertsInbox).where(inArray(alertsInbox.dedupe, gone)).run().changes;
}

function syncInbox(): void {
  reconcileVoidedSettlementAlerts();
  pruneOrphanConditionAlerts();
}

export function listInbox(limit = 100): AlertsInboxRow[] {
  if (hostedInboxDisabled()) return [];
  syncInbox();
  return db
    .select()
    .from(alertsInbox)
    .orderBy(desc(alertsInbox.updatedAt))
    .limit(limit)
    .all();
}

/** Every inbox dedupe key, including read rows. Watcher uses this as durable seen. */
export function listInboxDedupes(): string[] {
  if (hostedInboxDisabled()) return [];
  syncInbox();
  return db
    .select({ dedupe: alertsInbox.dedupe })
    .from(alertsInbox)
    .all()
    .map((row) => row.dedupe)
    .filter(Boolean);
}

export function unreadCount(): number {
  if (hostedInboxDisabled()) return 0;
  syncInbox();
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(alertsInbox)
    .where(isNull(alertsInbox.readAt))
    .get();
  return row?.n ?? 0;
}

export function markRead(id: number, now = Date.now()): void {
  if (hostedInboxDisabled()) return;
  db.update(alertsInbox).set({ readAt: now }).where(eq(alertsInbox.id, id)).run();
}

function kindFromDedupe(dedupe: string): string {
  const kind = dedupe.split(":")[0]?.trim();
  return kind || "alert";
}

/**
 * Mark the inbox row for a rules dedupe key as read.
 * If the toast was dismissed before POST /api/alerts landed, insert a read
 * stub so the later upsert keeps it read.
 */
export function markReadByDedupe(dedupe: string, now = Date.now()): number {
  if (hostedInboxDisabled()) return 0;
  const key = dedupe.trim();
  if (!key) return 0;
  const updated = db
    .update(alertsInbox)
    .set({ readAt: now })
    .where(eq(alertsInbox.dedupe, key))
    .run();
  if (updated.changes > 0) return updated.changes;
  db.insert(alertsInbox)
    .values({
      dedupe: key,
      kind: kindFromDedupe(key),
      title: "Alert",
      createdAt: now,
      updatedAt: now,
      readAt: now,
    })
    .onConflictDoUpdate({
      target: alertsInbox.dedupe,
      set: { readAt: now },
    })
    .run();
  return 1;
}

/**
 * Mark every inbox row whose dedupe starts with `prefix` as read.
 * Used when an offer is deleted so offer_expiring rows for it go quiet.
 */
export function markReadByDedupePrefix(prefix: string, now = Date.now()): number {
  if (hostedInboxDisabled()) return 0;
  const p = prefix.trim();
  if (!p) return 0;
  const res = db
    .update(alertsInbox)
    .set({ readAt: now })
    .where(like(alertsInbox.dedupe, `${p.replace(/%/g, "")}%`))
    .run();
  return res.changes;
}

export function markAllRead(now = Date.now()): number {
  if (hostedInboxDisabled()) return 0;
  const res = db
    .update(alertsInbox)
    .set({ readAt: now })
    .where(isNull(alertsInbox.readAt))
    .run();
  return res.changes;
}

/* ------------------------------------------------------------------ */
/* EDGE-110: async dispatchers. Hosted desk -> Neon (per-user rows);  */
/* local desk -> the sync SQLite functions above. Request handlers    */
/* (and any code path that can run on hosted) must use these.         */
/* ------------------------------------------------------------------ */

export async function recordAlertsAsync(
  alerts: IncomingAlert[],
  now = Date.now()
): Promise<number> {
  if (isNeonDesk()) {
    const { recordNeonAlerts } = await import("@/lib/db/neon-alerts-inbox");
    return recordNeonAlerts(alerts, now);
  }
  return recordAlerts(alerts, now);
}

export async function listInboxAsync(limit = 100): Promise<AlertsInboxRow[]> {
  if (isNeonDesk()) {
    const { listNeonInbox } = await import("@/lib/db/neon-alerts-inbox");
    return listNeonInbox(limit);
  }
  return listInbox(limit);
}

export async function listInboxDedupesAsync(): Promise<string[]> {
  if (isNeonDesk()) {
    const { listNeonInboxDedupes } = await import("@/lib/db/neon-alerts-inbox");
    return listNeonInboxDedupes();
  }
  return listInboxDedupes();
}

export async function unreadCountAsync(): Promise<number> {
  if (isNeonDesk()) {
    const { unreadNeonCount } = await import("@/lib/db/neon-alerts-inbox");
    return unreadNeonCount();
  }
  return unreadCount();
}

export async function markReadAsync(id: number, now = Date.now()): Promise<void> {
  if (isNeonDesk()) {
    const { markNeonRead } = await import("@/lib/db/neon-alerts-inbox");
    return markNeonRead(id, now);
  }
  markRead(id, now);
}

export async function markReadByDedupeAsync(
  dedupe: string,
  now = Date.now()
): Promise<number> {
  if (isNeonDesk()) {
    const { markNeonReadByDedupe } = await import("@/lib/db/neon-alerts-inbox");
    return markNeonReadByDedupe(dedupe, now);
  }
  return markReadByDedupe(dedupe, now);
}

export async function markReadByDedupePrefixAsync(
  prefix: string,
  now = Date.now()
): Promise<number> {
  if (isNeonDesk()) {
    const { markNeonReadByDedupePrefix } = await import("@/lib/db/neon-alerts-inbox");
    return markNeonReadByDedupePrefix(prefix, now);
  }
  return markReadByDedupePrefix(prefix, now);
}

export async function markAllReadAsync(now = Date.now()): Promise<number> {
  if (isNeonDesk()) {
    const { markNeonAllRead } = await import("@/lib/db/neon-alerts-inbox");
    return markNeonAllRead(now);
  }
  return markAllRead(now);
}
