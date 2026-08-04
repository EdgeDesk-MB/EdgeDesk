/**
 * Recurring offers: one series template, materialised instances (unique offer IDs).
 * Turning recurrence off on any instance stops future occurrences from that date.
 */
import "server-only";

import { eq } from "drizzle-orm";
import {
  db,
  bets,
  offers,
  offerSeries,
  offerEvSnapshots,
  offerEffortSamples,
  type OfferRow,
} from "@/lib/db";

type OfferSeriesRow = typeof offerSeries.$inferSelect;

import type { OfferRecurrenceMeta, OfferRecurrenceRule } from "@/lib/services/offers.types";
import {
  addDaysYmd,
  encodeSkippedDates,
  expandRecurrenceDates,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
  parseSkippedDates,
  type OfferDeleteScope,
} from "@/lib/offers/offer-recurrence-shared";

export type { OfferRecurrenceFreq, OfferRecurrenceMeta, OfferRecurrenceRule } from "@/lib/services/offers.types";
export type { OfferDeleteScope };
export {
  DEFAULT_RECURRENCE_RULE,
  addDaysYmd,
  encodeSkippedDates,
  expandRecurrenceDates,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
  parseSkippedDates,
  recurringDetailPrefix,
} from "@/lib/offers/offer-recurrence-shared";

export type OfferInstanceTemplate = Pick<
  OfferRow,
  | "bookmaker"
  | "title"
  | "description"
  | "expectedProfit"
  | "sport"
  | "offerType"
  | "scopeCourse"
  | "scopeRaceId"
  | "scopeRaceLabel"
  | "rules"
  | "expiresAt"
>;

function instanceStatusForDate(instanceDate: string, todayKey: string): OfferRow["status"] {
  if (instanceDate < todayKey) return "expired";
  if (instanceDate === todayKey) return "active";
  return "planned";
}

function isRacingSport(sport: string | null | undefined): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}

function insertInstance(
  series: OfferSeriesRow,
  instanceDate: string,
  todayKey: string,
  now: number,
  rule: OfferRecurrenceRule
): void {
  const expiresAt = instanceExpiresAt(
    series.templateExpiresAt,
    instanceDate,
    rule.expiryOffsetDays ?? 0
  );
  const status = instanceStatusForDate(instanceDate, todayKey);
  const racing = isRacingSport(series.sport);

  db.insert(offers)
    .values({
      bookmaker: series.bookmaker,
      title: series.title,
      description: series.description,
      expectedProfit: series.expectedProfit,
      status,
      expiresAt,
      sport: series.sport,
      offerType: series.offerType,
      scopeCourse: series.scopeCourse,
      scopeRaceId: series.scopeRaceId,
      scopeRaceLabel: series.scopeRaceLabel,
      rules: series.rules,
      seriesId: series.id,
      instanceDate,
      eventDate: racing ? instanceDate : null,
      createdAt: now,
      completedAt: null,
    })
    .run();
}

/** Stop recurrence from `fromDateKey` forward; remove empty future planned instances. */
export function stopOfferRecurrence(seriesId: number, fromDateKey: string): void {
  const now = Date.now();
  db.update(offerSeries)
    .set({
      recurrenceEnabled: 0,
      recurrenceStoppedFrom: fromDateKey,
      updatedAt: now,
    })
    .where(eq(offerSeries.id, seriesId))
    .run();

  const allBets = db.select().from(bets).all();
  const instances = db.select().from(offers).where(eq(offers.seriesId, seriesId)).all();
  for (const inst of instances) {
    if (!inst.instanceDate || inst.instanceDate < fromDateKey) continue;
    if (inst.status !== "planned") continue;
    if (allBets.some((b) => b.offerId === inst.id)) continue;
    db.delete(offers).where(eq(offers.id, inst.id)).run();
  }
}

/** Roll recurring instance status by calendar day (expire past planned, activate today). */
export function rollOfferSeriesInstanceStatuses(now = Date.now()): number {
  const todayKey = localYmd(new Date(now));
  let updated = 0;

  const allBets = db.select().from(bets).all();
  const instances = db
    .select()
    .from(offers)
    .all()
    .filter((o) => o.seriesId != null && o.instanceDate);

  for (const inst of instances) {
    const dateKey = inst.instanceDate!;

    if (dateKey < todayKey) {
      if (inst.status === "planned" && !allBets.some((b) => b.offerId === inst.id)) {
        db.update(offers).set({ status: "expired" }).where(eq(offers.id, inst.id)).run();
        updated += 1;
      }
      continue;
    }

    if (dateKey === todayKey && inst.status === "planned") {
      db.update(offers).set({ status: "active" }).where(eq(offers.id, inst.id)).run();
      updated += 1;
    }
  }

  return updated;
}

/** Materialise recurring instances within the series horizon. */
export function syncOfferSeriesInstances(now = Date.now()): number {
  rollOfferSeriesInstanceStatuses(now);
  const todayKey = localYmd(new Date(now));
  let created = 0;

  const seriesList = db.select().from(offerSeries).all().filter((s) => s.recurrenceEnabled === 1);

  for (const series of seriesList) {
    const rule = parseRecurrenceRule(series.ruleJson);
    if (!rule) continue;

    const horizon = series.horizonDays ?? 14;
    const toKey = addDaysYmd(todayKey, horizon);
    const stoppedFrom = series.recurrenceStoppedFrom;

    const dates = expandRecurrenceDates(rule, todayKey, toKey).filter(
      (d) => !stoppedFrom || d < stoppedFrom
    );

    const skipped = new Set(parseSkippedDates(series.skippedDatesJson));
    const existing = db.select().from(offers).where(eq(offers.seriesId, series.id)).all();
    const existingDates = new Set(existing.map((o) => o.instanceDate).filter(Boolean) as string[]);

    for (const dateKey of dates) {
      if (existingDates.has(dateKey) || skipped.has(dateKey)) continue;
      insertInstance(series, dateKey, todayKey, now, rule);
      created += 1;
    }
  }

  return created;
}

