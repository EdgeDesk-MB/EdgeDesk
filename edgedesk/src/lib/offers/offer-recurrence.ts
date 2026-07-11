/**
 * Recurring offers: one series template, materialised instances (unique offer IDs).
 * Turning recurrence off on any instance stops future occurrences from that date.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db, bets, offers, offerSeries, type OfferRow } from "@/lib/db";

type OfferSeriesRow = typeof offerSeries.$inferSelect;

import type { OfferRecurrenceMeta, OfferRecurrenceRule } from "@/lib/services/offers.types";
import {
  addDaysYmd,
  expandRecurrenceDates,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
} from "@/lib/offers/offer-recurrence-shared";

export type { OfferRecurrenceFreq, OfferRecurrenceMeta, OfferRecurrenceRule } from "@/lib/services/offers.types";
export {
  DEFAULT_RECURRENCE_RULE,
  addDaysYmd,
  expandRecurrenceDates,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
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
  now: number
): void {
  const expiresAt = instanceExpiresAt(series.templateExpiresAt, instanceDate);
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

    const existing = db.select().from(offers).where(eq(offers.seriesId, series.id)).all();
    const existingDates = new Set(existing.map((o) => o.instanceDate).filter(Boolean) as string[]);

    for (const dateKey of dates) {
      if (existingDates.has(dateKey)) continue;
      insertInstance(series, dateKey, todayKey, now);
      created += 1;
    }
  }

  return created;
}

export function createOfferSeriesWithInstance(
  template: OfferInstanceTemplate,
  rule: OfferRecurrenceRule,
  options?: { instanceDate?: string; now?: number }
): { seriesId: number; offerId: number } {
  const now = options?.now ?? Date.now();
  const instanceDate = options?.instanceDate ?? localYmd(new Date(now));

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
      expiresAt: instanceExpiresAt(template.expiresAt ?? null, instanceDate),
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
