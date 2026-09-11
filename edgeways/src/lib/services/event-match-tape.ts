/**
 * Store-first match tape. Live polling only fetches the events feed while
 * the row is still in the live window. Finished matches with a score and
 * an empty `goals` column miss that pass. Opening the modal (or a tape
 * backfill) reads the stored row, and on a miss fetches once and writes
 * through. The match view pauses `/api/state`, so a live open also refreshes
 * the tape on a short poll. Do not persist a failed fetch; an empty
 * successful tape is `[]`. Do not overwrite a stored tape with `[]`.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db, events, type EventRow } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  getNeonEvent,
  updateNeonEvent,
  type NeonEventFeedPatch,
} from "@/lib/db/neon-events";
import { fixtureById, fixtureMatchEvents, type Fixture } from "@/lib/services/apifootball";
import { footballEventPatch, isFootballLivePollCandidate } from "@/lib/services/feed-sync-rules";
import { parseMatchTape, type MatchTapeEvent } from "@/lib/events/match-tape";

export type HydrateMatchTapeDeps = {
  fetchTape: (externalId: string, homeTeam: string) => Promise<MatchTapeEvent[]>;
  fetchFixture?: (externalId: string) => Promise<Fixture | null>;
  now?: () => number;
  refresh?: boolean;
};

export type MatchTapePersistPatch = NeonEventFeedPatch & {
  goals: string;
  tapeFetchedAt: number;
};

export function storedFootballTapeIsUsable(goals: string | null | undefined): boolean {
  return parseMatchTape(goals).length > 0;
}

export async function hydrateMatchTapeOnEvent(
  event: EventRow,
  persist: (patch: MatchTapePersistPatch) => Promise<EventRow>,
  deps: HydrateMatchTapeDeps
): Promise<{ event: EventRow; fetched: boolean }> {
  const now = (deps.now ?? Date.now)();
  const hasTape = storedFootballTapeIsUsable(event.goals);
  const liveRefresh =
    Boolean(deps.refresh) && isFootballLivePollCandidate(event, now);

  if (hasTape && !liveRefresh) {
    return { event, fetched: false };
  }
  if ((event.sport ?? "football") !== "football") {
    return { event, fetched: false };
  }
  if (event.source !== "api" || !event.externalId) {
    return { event, fetched: false };
  }

  const tape = await deps.fetchTape(event.externalId, event.homeTeam);
  const keepExisting = hasTape && tape.length === 0;
  const goals = keepExisting ? (event.goals ?? "[]") : JSON.stringify(tape);
  const fixture =
    liveRefresh && deps.fetchFixture
      ? await deps.fetchFixture(event.externalId)
      : null;

  if (keepExisting && !fixture) {
    return { event, fetched: true };
  }

  const tapeFetchedAt = keepExisting ? (event.tapeFetchedAt ?? now) : now;
  const patch: MatchTapePersistPatch = fixture
    ? {
        ...footballEventPatch(event, fixture, goals, { tapeFetchedAt, now }),
        goals,
        tapeFetchedAt,
      }
    : { goals, tapeFetchedAt };
  const next = await persist(patch);
  return { event: next, fetched: true };
}

async function loadEvent(id: number): Promise<EventRow | null> {
  if (isNeonDesk()) return getNeonEvent(id);
  return db.select().from(events).where(eq(events.id, id)).get() ?? null;
}

async function persistTape(
  id: number,
  patch: MatchTapePersistPatch
): Promise<EventRow | null> {
  if (isNeonDesk()) {
    return updateNeonEvent(id, patch);
  }
  db.update(events).set(patch).where(eq(events.id, id)).run();
  return db.select().from(events).where(eq(events.id, id)).get() ?? null;
}

/** Read stored tape, or fetch once and write through. Live `refresh` keeps appending. */
export async function ensureEventMatchTape(
  id: number,
  opts?: { refresh?: boolean }
): Promise<EventRow | null> {
  const existing = await loadEvent(id);
  if (!existing) return null;
  const { event } = await hydrateMatchTapeOnEvent(
    existing,
    async (patch) => (await persistTape(id, patch)) ?? existing,
    {
      fetchTape: fixtureMatchEvents,
      fetchFixture: fixtureById,
      refresh: opts?.refresh,
    }
  );
  return event;
}
