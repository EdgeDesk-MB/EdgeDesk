/**
 * Same-day multi-race offer persistence.
 *
 * When a one-shot course-day or regional (UK & Ireland) racing offer gets its
 * first linked bet, spawn a fresh sibling with the same scope/rules/date so the
 * Racing Desk keeps showing the offer for the next race — no visual gap.
 *
 * Race-scoped campaigns are one-shot and never spawn.
 * Recurring series instances (`seriesId`) are one use per `eventDate` — tomorrow
 * is a separate series row, so they never spawn same-day twins (otherwise Race
 * picks keeps recommending after today's play).
 *
 * Also: course expiry sync — when we have live racecard data, set expiresAt
 * to 30 min after the last race at that course starts (null expires only).
 */
import { eq } from "drizzle-orm";
import "server-only";
import { db, offers, bets } from "@/lib/db";
import type { OfferRow } from "@/lib/db/schema";
import {
  isRegionalScope,
  normalizeCourseName,
  offerHasResultTrigger,
  parseOfferRules,
  parseScopeCourses,
} from "@/lib/offers/racing-offer-rules";
import type { RacingRacecard } from "@/lib/services/theracingapi";

/** True when the offer is locked to specific named course(s) (not all UK/IRE). */
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

/**
 * Same-day multi-race cards: dated place-refund offers that are not locked
 * to a single race — either a named course day or regional UK & Ireland.
 * Straight bet&get / multiples (no result trigger) never spawn siblings.
 */
export function isSameDayMultiRaceOffer(offer: OfferRow): boolean {
  if (offer.sport !== "horse_racing") return false;
  if (!offer.eventDate?.trim()) return false;
  if (offer.scopeRaceId?.trim()) return false;
  if (!offerHasResultTrigger(parseOfferRules(offer))) return false;
  // Regional (uk_ire / all / any) or specific course(s).
  return true;
}

/** @deprecated Use isSameDayMultiRaceOffer — kept for course-only callers. */
export function isCourseDayOffer(offer: OfferRow): boolean {
  return isSpecificCourseOffer(offer) && isSameDayMultiRaceOffer(offer);
}

function scopeGroupKey(offer: OfferRow): string {
  if (isRegionalScope(offer.scopeCourse)) {
    const rules = parseOfferRules(offer);
    const regions = (rules?.regions?.length ? rules.regions : ["GB", "IRE"])
      .slice()
      .sort()
      .join(",");
    return `regional:${regions}`;
  }
  return parseScopeCourses(offer.scopeCourse)
    .map(normalizeCourseName)
    .sort()
    .join(",");
}

function groupKey(offer: OfferRow): GroupKey {
  return [
    scopeGroupKey(offer),
    offer.eventDate ?? "",
    (offer.bookmaker ?? "").toLowerCase().trim(),
    offer.title.toLowerCase().trim(),
  ].join("|");
}

function betCountByOfferId(
  allBets: Array<{ offerId: number | null }>
): Map<number, number> {
  const betCountByOffer = new Map<number, number>();
  for (const bet of allBets) {
    if (bet.offerId == null) continue;
    betCountByOffer.set(bet.offerId, (betCountByOffer.get(bet.offerId) ?? 0) + 1);
  }
  return betCountByOffer;
}

function completeUnusedOffer(offerId: number, now: number): void {
  db.update(offers)
    .set({ status: "completed", completedAt: now })
    .where(eq(offers.id, offerId))
    .run();
}

/**
 * After a recurring series day's instance is finished, retire unused same-day
 * twins so Race picks stops. Non-series multi-use keeps its fresh desk card
 * (user deletes it when done — sync must not respawn).
 */
export function retireUnusedSameDayOfferSiblings(completedOfferId: number): void {
  const completed = db.select().from(offers).where(eq(offers.id, completedOfferId)).get();
  if (!completed || !isSameDayMultiRaceOffer(completed)) return;
  if (completed.status !== "completed" && completed.status !== "expired") return;

  const key = groupKey(completed);
  const group = db
    .select()
    .from(offers)
    .all()
    .filter((o) => isSameDayMultiRaceOffer(o) && groupKey(o) === key);
  // Only series days are one-shot; course multi-use twins stay for the next race.
  if (!group.some((o) => o.seriesId != null)) return;

  const betCounts = betCountByOfferId(
    db.select({ offerId: bets.offerId }).from(bets).all()
  );
  const now = Date.now();

  for (const offer of group) {
    if (offer.id === completedOfferId) continue;
    if (offer.status !== "active" && offer.status !== "planned") continue;
    if ((betCounts.get(offer.id) ?? 0) > 0) continue;
    completeUnusedOffer(offer.id, now);
  }
}

