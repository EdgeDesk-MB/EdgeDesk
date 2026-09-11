/**
 * EDGE-110: hosted alerts inbox on Neon. Rows are per-desk (clerk_user_id)
 * and dedupe keys are unique per (owner, key) - result_settled:12 means a
 * different bet for every customer. Desk-scoped reads/writes go through
 * neonDeskClerkUserId(); the system feed poller uses the explicit-owner
 * recordNeonAlertsForUser.
 *
 * Condition alerts are raised client-side via POST /api/alerts. Orphans
 * (deleted bet / offer / event) are pruned on inbox read, same as local.
 */
import "server-only";

import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { plainAlertBody } from "@/lib/alerts/plain-body";
import {
  conditionAlertSubject,
  orphanConditionDedupes,
} from "@/lib/alerts/inbox-orphans";
import { settledResultAlertCopy } from "@/lib/alerts/rules";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { listNeonEventsByIds } from "@/lib/db/neon-events";
import {
  alertsInbox as pgAlertsInbox,
  bets as pgBets,
  offers as pgOffers,
} from "@/lib/db/schema.pg";
import type { AlertsInboxRow } from "@/lib/db/schema";
import type { IncomingAlert } from "@/lib/services/alerts-inbox";

function toInboxRow(row: typeof pgAlertsInbox.$inferSelect): AlertsInboxRow {
  return {
    id: row.id,
    dedupe: row.dedupe,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readAt: row.readAt,
  };
}

/** Upsert by (owner, dedupe). Read state survives a re-fire. Poller-safe. */
export async function recordNeonAlertsForUser(
  clerkUserId: string,
  alerts: IncomingAlert[],
  now = Date.now()
): Promise<number> {
  let recorded = 0;
  for (const alert of alerts) {
    if (!alert.key || !alert.title) continue;
    await getNeonDb()
      .insert(pgAlertsInbox)
      .values({
        clerkUserId,
        dedupe: alert.key,
        kind: alert.kind,
        title: alert.title,
        body: alert.body ?? null,
        href: alert.href ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pgAlertsInbox.clerkUserId, pgAlertsInbox.dedupe],
        set: {
          title: alert.title,
          body: alert.body ?? null,
          href: alert.href ?? null,
          updatedAt: now,
        },
      });
    recorded++;
  }
  return recorded;
}

/** Desk-scoped record for request handlers (POST /api/alerts). */
export async function recordNeonAlerts(
  alerts: IncomingAlert[],
  now = Date.now()
): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  return recordNeonAlertsForUser(clerkUserId, alerts, now);
}

/**
 * When a previously settled bet is later voided/pushed, rewrite any existing
 * result_settled inbox row so Alerts matches Profit Tracker (no signed P&L).
 */
async function reconcileNeonVoidedSettlementAlerts(
  clerkUserId: string,
  now: number
): Promise<void> {
  const revised = await getNeonDb()
    .select({
      id: pgBets.id,
      label: pgBets.label,
      status: pgBets.status,
      betType: pgBets.betType,
      bookmaker: pgBets.bookmaker,
      offerId: pgBets.offerId,
    })
    .from(pgBets)
    .where(
      and(
        eq(pgBets.clerkUserId, clerkUserId),
        inArray(pgBets.status, ["void", "push"])
      )
    );
  if (revised.length === 0) return;

  const offerIds = [
    ...new Set(revised.map((b) => b.offerId).filter((id): id is number => id != null)),
  ];
  const offerTitleById = new Map<number, string>();
  if (offerIds.length > 0) {
    const rows = await getNeonDb()
      .select({ id: pgOffers.id, title: pgOffers.title })
      .from(pgOffers)
      .where(and(eq(pgOffers.clerkUserId, clerkUserId), inArray(pgOffers.id, offerIds)));
    for (const row of rows) offerTitleById.set(row.id, row.title);
  }

  for (const bet of revised) {
    const dedupe = `result_settled:${bet.id}`;
    const existing = await getNeonDb()
      .select()
      .from(pgAlertsInbox)
      .where(
        and(
          eq(pgAlertsInbox.clerkUserId, clerkUserId),
          eq(pgAlertsInbox.dedupe, dedupe)
        )
      )
      .limit(1);
    const row = existing[0];
    if (!row) continue;
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
    if (row.title === copy.title && (row.body ?? "") === body) continue;
    await getNeonDb()
      .update(pgAlertsInbox)
      .set({ title: copy.title, body, updatedAt: now })
      .where(eq(pgAlertsInbox.id, row.id));
  }
}

