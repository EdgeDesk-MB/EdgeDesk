/**
 * Per-login follows of the shared Neon events feed. Tracked Events is this
 * desk's list; untracking must not delete the fixture for anyone else.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonEvents } from "@/lib/db/neon-events";
import { deskTrackedEvents } from "@/lib/db/schema.pg";
import { filterEventsForDesk } from "@/lib/events/desk-tracked-events";
import type { EventRow } from "@/lib/db/schema";

export async function listNeonDeskTrackedEventIds(): Promise<number[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select({ eventId: deskTrackedEvents.eventId })
    .from(deskTrackedEvents)
    .where(eq(deskTrackedEvents.clerkUserId, clerkUserId));
  return rows.map((row) => row.eventId);
}

export async function followNeonEvent(eventId: number): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId || !Number.isFinite(eventId) || eventId <= 0) return;
  await getNeonDb()
    .insert(deskTrackedEvents)
    .values({ clerkUserId, eventId, createdAt: Date.now() })
    .onConflictDoNothing({
      target: [deskTrackedEvents.clerkUserId, deskTrackedEvents.eventId],
    });
}

export async function unfollowNeonEvent(eventId: number): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId || !Number.isFinite(eventId) || eventId <= 0) return;
  await getNeonDb()
    .delete(deskTrackedEvents)
    .where(
      and(
        eq(deskTrackedEvents.clerkUserId, clerkUserId),
        eq(deskTrackedEvents.eventId, eventId)
      )
    );
}

export async function listNeonEventsForDesk(): Promise<EventRow[]> {
  const [events, followedIds, bets] = await Promise.all([
    listNeonEvents(),
    listNeonDeskTrackedEventIds(),
    listNeonDeskBets(),
  ]);
  return filterEventsForDesk(events, followedIds, bets);
}
