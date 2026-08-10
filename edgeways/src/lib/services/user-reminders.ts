/**
 * User-set reminders - free-text notes that fire at a chosen date/time
 * (typical: free spins credited the next day). Delivery reuses the alerts
 * inbox + push channel; expiry nudges stay separate.
 */
import "server-only";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import {
  db,
  casinoOffers,
  offers,
  userReminders,
  type UserReminderRow,
} from "@/lib/db";
import { recordAlerts, type IncomingAlert } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";

export type UserReminderInput = {
  note: string;
  remindAt: number;
  casinoOfferId?: number | null;
  offerId?: number | null;
  contextTitle?: string | null;
  contextVenue?: string | null;
};

/** Build the notification title/body: Reminder · bookie · offer, note as body. */
export function formatUserReminderAlert(input: {
  id: number;
  note: string;
  venue?: string | null;
  offerTitle?: string | null;
  href: string;
}): IncomingAlert {
  const venue = input.venue?.trim() || null;
  const offerTitle = input.offerTitle?.trim() || null;
  const parts = ["Reminder"];
  if (venue) parts.push(venue);
  if (offerTitle) parts.push(offerTitle);
  return {
    key: `user_reminder:${input.id}`,
    kind: "user_reminder",
    title: parts.join(" · "),
    body: input.note.trim(),
    href: input.href,
  };
}

export function createUserReminder(input: UserReminderInput, now = Date.now()): UserReminderRow {
  const note = input.note.trim();
  if (!note) throw new Error("Reminder note is required");
  if (!Number.isFinite(input.remindAt) || input.remindAt < now - 60_000) {
    throw new Error("Reminder time must be in the future");
  }
  const row = db
    .insert(userReminders)
    .values({
      note,
      remindAt: Math.round(input.remindAt),
      casinoOfferId: input.casinoOfferId ?? null,
      offerId: input.offerId ?? null,
      contextTitle: input.contextTitle?.trim() || null,
      contextVenue: input.contextVenue?.trim() || null,
      createdAt: now,
    })
    .returning()
    .get();
  return row;
}

export function cancelUserReminder(id: number, now = Date.now()): boolean {
  const existing = db.select().from(userReminders).where(eq(userReminders.id, id)).get();
  if (!existing || existing.cancelledAt != null || existing.firedAt != null) return false;
  db.update(userReminders)
    .set({ cancelledAt: now })
    .where(eq(userReminders.id, id))
    .run();
  return true;
}

/** Cancel every pending reminder for a casino campaign (e.g. marked completed). */
export function cancelPendingRemindersForCasino(
  casinoOfferId: number,
  now = Date.now()
): number {
  const pending = listPendingRemindersForCasino(casinoOfferId);
  for (const row of pending) {
    db.update(userReminders)
      .set({ cancelledAt: now })
      .where(eq(userReminders.id, row.id))
      .run();
  }
  return pending.length;
}

/** Cancel every pending reminder for a sports offer campaign. */
export function cancelPendingRemindersForOffer(
  offerId: number,
  now = Date.now()
): number {
  const pending = listPendingRemindersForOffer(offerId);
  for (const row of pending) {
    db.update(userReminders)
      .set({ cancelledAt: now })
      .where(eq(userReminders.id, row.id))
      .run();
  }
  return pending.length;
}

export function listPendingRemindersForCasino(casinoOfferId: number): UserReminderRow[] {
  return db
    .select()
    .from(userReminders)
    .where(
      and(
        eq(userReminders.casinoOfferId, casinoOfferId),
        isNull(userReminders.firedAt),
        isNull(userReminders.cancelledAt)
      )
    )
    .orderBy(asc(userReminders.remindAt))
    .all();
}

export function listPendingRemindersForOffer(offerId: number): UserReminderRow[] {
  return db
    .select()
    .from(userReminders)
    .where(
      and(
        eq(userReminders.offerId, offerId),
        isNull(userReminders.firedAt),
        isNull(userReminders.cancelledAt)
      )
    )
    .orderBy(asc(userReminders.remindAt))
    .all();
}

export function listPendingRemindersByCasinoOfferIds(
  casinoOfferIds: number[]
): Map<number, UserReminderRow[]> {
  const map = new Map<number, UserReminderRow[]>();
  if (casinoOfferIds.length === 0) return map;
  for (const id of casinoOfferIds) map.set(id, []);
  const rows = db
    .select()
    .from(userReminders)
    .where(and(isNull(userReminders.firedAt), isNull(userReminders.cancelledAt)))
    .orderBy(asc(userReminders.remindAt))
    .all();
  for (const row of rows) {
    if (row.casinoOfferId == null) continue;
    const list = map.get(row.casinoOfferId);
    if (list) list.push(row);
  }
  return map;
}

export function listPendingRemindersByOfferIds(
  offerIds: number[]
): Map<number, UserReminderRow[]> {
  const map = new Map<number, UserReminderRow[]>();
  if (offerIds.length === 0) return map;
  for (const id of offerIds) map.set(id, []);
  const rows = db
    .select()
    .from(userReminders)
    .where(and(isNull(userReminders.firedAt), isNull(userReminders.cancelledAt)))
    .orderBy(asc(userReminders.remindAt))
    .all();
  for (const row of rows) {
    if (row.offerId == null) continue;
    const list = map.get(row.offerId);
    if (list) list.push(row);
  }
  return map;
}

function resolveReminderContext(row: UserReminderRow): {
  venue: string | null;
  offerTitle: string | null;
  href: string;
} {
  if (row.casinoOfferId != null) {
    const offer = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.id, row.casinoOfferId))
      .get();
    return {
      venue: offer?.casino?.trim() || row.contextVenue?.trim() || null,
      offerTitle: offer?.title?.trim() || row.contextTitle?.trim() || null,
      href: "/casino",
    };
  }
  if (row.offerId != null) {
    const offer = db.select().from(offers).where(eq(offers.id, row.offerId)).get();
    return {
      venue: offer?.bookmaker?.trim() || row.contextVenue?.trim() || null,
      offerTitle: offer?.title?.trim() || row.contextTitle?.trim() || null,
      href: "/offers",
    };
  }
  return {
    venue: row.contextVenue?.trim() || null,
    offerTitle: row.contextTitle?.trim() || null,
    href: "/alerts",
  };
}

function alertForReminder(row: UserReminderRow): IncomingAlert {
  const ctx = resolveReminderContext(row);
  return formatUserReminderAlert({
    id: row.id,
    note: row.note,
    venue: ctx.venue,
    offerTitle: ctx.offerTitle,
    href: ctx.href,
  });
}

/**
 * Fire every due, uncancelled reminder once. Safe to call on every state poll.
 */
export function fireDueUserReminders(now = Date.now()): IncomingAlert[] {
  const due = db
    .select()
    .from(userReminders)
    .where(
      and(
        lte(userReminders.remindAt, now),
        isNull(userReminders.firedAt),
        isNull(userReminders.cancelledAt)
      )
    )
    .orderBy(asc(userReminders.remindAt))
    .all();
  if (due.length === 0) return [];

  const alerts = due.map(alertForReminder);
  recordAlerts(alerts, now);
  for (const row of due) {
    db.update(userReminders)
      .set({ firedAt: now })
      .where(eq(userReminders.id, row.id))
      .run();
  }
  for (const alert of alerts) {
    void sendPush(alert).catch(() => {});
  }
  return alerts;
}
