import "server-only";

import { eq } from "drizzle-orm";
import { crestLockupIconPath, footballPushBetId } from "@/lib/alerts/crest-lockup";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { db, bets, events, type EventRow } from "@/lib/db";
import { localCalendarDate } from "@/lib/events";
import { readFixtureStore } from "@/lib/services/fixture-store";

async function eventForPushKey(
  key: string,
  clerkUserId?: string | null
): Promise<EventRow | null> {
  const betId = footballPushBetId(key);
  if (!betId) return null;

  if (isNeonDesk()) {
    if (!clerkUserId) return null;
    const [{ getNeonDb }, { bets: pgBets }, { getNeonEvent }] = await Promise.all([
      import("@/lib/db/neon"),
      import("@/lib/db/schema.pg"),
      import("@/lib/db/neon-events"),
    ]);
    const { and } = await import("drizzle-orm");
    const rows = await getNeonDb()
      .select({ eventId: pgBets.eventId })
      .from(pgBets)
      .where(and(eq(pgBets.id, betId), eq(pgBets.clerkUserId, clerkUserId)))
      .limit(1);
    const eventId = rows[0]?.eventId;
    if (eventId == null) return null;
    return getNeonEvent(eventId);
  }

  const bet = db.select().from(bets).where(eq(bets.id, betId)).get();
  if (bet?.eventId == null) return null;
  return db.select().from(events).where(eq(events.id, bet.eventId)).get() ?? null;
}

export async function crestsFromFixtureStore(event: {
  sport?: string | null;
  externalId?: string | null;
  startTime?: number | null;
}): Promise<{ homeLogo?: string | null; awayLogo?: string | null } | null> {
  if (event.sport && event.sport !== "football") return null;
  const externalId = event.externalId?.trim();
  if (!externalId || event.startTime == null) return null;
  const date = localCalendarDate(new Date(event.startTime));
  const stored = await readFixtureStore(date).catch(() => null);
  const fixture = stored?.fixtures.find((row) => row.externalId === externalId);
  if (!fixture?.homeLogo && !fixture?.awayLogo) return null;
  return { homeLogo: fixture.homeLogo, awayLogo: fixture.awayLogo };
}

export async function resolveCrestLockupIconForAlert(
  key: string,
  clerkUserId?: string | null
): Promise<string | null> {
  const event = await eventForPushKey(key, clerkUserId);
  if (!event?.externalId || event.startTime == null) return null;
  const crests = await crestsFromFixtureStore(event);
  if (!crests) return null;
  return crestLockupIconPath({
    externalId: event.externalId,
    date: localCalendarDate(new Date(event.startTime)),
  });
}
