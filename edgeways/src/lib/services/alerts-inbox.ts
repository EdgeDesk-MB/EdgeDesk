/**
 * Alerts inbox (F2) - persistent record of every emitted EdgeAlert. The
 * sticky toast and notification channels deliver; this is the source of truth, so a
 * missed alert is never a lost alert. Rows key on the rules' stable dedupe
 * keys: a re-firing rule updates its row instead of stacking copies.
 */
import { desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { plainAlertBody } from "@/lib/alerts/plain-body";
import { settledResultAlertCopy } from "@/lib/alerts/rules";
import { db, alertsInbox, bets, offers, type AlertsInboxRow } from "@/lib/db";

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

/**
 * When a previously settled bet is later voided/pushed, rewrite any existing
 * result_settled inbox row so Alerts matches Profit Tracker (no signed P&L).
 * Does not create rows for bets that never had a settlement alert.
 */
export function reconcileVoidedSettlementAlerts(now = Date.now()): number {
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

export function listInbox(limit = 100): AlertsInboxRow[] {
  reconcileVoidedSettlementAlerts();
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

/** Mark the inbox row for a rules dedupe key as read (0 if none / already read). */
export function markReadByDedupe(dedupe: string, now = Date.now()): number {
  const key = dedupe.trim();
  if (!key) return 0;
  const res = db
    .update(alertsInbox)
    .set({ readAt: now })
    .where(eq(alertsInbox.dedupe, key))
    .run();
  return res.changes;
}

/**
 * Mark every inbox row whose dedupe starts with `prefix` as read.
 * Used when an offer is deleted so offer_expiring rows for it go quiet.
 */
export function markReadByDedupePrefix(prefix: string, now = Date.now()): number {
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
  const res = db
    .update(alertsInbox)
    .set({ readAt: now })
    .where(isNull(alertsInbox.readAt))
    .run();
  return res.changes;
}
