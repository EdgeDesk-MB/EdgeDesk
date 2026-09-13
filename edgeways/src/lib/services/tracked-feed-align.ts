/**
 * Overlay the durable football day store onto tracked-event live fetches.
 *
 * `live=all` can freeze (57' 0-0 after FT). The date card is store-first and
 * already refreshed by cron; tracked events used to ignore it. Merge here so
 * a posted FT lands even when the live poll is stale or the id fetch failed.
 */
import "server-only";

import type { EventRow } from "@/lib/db/schema";
import { localCalendarDate } from "@/lib/events";
import {
  preferFresherLiveScore,
  type LiveScoreFields,
} from "@/lib/events/live-fixture-overlay";
import { liveFixtureClockIsStale } from "@/lib/live-poll-rules";
import type { Fixture } from "@/lib/services/apifootball";
import {
  readFixtureStore,
  scheduleFixtureStoreRefresh,
} from "@/lib/services/fixture-store";

export async function storedFixturesByExternalId(
  dates: readonly string[]
): Promise<Map<string, Fixture>> {
  const byId = new Map<string, Fixture>();
  const unique = [...new Set(dates.filter(Boolean))];
  for (const date of unique) {
    const row = await readFixtureStore(date).catch(() => null);
    if (!row) continue;
    for (const fixture of row.fixtures) {
      const id = fixture.externalId?.trim();
      if (!id) continue;
      const prev = byId.get(id);
      byId.set(id, prev ? (preferFresherLiveScore(prev, fixture) as Fixture) : fixture);
    }
  }
  return byId;
}

/**
 * For each tracked id, keep the fresher of the live fetch and the day store.
 * Clock-stale live rows also nudge a background store refresh so FT write-through
 * does not wait on the fixtures board or cron.
 */
export async function alignTrackedFootballFixtures(
  events: readonly { externalId: string | null; startTime: number }[],
  fetched: Fixture[],
  now = Date.now()
): Promise<Fixture[]> {
  const ids = [
    ...new Set(
      events
        .map((event) => event.externalId?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (ids.length === 0) return fetched;

  const dates = [
    ...new Set(events.map((event) => localCalendarDate(new Date(event.startTime)))),
  ];
  const storedById = await storedFixturesByExternalId(dates);
  const fetchedById = new Map(
    fetched.filter((row) => row.externalId).map((row) => [row.externalId, row])
  );
  const staleDates = new Set<string>();
  const out: Fixture[] = [];

  for (const id of ids) {
    const live = fetchedById.get(id);
    const stored = storedById.get(id);
    if (live && liveFixtureClockIsStale(live, now)) {
      const event = events.find((row) => row.externalId?.trim() === id);
      if (event) staleDates.add(localCalendarDate(new Date(event.startTime)));
    }
    if (live && stored) {
      out.push(preferFresherLiveScore(live, stored) as Fixture);
    } else if (live) {
      out.push(live);
    } else if (stored) {
      out.push(stored);
      const event = events.find((row) => row.externalId?.trim() === id);
      if (event) staleDates.add(localCalendarDate(new Date(event.startTime)));
    }
  }

  for (const date of staleDates) {
    scheduleFixtureStoreRefresh(date);
  }
  return out;
}

function applyStoredFixtureToEvent<T extends EventRow>(event: T, stored: Fixture): T {
  const chosen = preferFresherLiveScore<LiveScoreFields>(event, stored);
  if (chosen === event) return event;
  const status =
    chosen.status === "finished" || chosen.status === "live" || chosen.status === "upcoming"
      ? chosen.status
      : event.status;
  return {
    ...event,
    status,
    homeScore: chosen.homeScore,
    awayScore: chosen.awayScore,
    minute: chosen.minute ?? event.minute,
    period: chosen.period ?? event.period,
    htHomeScore: chosen.htHomeScore ?? event.htHomeScore,
    htAwayScore: chosen.htAwayScore ?? event.htAwayScore,
    ftHomeScore: chosen.ftHomeScore ?? event.ftHomeScore,
    ftAwayScore: chosen.ftAwayScore ?? event.ftAwayScore,
    matchEnding: chosen.matchEnding ?? event.matchEnding,
  };
}

/**
 * Profit Tracker / Home read the event rows, not the day card. Overlay the
 * store so a frozen live=all write cannot keep the desk on 57' 0-0 after FT.
 */
export async function alignEventRowsWithStoredFixtures<T extends EventRow>(
  events: T[],
  now = Date.now()
): Promise<T[]> {
  const football = events.filter(
    (event) => (event.sport ?? "football") === "football" && event.externalId
  );
  if (football.length === 0) return events;
  const dates = [
    ...new Set(football.map((event) => localCalendarDate(new Date(event.startTime)))),
  ];
  const storedById = await storedFixturesByExternalId(dates);
  if (storedById.size === 0) return events;
  return events.map((event) => {
    if ((event.sport ?? "football") !== "football") return event;
    const id = event.externalId?.trim();
    if (!id) return event;
    const stored = storedById.get(id);
    if (!stored) return event;
    if (event.status === "live" && liveFixtureClockIsStale(event, now)) {
      scheduleFixtureStoreRefresh(localCalendarDate(new Date(event.startTime)));
    }
    return applyStoredFixtureToEvent(event, stored);
  });
}
