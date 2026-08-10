import type { KnownFixtureOption } from "@/lib/add-bet-event-options";
import { api } from "@/hooks/use-app-state";
import type { EventRow } from "@/lib/db/schema";

/**
 * Resolve a desk Event pick to a tracked event id.
 * Untracked fixtures are tracked here only (on save), never while the modal is open.
 */
export async function resolveDeskEventIdForSave(input: {
  eventId: number | null;
  pendingFixture: KnownFixtureOption | null;
}): Promise<number | null> {
  const pending = input.pendingFixture;
  if (pending) {
    if (pending.sport === "horse_racing") {
      const res = await api<{ event: EventRow }>("/api/events/track-racing", {
        method: "POST",
        json: {
          course: pending.course || pending.competition,
          startTime: pending.startTime,
          raceName: pending.raceName || pending.homeTeam || undefined,
        },
      });
      return res.event.id;
    }
    const res = await api<{ event: EventRow }>("/api/events/track", {
      method: "POST",
      json: {
        homeTeam: pending.homeTeam,
        awayTeam: pending.awayTeam,
        sport: "football",
        startTime: pending.startTime,
        competition: pending.competition || undefined,
      },
    });
    return res.event.id;
  }
  return input.eventId;
}

/** Resolve many legs; preserves order. */
export async function resolveDeskLegEventIdsForSave<
  T extends { eventId: number | null; pendingFixture: KnownFixtureOption | null },
>(legs: T[]): Promise<(Omit<T, "pendingFixture"> & { eventId: number | null })[]> {
  const out: (Omit<T, "pendingFixture"> & { eventId: number | null })[] = [];
  for (const leg of legs) {
    const { pendingFixture: pending, ...rest } = leg;
    const eventId = await resolveDeskEventIdForSave({
      eventId: leg.eventId,
      pendingFixture: pending,
    });
    out.push({ ...rest, eventId });
  }
  return out;
}