export async function pruneNeonOrphanConditionAlerts(): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const rows = await getNeonDb()
    .select({ dedupe: pgAlertsInbox.dedupe })
    .from(pgAlertsInbox)
    .where(eq(pgAlertsInbox.clerkUserId, clerkUserId));
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

  const idsFor = (table: "bets" | "offers" | "events"): number[] => [
    ...new Set(subjects.filter((row) => row.subject.table === table).map((row) => row.subject.id)),
  ];
  const betIds = idsFor("bets");
  const offerIds = idsFor("offers");
  const eventIds = idsFor("events");

  const [betRows, offerRows, events] = await Promise.all([
    betIds.length > 0
      ? getNeonDb()
          .select({ id: pgBets.id })
          .from(pgBets)
          .where(and(eq(pgBets.clerkUserId, clerkUserId), inArray(pgBets.id, betIds)))
      : Promise.resolve([]),
    offerIds.length > 0
      ? getNeonDb()
          .select({ id: pgOffers.id })
          .from(pgOffers)
          .where(and(eq(pgOffers.clerkUserId, clerkUserId), inArray(pgOffers.id, offerIds)))
      : Promise.resolve([]),
    eventIds.length > 0 ? listNeonEventsByIds(eventIds).catch(() => []) : Promise.resolve([]),
  ]);
  const gone = orphanConditionDedupes(
    subjects.map((row) => row.dedupe),
    {
      bets: new Set(betRows.map((r) => r.id)),
      offers: new Set(offerRows.map((r) => r.id)),
      events: new Set(events.map((e) => e.id)),
    }
  );
  if (gone.length === 0) return 0;
  const deleted = await getNeonDb()
    .delete(pgAlertsInbox)
    .where(and(eq(pgAlertsInbox.clerkUserId, clerkUserId), inArray(pgAlertsInbox.dedupe, gone)))
    .returning({ id: pgAlertsInbox.id });
  return deleted.length;
}

export async function listNeonInbox(limit = 100): Promise<AlertsInboxRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  await pruneNeonOrphanConditionAlerts().catch(() => 0);
  await reconcileNeonVoidedSettlementAlerts(clerkUserId, Date.now()).catch(() => {});
  const rows = await getNeonDb()
    .select()
    .from(pgAlertsInbox)
    .where(eq(pgAlertsInbox.clerkUserId, clerkUserId))
    .orderBy(desc(pgAlertsInbox.updatedAt))
    .limit(limit);
  return rows.map(toInboxRow);
}

/** Every inbox dedupe key, including read rows. Watcher uses this as durable seen. */
export async function listNeonInboxDedupes(): Promise<string[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  await pruneNeonOrphanConditionAlerts().catch(() => 0);
  const rows = await getNeonDb()
    .select({ dedupe: pgAlertsInbox.dedupe })
    .from(pgAlertsInbox)
    .where(eq(pgAlertsInbox.clerkUserId, clerkUserId));
  return rows.map((row) => row.dedupe).filter(Boolean);
}

export async function unreadNeonCount(): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const rows = await getNeonDb()
    .select({ n: sql<number>`count(*)` })
    .from(pgAlertsInbox)
    .where(
      and(eq(pgAlertsInbox.clerkUserId, clerkUserId), isNull(pgAlertsInbox.readAt))
    );
  return Number(rows[0]?.n ?? 0);
}

export async function markNeonRead(id: number, now = Date.now()): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .update(pgAlertsInbox)
    .set({ readAt: now })
    .where(and(eq(pgAlertsInbox.id, id), eq(pgAlertsInbox.clerkUserId, clerkUserId)));
}

