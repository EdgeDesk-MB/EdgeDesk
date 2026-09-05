/**
 * Offer inbox (email forwarding) on Neon. Settings actions run in the
 * signed-in desk actor's context; the inbound webhook runs with no actor,
 * so owner resolution goes token → clerk_user_id explicitly, same system
 * context pattern as the hosted feed poller.
 */
import "server-only";

import { and, count, desc, eq, gte, lt, max } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import {
  offerInboxAddresses as pgOfferInboxAddresses,
  offerInboundMessages as pgOfferInboundMessages,
} from "@/lib/db/schema.pg";

export interface NeonOfferInboxRow {
  id: number;
  token: string;
  clerkUserId: string;
  createdAt: number;
}

function toRow(row: typeof pgOfferInboxAddresses.$inferSelect): NeonOfferInboxRow {
  return {
    id: row.id,
    token: row.token,
    clerkUserId: row.clerkUserId,
    createdAt: row.createdAt,
  };
}

/** Settings context: this login's address, if the inbox is on. */
export async function getNeonOfferInbox(): Promise<NeonOfferInboxRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const rows = await getNeonDb()
    .select()
    .from(pgOfferInboxAddresses)
    .where(eq(pgOfferInboxAddresses.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

/** Create (or return) this login's address. Throws when signed out. */
export async function enableNeonOfferInbox(token: string): Promise<NeonOfferInboxRow> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error("Sign in to turn on your offer inbox.");
  const existing = await getNeonOfferInbox();
  if (existing) return existing;
  const rows = await getNeonDb()
    .insert(pgOfferInboxAddresses)
    .values({ token, clerkUserId, createdAt: Date.now() })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Neon did not return the inbox address.");
  return toRow(row);
}

/** Swap the token (the old address dies immediately). Throws when off. */
export async function rotateNeonOfferInbox(token: string): Promise<NeonOfferInboxRow> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error("Sign in to change your offer inbox.");
  const rows = await getNeonDb()
    .update(pgOfferInboxAddresses)
    .set({ token })
    .where(eq(pgOfferInboxAddresses.clerkUserId, clerkUserId))
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Turn on your offer inbox first.");
  return toRow(row);
}

export async function disableNeonOfferInbox(): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgOfferInboxAddresses)
    .where(eq(pgOfferInboxAddresses.clerkUserId, clerkUserId));
}

/** Webhook context: who owns this address token? Null = silent drop. */
export async function findNeonInboxOwnerByToken(token: string): Promise<string | null> {
  const rows = await getNeonDb()
    .select({ clerkUserId: pgOfferInboxAddresses.clerkUserId })
    .from(pgOfferInboxAddresses)
    .where(eq(pgOfferInboxAddresses.token, token))
    .limit(1);
  return rows[0]?.clerkUserId ?? null;
}

export async function findNeonInboundByMessageId(
  clerkUserId: string,
  messageId: string
): Promise<boolean> {
  const rows = await getNeonDb()
    .select({ id: pgOfferInboundMessages.id })
    .from(pgOfferInboundMessages)
    .where(
      and(
        eq(pgOfferInboundMessages.clerkUserId, clerkUserId),
        eq(pgOfferInboundMessages.messageId, messageId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Same campaign re-forwarded: fingerprint match inside the window. */
export async function findNeonInboundByFingerprint(
  clerkUserId: string,
  fingerprint: string,
  sinceMs: number
): Promise<boolean> {
  const rows = await getNeonDb()
    .select({ id: pgOfferInboundMessages.id })
    .from(pgOfferInboundMessages)
    .where(
      and(
        eq(pgOfferInboundMessages.clerkUserId, clerkUserId),
        eq(pgOfferInboundMessages.fingerprint, fingerprint),
        gte(pgOfferInboundMessages.createdAt, sinceMs)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function countNeonInboundSince(
  clerkUserId: string,
  sinceMs: number
): Promise<number> {
  const rows = await getNeonDb()
    .select({ n: count() })
    .from(pgOfferInboundMessages)
    .where(
      and(
        eq(pgOfferInboundMessages.clerkUserId, clerkUserId),
        gte(pgOfferInboundMessages.createdAt, sinceMs)
      )
    );
  return rows[0]?.n ?? 0;
}

export async function recordNeonInboundMessage(input: {
  clerkUserId: string;
  messageId: string | null;
  fingerprint: string;
  status: "drafted" | "duplicate" | "failed";
  offerId: number | null;
}): Promise<void> {
  await getNeonDb()
    .insert(pgOfferInboundMessages)
    .values({
      clerkUserId: input.clerkUserId,
      messageId: input.messageId,
      fingerprint: input.fingerprint,
      status: input.status,
      offerId: input.offerId,
      createdAt: Date.now(),
    })
    // A retried provider delivery with the same message id is a no-op.
    .onConflictDoNothing({
      target: [
        pgOfferInboundMessages.clerkUserId,
        pgOfferInboundMessages.messageId,
      ],
    });
}

export async function getNeonOfferInboxStats(
  clerkUserId: string
): Promise<{ totalReceived: number; lastReceivedAt: number | null }> {
  const rows = await getNeonDb()
    .select({ n: count(), last: max(pgOfferInboundMessages.createdAt) })
    .from(pgOfferInboundMessages)
    .where(eq(pgOfferInboundMessages.clerkUserId, clerkUserId));
  return {
    totalReceived: rows[0]?.n ?? 0,
    lastReceivedAt: rows[0]?.last ?? null,
  };
}

/** Retention: receipt log rows older than the cutoff are deleted on ingest. */
export async function pruneNeonInbound(
  clerkUserId: string,
  beforeMs: number
): Promise<void> {
  await getNeonDb()
    .delete(pgOfferInboundMessages)
    .where(
      and(
        eq(pgOfferInboundMessages.clerkUserId, clerkUserId),
        lt(pgOfferInboundMessages.createdAt, beforeMs)
      )
    );
}

/** Recent drafted rows, newest first, for the settings card. */
export async function listNeonRecentInbound(
  clerkUserId: string,
  limit = 5
): Promise<Array<{ status: string; createdAt: number }>> {
  const rows = await getNeonDb()
    .select({
      status: pgOfferInboundMessages.status,
      createdAt: pgOfferInboundMessages.createdAt,
    })
    .from(pgOfferInboundMessages)
    .where(eq(pgOfferInboundMessages.clerkUserId, clerkUserId))
    .orderBy(desc(pgOfferInboundMessages.createdAt))
    .limit(limit);
  return rows;
}
