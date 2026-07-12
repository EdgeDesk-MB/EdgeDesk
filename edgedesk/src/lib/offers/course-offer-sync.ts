/**
 * Persistence helpers for course-scoped racing offers:
 *
 * 1. Sibling spawning: when all offers for a given course/date/title group
 *    have at least one linked bet, spawn a fresh copy so the next race at the
 *    same course always has an available campaign card.
 *
 * 2. Expiry sync: when we have live racecard data, set expiresAt to 30 min
 *    after the last race at that course starts, so stale fresh cards auto-expire.
 */
import { eq } from "drizzle-orm";
import "server-only";
import { db, offers, bets } from "@/lib/db";
import type { OfferRow } from "@/lib/db/schema";
import { isRegionalScope, normalizeCourseName } from "@/lib/offers/racing-offer-rules";
import type { RacingRacecard } from "@/lib/services/theracingapi";

/** True when the offer is locked to a specific named course (not all UK/IRE). */
export function isSpecificCourseOffer(
  offer: Pick<OfferRow, "sport" | "scopeCourse">
): boolean {
  return (
    offer.sport === "horse_racing" &&
    Boolean(offer.scopeCourse?.trim()) &&
    !isRegionalScope(offer.scopeCourse)
  );
}

type GroupKey = string;

function groupKey(offer: OfferRow): GroupKey {
  return [
    normalizeCourseName(offer.scopeCourse!),
    offer.eventDate ?? "",
    (offer.bookmaker ?? "").toLowerCase().trim(),
    offer.title.toLowerCase().trim(),
  ].join("|");
}

/**
 * Ensure there is always exactly one "fresh" (no linked bets) sibling offer for
 * each group of course-scoped offers that have all been used.
 * Call this at the end of syncOfferStatuses(), passing allOffers + allBets from
 * the same DB snapshot to avoid extra round-trips.
 */
export function ensureCourseOfferSiblings(
  allOffers: OfferRow[],
  allBets: Array<{ offerId: number | null }>
): void {
  const betCountByOffer = new Map<number, number>();
  for (const bet of allBets) {
    if (bet.offerId == null) continue;
    betCountByOffer.set(bet.offerId, (betCountByOffer.get(bet.offerId) ?? 0) + 1);
  }

  // Group active/planned course-scoped offers by (course, date, bookie, title)
  const groups = new Map<GroupKey, OfferRow[]>();
  for (const offer of allOffers) {
    if (offer.status !== "active" && offer.status !== "planned") continue;
    if (!isSpecificCourseOffer(offer)) continue;
    if (!offer.eventDate) continue;

    const key = groupKey(offer);
    const group = groups.get(key) ?? [];
    group.push(offer);
    groups.set(key, group);
  }

  const now = Date.now();

  for (const [, group] of groups) {
    const withBets = group.filter((o) => (betCountByOffer.get(o.id) ?? 0) > 0);
    const fresh = group.filter((o) => (betCountByOffer.get(o.id) ?? 0) === 0);

    if (withBets.length === 0 || fresh.length > 0) continue;

    // Every card in this group has been used — spawn one fresh sibling
    const source = withBets.sort((a, b) => b.createdAt - a.createdAt)[0];
    db.insert(offers)
      .values({
        bookmaker: source.bookmaker,
        title: source.title,
        description: source.description,
        expectedProfit: source.expectedProfit,
        status: "active",
        sport: source.sport,
        offerType: source.offerType,
        scopeCourse: source.scopeCourse,
        eventDate: source.eventDate,
        scopeRaceId: null,
        scopeRaceLabel: null,
        rules: source.rules,
        // Inherit any already-computed race-expiry (may be null until Racing Desk runs)
        expiresAt: source.expiresAt,
        createdAt: now,
      })
      .run();
  }
}

/**
 * Set expiresAt on course-scoped offers to 30 min after the last race at
 * that course starts. Only updates rows where expiresAt is currently null
 * (i.e. the user hasn't set an explicit override, and we haven't run before).
 * Call this from getRacingDesk() after racecards are loaded.
 */
export function syncCourseOfferExpiryFromRaces(
  racecards: RacingRacecard[],
  date: string
): void {
  const courseOffers = db
    .select()
    .from(offers)
    .all()
    .filter(
      (o) =>
        o.sport === "horse_racing" &&
        o.eventDate === date &&
        isSpecificCourseOffer(o) &&
        (o.status === "active" || o.status === "planned") &&
        o.expiresAt == null
    );

  if (courseOffers.length === 0) return;

  const racesByCourse = new Map<string, RacingRacecard[]>();
  for (const card of racecards) {
    const key = normalizeCourseName(card.course);
    const list = racesByCourse.get(key) ?? [];
    list.push(card);
    racesByCourse.set(key, list);
  }

  for (const offer of courseOffers) {
    const races = racesByCourse.get(normalizeCourseName(offer.scopeCourse!));
    if (!races || races.length === 0) continue;

    const lastRace = races.reduce((a, b) => (b.startTime > a.startTime ? b : a));
    // 30-minute window after last scheduled off-time
    const newExpiry = lastRace.startTime + 30 * 60 * 1000;

    db.update(offers).set({ expiresAt: newExpiry }).where(eq(offers.id, offer.id)).run();
  }
}