export function createOfferSeriesWithInstance(
  template: OfferInstanceTemplate,
  rule: OfferRecurrenceRule,
  options?: { instanceDate?: string; startsOn?: string; now?: number }
): { seriesId: number; offerId: number } {
  const now = options?.now ?? Date.now();
  const todayKeyForAnchor = localYmd(new Date(now));
  // Anchor the search for the first occurrence at "starts on" when it's a future
  // date, otherwise today - so e.g. "every Wednesday" created on a Tuesday doesn't
  // materialise a same-day instance that isn't actually due yet.
  const anchor =
    options?.startsOn && options.startsOn > todayKeyForAnchor
      ? options.startsOn
      : todayKeyForAnchor;
  const instanceDate =
    options?.instanceDate ??
    expandRecurrenceDates(rule, anchor, addDaysYmd(anchor, 400))[0] ??
    anchor;

  const series = db
    .insert(offerSeries)
    .values({
      recurrenceEnabled: 1,
      recurrenceStoppedFrom: null,
      ruleJson: JSON.stringify(rule),
      templateExpiresAt: template.expiresAt ?? null,
      horizonDays: 14,
      bookmaker: template.bookmaker,
      title: template.title,
      description: template.description,
      expectedProfit: template.expectedProfit,
      sport: template.sport,
      offerType: template.offerType,
      scopeCourse: template.scopeCourse,
      scopeRaceId: template.scopeRaceId,
      scopeRaceLabel: template.scopeRaceLabel,
      rules: template.rules,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  const todayKey = localYmd(new Date(now));
  const racing = isRacingSport(template.sport);
  const offer = db
    .insert(offers)
    .values({
      bookmaker: template.bookmaker,
      title: template.title,
      description: template.description,
      expectedProfit: template.expectedProfit,
      status: instanceStatusForDate(instanceDate, todayKey),
      expiresAt: instanceExpiresAt(
        template.expiresAt ?? null,
        instanceDate,
        rule.expiryOffsetDays ?? 0
      ),
      sport: template.sport,
      offerType: template.offerType,
      scopeCourse: template.scopeCourse,
      scopeRaceId: template.scopeRaceId,
      scopeRaceLabel: template.scopeRaceLabel,
      rules: template.rules,
      seriesId: series.id,
      instanceDate,
      eventDate: racing ? instanceDate : null,
      createdAt: now,
      completedAt: null,
    })
    .returning()
    .get();

  syncOfferSeriesInstances(now);
  return { seriesId: series.id, offerId: offer.id };
}

export function getOfferRecurrenceMeta(
  offer: Pick<OfferRow, "seriesId" | "instanceDate">,
  series?: OfferSeriesRow | null
): OfferRecurrenceMeta | null {
  if (offer.seriesId == null) return null;
  const row =
    series ?? db.select().from(offerSeries).where(eq(offerSeries.id, offer.seriesId)).get();
  if (!row) return null;
  const rule = parseRecurrenceRule(row.ruleJson);
  if (!rule) return null;
  return {
    seriesId: row.id,
    enabled: row.recurrenceEnabled === 1,
    rule,
    instanceDate: offer.instanceDate ?? null,
    stoppedFrom: row.recurrenceStoppedFrom ?? null,
  };
}

export function stopRecurrenceForOffer(offer: Pick<OfferRow, "id" | "seriesId" | "instanceDate">): void {
  if (offer.seriesId == null) return;
  const fromKey = offer.instanceDate ?? localYmd(new Date());
  stopOfferRecurrence(offer.seriesId, fromKey);
}

function skipOfferSeriesDate(seriesId: number, dateKey: string): void {
  const series = db.select().from(offerSeries).where(eq(offerSeries.id, seriesId)).get();
  if (!series) return;
  const skipped = parseSkippedDates(series.skippedDatesJson);
  if (skipped.includes(dateKey)) return;
  skipped.push(dateKey);
  db.update(offerSeries)
    .set({
      skippedDatesJson: encodeSkippedDates(skipped),
      updatedAt: Date.now(),
    })
    .where(eq(offerSeries.id, seriesId))
    .run();
}

/**
 * Delete an offer. For recurring instances:
 * - `instance`: remove this occurrence only and skip that date so sync does not recreate it
 * - `future`: remove this occurrence and stop the series from its date forward
 */
export function deleteOfferWithScope(
  offer: Pick<OfferRow, "id" | "seriesId" | "instanceDate">,
  scope: OfferDeleteScope = "instance"
): void {
  db.update(bets).set({ offerId: null }).where(eq(bets.offerId, offer.id)).run();
  // No FK cascade in SQLite bootstrap — clear dependent rows explicitly.
  db.delete(offerEvSnapshots).where(eq(offerEvSnapshots.offerId, offer.id)).run();
  db.delete(offerEffortSamples).where(eq(offerEffortSamples.offerId, offer.id)).run();
  db.delete(offers).where(eq(offers.id, offer.id)).run();

  if (offer.seriesId == null) return;

  const fromKey = offer.instanceDate ?? localYmd(new Date());
  if (scope === "future") {
    stopOfferRecurrence(offer.seriesId, fromKey);
    return;
  }

  if (offer.instanceDate) {
    skipOfferSeriesDate(offer.seriesId, offer.instanceDate);
  }
}