/**
 * Recurring series days are one play per eventDate. If today's series instance
 * already has bets (or is finished), complete any unused orphan twins that an
 * older spawn left behind — otherwise Race picks keeps recommending.
 *
 * Safe on every status sync — never inserts rows. Does not touch non-series
 * multi-use continuity cards.
 */
export function reconcileSameDayOfferSiblings(): void {
  const allOffers = db.select().from(offers).all();
  const betCounts = betCountByOfferId(
    db.select({ offerId: bets.offerId }).from(bets).all()
  );
  const now = Date.now();

  const groups = new Map<GroupKey, OfferRow[]>();
  for (const offer of allOffers) {
    if (!isSameDayMultiRaceOffer(offer)) continue;
    const key = groupKey(offer);
    const group = groups.get(key) ?? [];
    group.push(offer);
    groups.set(key, group);
  }

  for (const [, group] of groups) {
    if (!group.some((o) => o.seriesId != null)) continue;

    const seriesUsed = group.some(
      (o) => o.seriesId != null && (betCounts.get(o.id) ?? 0) > 0
    );
    const seriesFinished = group.some(
      (o) =>
        o.seriesId != null && (o.status === "completed" || o.status === "expired")
    );
    if (!seriesUsed && !seriesFinished) continue;

    for (const offer of group) {
      if (offer.status !== "active" && offer.status !== "planned") continue;
      if ((betCounts.get(offer.id) ?? 0) > 0) continue;
      completeUnusedOffer(offer.id, now);
    }
  }
}

/**
 * Ensure there is always exactly one "fresh" (no linked bets) sibling offer for
 * each same-day multi-race group that has all been used.
 *
 * Race-scoped campaigns are excluded: counting them as "used" was recreating a
 * course-wide duplicate every time the user deleted the fresh sibling.
 * Recurring series instances are excluded: one play per eventDate.
 *
 * Call only after a bet is created or linked to an offer, not on every
 * syncOfferStatuses() / state poll. Otherwise deleting an unused fresh card
 * immediately respawns an identical one while a used sibling still exists.
 */
export function ensureSameDayOfferSiblings(
  allOffers: OfferRow[],
  allBets: Array<{ offerId: number | null }>
): void {
  const betCountByOffer = betCountByOfferId(allBets);

  // Group active/planned same-day offers by (scope, date, bookie, title)
  const groups = new Map<GroupKey, OfferRow[]>();
  for (const offer of allOffers) {
    if (offer.status !== "active" && offer.status !== "planned") continue;
    if (!isSameDayMultiRaceOffer(offer)) continue;
    // Recurring daily campaigns: tomorrow is a separate series row.
    if (offer.seriesId != null) continue;

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
    const source = withBets.sort((a, b) => b.createdAt - a.createdAt)[0]!;
    if (source.seriesId != null) continue;
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
        offerUrl: source.offerUrl,
        startsOn: source.startsOn,
        // Inherit any already-computed race-expiry (may be null until Racing Desk runs)
        expiresAt: source.expiresAt,
        createdAt: now,
      })
      .run();
  }
}

/** @deprecated Prefer ensureSameDayOfferSiblings. */
export function ensureCourseOfferSiblings(
  allOffers: OfferRow[],
  allBets: Array<{ offerId: number | null }>
): void {
  ensureSameDayOfferSiblings(allOffers, allBets);
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
    const keys = parseScopeCourses(offer.scopeCourse).map(normalizeCourseName);
    let lastRace: RacingRacecard | null = null;
    for (const key of keys) {
      const races = racesByCourse.get(key);
      if (!races?.length) continue;
      const courseLast = races.reduce((a, b) => (b.startTime > a.startTime ? b : a));
      if (!lastRace || courseLast.startTime > lastRace.startTime) lastRace = courseLast;
    }
    if (!lastRace) continue;

    // 30-minute window after last scheduled off-time across scoped courses
    const newExpiry = lastRace.startTime + 30 * 60 * 1000;

    db.update(offers).set({ expiresAt: newExpiry }).where(eq(offers.id, offer.id)).run();
  }
}
