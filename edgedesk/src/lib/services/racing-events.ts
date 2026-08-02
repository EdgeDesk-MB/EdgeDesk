/**
 * Find or create a tracked horse-racing event from course + off time.
 */
import { db, events, type EventRow } from "@/lib/db";
import { eq } from "drizzle-orm";
import { formatEventTime } from "@/lib/events";
import { serializeRacecardRunners } from "@/lib/racing";
import {
  hasRacingApiKey,
  racecardsFree,
  type RacingRacecard,
} from "@/lib/services/theracingapi";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";

function normaliseCourse(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(aw\)/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function coursesMatch(a: string, b: string): boolean {
  const na = normaliseCourse(a);
  const nb = normaliseCourse(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function matchRacecard(
  cards: RacingRacecard[],
  course: string,
  startTime: number
): RacingRacecard | undefined {
  return cards.find(
    (c) => coursesMatch(c.course, course) && Math.abs(c.startTime - startTime) < 6 * 60 * 1000
  );
}

function findExistingEvent(course: string, startTime: number): EventRow | undefined {
  return db
    .select()
    .from(events)
    .all()
    .find(
      (e) =>
        e.sport === "horse_racing" &&
        e.startTime &&
        Math.abs(e.startTime - startTime) < 6 * 60 * 1000 &&
        coursesMatch(e.competition ?? "", course)
    );
}

export async function findOrCreateRacingEvent(opts: {
  course: string;
  startTime: number;
  raceName?: string;
}): Promise<{ event: EventRow; mode: "existing" | "api" | "manual" }> {
  const course = opts.course.trim();
  if (!course) throw new Error("Course is required");

  const existing = findExistingEvent(course, opts.startTime);
  if (existing) {
    await syncRacingResultsForEvents([existing.id]);
    const refreshed = db.select().from(events).where(eq(events.id, existing.id)).get() ?? existing;
    return { event: refreshed, mode: "existing" };
  }

  if (hasRacingApiKey()) {
    // Racing API failures (budget exhausted, network, auth) must never block
    // tracking the race - fall through to the manual event below, same as
    // when the API is reachable but simply has no matching card.
    try {
      let card = matchRacecard(await racecardsFree("today"), course, opts.startTime);
      if (!card) card = matchRacecard(await racecardsFree("tomorrow"), course, opts.startTime);

      if (card) {
        const byExternal = db
          .select()
          .from(events)
          .all()
          .find((e) => e.externalId === card!.externalId);
        if (byExternal) {
          await syncRacingResultsForEvents([byExternal.id]);
          const refreshed =
            db.select().from(events).where(eq(events.id, byExternal.id)).get() ?? byExternal;
          return { event: refreshed, mode: "existing" };
        }

        const inserted = db
          .insert(events)
          .values({
            sport: "horse_racing",
            competition: card.course,
            homeTeam: opts.raceName?.trim() || card.raceName,
            awayTeam: card.offTime,
            startTime: card.startTime,
            source: "api",
            externalId: card.externalId,
            status: card.status,
            goals: card.runners.length
              ? serializeRacecardRunners(card.runners, {
                  type: card.type,
                  distance: card.distance,
                  raceClass: card.raceClass,
                  prize: card.prize,
                  going: card.going,
                  fieldSize: card.fieldSize,
                })
              : null,
            createdAt: Date.now(),
          })
          .returning()
          .get();
        await syncRacingResultsForEvents([inserted.id]);
        const refreshed = db.select().from(events).where(eq(events.id, inserted.id)).get() ?? inserted;
        return { event: refreshed, mode: "api" };
      }
    } catch {
      // fall through to manual tracking below
    }
  }

  const now = Date.now();
  // Past offs are finished (late link from Profit Tracker); in-play window stays live.
  const status =
    opts.startTime <= now - 5 * 60_000
      ? "finished"
      : opts.startTime <= now
        ? "live"
        : "upcoming";
  const inserted = db
    .insert(events)
    .values({
      sport: "horse_racing",
      competition: course,
      homeTeam: opts.raceName?.trim() || "Race",
      awayTeam: formatEventTime(opts.startTime),
      startTime: opts.startTime,
      source: "manual",
      status,
      createdAt: now,
    })
    .returning()
    .get();
  return { event: inserted, mode: "manual" };
}

export { parseRacingCourseFromEventName } from "@/lib/events";