/**
 * Mark the inbox row for a rules dedupe key as read.
 * If the toast was dismissed before the alert landed, insert a read stub so
 * the later upsert keeps it read.
 */
export async function markNeonReadByDedupe(
  dedupe: string,
  now = Date.now()
): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  return markNeonReadByDedupeForUser(clerkUserId, dedupe, now);
}

/** Explicit-owner variant for system contexts (webhooks, poller). */
export async function markNeonReadByDedupeForUser(
  clerkUserId: string,
  dedupe: string,
  now = Date.now()
): Promise<number> {
  const key = dedupe.trim();
  if (!key) return 0;
  const updated = await getNeonDb()
    .update(pgAlertsInbox)
    .set({ readAt: now })
    .where(
      and(eq(pgAlertsInbox.clerkUserId, clerkUserId), eq(pgAlertsInbox.dedupe, key))
    )
    .returning({ id: pgAlertsInbox.id });
  if (updated.length > 0) return updated.length;
  const kind = key.split(":")[0]?.trim() || "alert";
  await getNeonDb()
    .insert(pgAlertsInbox)
    .values({
      clerkUserId,
      dedupe: key,
      kind,
      title: "Alert",
      createdAt: now,
      updatedAt: now,
      readAt: now,
    })
    .onConflictDoUpdate({
      target: [pgAlertsInbox.clerkUserId, pgAlertsInbox.dedupe],
      set: { readAt: now },
    });
  return 1;
}

/** Mark every inbox row whose dedupe starts with `prefix` as read. */
export async function markNeonReadByDedupePrefix(
  prefix: string,
  now = Date.now()
): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  const p = prefix.trim().replace(/%/g, "");
  if (!clerkUserId || !p) return 0;
  const updated = await getNeonDb()
    .update(pgAlertsInbox)
    .set({ readAt: now })
    .where(
      and(
        eq(pgAlertsInbox.clerkUserId, clerkUserId),
        like(pgAlertsInbox.dedupe, `${p}%`)
      )
    )
    .returning({ id: pgAlertsInbox.id });
  return updated.length;
}

export async function markNeonAllRead(now = Date.now()): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const updated = await getNeonDb()
    .update(pgAlertsInbox)
    .set({ readAt: now })
    .where(
      and(eq(pgAlertsInbox.clerkUserId, clerkUserId), isNull(pgAlertsInbox.readAt))
    )
    .returning({ id: pgAlertsInbox.id });
  return updated.length;
}

/** Unread dedupe keys (push-dismiss tags for mark-all). Desk-scoped. */
export async function listNeonUnreadDedupes(): Promise<string[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select({ dedupe: pgAlertsInbox.dedupe })
    .from(pgAlertsInbox)
    .where(
      and(eq(pgAlertsInbox.clerkUserId, clerkUserId), isNull(pgAlertsInbox.readAt))
    );
  return rows.map((row) => row.dedupe).filter(Boolean);
}

/** Dedupe keys under a prefix (push-dismiss tags). Desk-scoped. */
export async function listNeonDedupesByPrefix(prefix: string): Promise<string[]> {
  const clerkUserId = neonDeskClerkUserId();
  const p = prefix.trim().replace(/%/g, "");
  if (!clerkUserId || !p) return [];
  const rows = await getNeonDb()
    .select({ dedupe: pgAlertsInbox.dedupe })
    .from(pgAlertsInbox)
    .where(
      and(
        eq(pgAlertsInbox.clerkUserId, clerkUserId),
        like(pgAlertsInbox.dedupe, `${p}%`)
      )
    );
  return rows.map((row) => row.dedupe).filter(Boolean);
}

/** The dedupe key for one owned row (push-dismiss tag). Desk-scoped. */
export async function neonInboxDedupeById(id: number): Promise<string | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const rows = await getNeonDb()
    .select({ dedupe: pgAlertsInbox.dedupe })
    .from(pgAlertsInbox)
    .where(and(eq(pgAlertsInbox.id, id), eq(pgAlertsInbox.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0]?.dedupe ?? null;
}
