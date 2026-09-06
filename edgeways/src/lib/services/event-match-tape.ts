/**
 * Store-first match tape. Live polling only fetches the events feed while
 * the row is still in the live window. Finished matches with a score and
 * an empty `goals` column miss that pass. Opening the modal (or a tape
 * backfill) reads the stored row, and on a miss fetches once and writes
 * through. Do not persist a failed fetch; an empty successful tape is `[]`.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db, events, type EventRow } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { getNeonEvent, updateNeonEvent } from "@/lib/db/neon-events";
import { fixtureMatchEvents } from "@/lib/services/apifootball";
import { parseMatchTape, type MatchTapeEvent } from "@/lib/events/match-tape";

export type HydrateMatchTapeDeps = {
  fetchTape: (externalId: string, homeTeam: string) => Promise<MatchTapeEvent[]>;
  now?: () => number;
};

export function storedFootballTapeIsUsable(goals: string | null | undefined): boolean {
  return parseMatchTape(goals).length > 0;
}

export async function hydrateMatchTapeOnEvent(
  event: EventRow,
  persist: (patch: { goals: string; tapeFetchedAt: number }) => Promise<EventRow>,
  deps: HydrateMatchTapeDeps
): Promise<{ event: EventRow; fetched: boolean }> {
  if (storedFootballTapeIsUsable(event.goals)) {
    return { event, fetched: false };
  }
  if ((event.sport ?? "football") !== "football") {
    return { event, fetched: false };
  }
  if (event.source !== "api" || !event.externalId) {
    return { event, fetched: false };
  }

  const tape = await deps.fetchTape(event.externalId, event.homeTeam);
  const now = (deps.now ?? Date.now)();
  const next = await persist({
    goals: JSON.stringify(tape),
    tapeFetchedAt: now,
  });
  return { event: next, fetched: true };
}

async function loadEvent(id: number): Promise<EventRow | null> {
  if (isNeonDesk()) return getNeonEvent(id);
  return db.select().from(events).where(eq(events.id, id)).get() ?? null;
}

async function persistTape(
  id: number,
  patch: { goals: string; tapeFetchedAt: number }
): Promise<EventRow | null> {
  if (isNeonDesk()) {
    return updateNeonEvent(id, patch);
  }
  db.update(events).set(patch).where(eq(events.id, id)).run();
  return db.select().from(events).where(eq(events.id, id)).get() ?? null;
}

/** Read stored tape, or fetch once and write through. */
export async function ensureEventMatchTape(id: number): Promise<EventRow | null> {
  const existing = await loadEvent(id);
  if (!existing) return null;
  const { event } = await hydrateMatchTapeOnEvent(
    existing,
    async (patch) => (await persistTape(id, patch)) ?? existing,
    { fetchTape: fixtureMatchEvents }
  );
  return event;
}
