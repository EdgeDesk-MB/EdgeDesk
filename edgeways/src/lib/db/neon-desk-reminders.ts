/**
 * Hosted user reminders. Fire into the Neon inbox + push, never SQLite.
 */
import "server-only";

import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { recordNeonAlerts } from "@/lib/db/neon-alerts-inbox";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDeskCasinoOffer } from "@/lib/db/neon-desk-casino";
import { getNeonDeskOffer } from "@/lib/db/neon-desk-offers";
import {
  userReminders as pgReminders,
  type UserReminderRow as PgReminderRow,
} from "@/lib/db/schema.pg";
import type { UserReminderRow } from "@/lib/db/schema";
import type { IncomingAlert } from "@/lib/services/alerts-inbox";
import {
  formatUserReminderAlert,
  type UserReminderInput,
} from "@/lib/services/user-reminders";
import { sendPush } from "@/lib/services/push";

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteReminder(row: PgReminderRow): UserReminderRow {
  return {
    id: row.id,
    note: row.note,
    remindAt: row.remindAt,
    casinoOfferId: row.casinoOfferId,
    offerId: row.offerId,
    contextTitle: row.contextTitle,
    contextVenue: row.contextVenue,
    createdAt: row.createdAt,
    firedAt: row.firedAt,
    cancelledAt: row.cancelledAt,
  };
}

export async function createNeonUserReminder(
  input: UserReminderInput,
  now = Date.now()
): Promise<UserReminderRow> {
  const clerkUserId = requireClerk("set a reminder");
  const note = input.note.trim();
  if (!note) throw new Error("Reminder note is required");
  if (!Number.isFinite(input.remindAt) || input.remindAt < now - 60_000) {
    throw new Error("Reminder time must be in the future");
  }
  const rows = await getNeonDb()
    .insert(pgReminders)
    .values({
      note,
      remindAt: Math.round(input.remindAt),
      casinoOfferId: input.casinoOfferId ?? null,
      offerId: input.offerId ?? null,
      contextTitle: input.contextTitle?.trim() || null,
      contextVenue: input.contextVenue?.trim() || null,
      createdAt: now,
      clerkUserId,
    })
    .returning();
  if (!rows[0]) throw new Error("Neon did not return the reminder.");
  return toSqliteReminder(rows[0]);
}

export async function cancelNeonUserReminder(
  id: number,
  now = Date.now()
): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const existing = await getNeonDb()
    .select()
    .from(pgReminders)
    .where(and(eq(pgReminders.id, id), eq(pgReminders.clerkUserId, clerkUserId)))
    .limit(1);
  const row = existing[0];
  if (!row || row.cancelledAt != null || row.firedAt != null) return false;
  await getNeonDb()
    .update(pgReminders)
    .set({ cancelledAt: now })
    .where(and(eq(pgReminders.id, id), eq(pgReminders.clerkUserId, clerkUserId)));
  return true;
}

export async function listNeonPendingRemindersForCasino(
  casinoOfferId: number
): Promise<UserReminderRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgReminders)
    .where(
      and(
        eq(pgReminders.clerkUserId, clerkUserId),
        eq(pgReminders.casinoOfferId, casinoOfferId),
        isNull(pgReminders.firedAt),
        isNull(pgReminders.cancelledAt)
      )
    )
    .orderBy(asc(pgReminders.remindAt));
  return rows.map(toSqliteReminder);
}

export async function listNeonPendingRemindersForOffer(
  offerId: number
): Promise<UserReminderRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgReminders)
    .where(
      and(
        eq(pgReminders.clerkUserId, clerkUserId),
        eq(pgReminders.offerId, offerId),
        isNull(pgReminders.firedAt),
        isNull(pgReminders.cancelledAt)
      )
    )
    .orderBy(asc(pgReminders.remindAt));
  return rows.map(toSqliteReminder);
}

async function resolveReminderContext(row: UserReminderRow): Promise<{
  venue: string | null;
  offerTitle: string | null;
  href: string;
}> {
  if (row.casinoOfferId != null) {
    const offer = await getNeonDeskCasinoOffer(row.casinoOfferId).catch(() => null);
    return {
      venue: offer?.casino?.trim() || row.contextVenue?.trim() || null,
      offerTitle: offer?.title?.trim() || row.contextTitle?.trim() || null,
      href: "/casino",
    };
  }
  if (row.offerId != null) {
    const offer = await getNeonDeskOffer(row.offerId).catch(() => null);
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

export async function fireDueNeonUserReminders(
  now = Date.now()
): Promise<IncomingAlert[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const due = await getNeonDb()
    .select()
    .from(pgReminders)
    .where(
      and(
        eq(pgReminders.clerkUserId, clerkUserId),
        lte(pgReminders.remindAt, now),
        isNull(pgReminders.firedAt),
        isNull(pgReminders.cancelledAt)
      )
    )
    .orderBy(asc(pgReminders.remindAt));
  if (due.length === 0) return [];

  const alerts: IncomingAlert[] = [];
  for (const raw of due) {
    const row = toSqliteReminder(raw);
    const ctx = await resolveReminderContext(row);
    alerts.push(
      formatUserReminderAlert({
        id: row.id,
        note: row.note,
        venue: ctx.venue,
        offerTitle: ctx.offerTitle,
        href: ctx.href,
      })
    );
  }
  await recordNeonAlerts(alerts, now);
  for (const raw of due) {
    await getNeonDb()
      .update(pgReminders)
      .set({ firedAt: now })
      .where(and(eq(pgReminders.id, raw.id), eq(pgReminders.clerkUserId, clerkUserId)));
  }
  for (const alert of alerts) {
    void sendPush(alert).catch(() => {});
  }
  return alerts;
}
