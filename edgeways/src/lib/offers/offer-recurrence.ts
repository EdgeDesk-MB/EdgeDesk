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
  parseYmd,
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
  | "offerUrl"
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
      offerUrl: series.offerUrl,
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
      offerUrl: template.offerUrl,
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
      offerUrl: template.offerUrl,
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

function offerTemplateFields(
  row: Pick<
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
    | "offerUrl"
    | "expiresAt"
  >
): OfferInstanceTemplate {
  return {
    bookmaker: row.bookmaker,
    title: row.title,
    description: row.description,
    expectedProfit: row.expectedProfit,
    sport: row.sport,
    offerType: row.offerType,
    scopeCourse: row.scopeCourse,
    scopeRaceId: row.scopeRaceId,
    scopeRaceLabel: row.scopeRaceLabel,
    rules: row.rules,
    offerUrl: row.offerUrl,
    expiresAt: row.expiresAt,
  };
}

function seriesTemplateFields(series: OfferSeriesRow): OfferInstanceTemplate {
  return {
    bookmaker: series.bookmaker,
    title: series.title,
    description: series.description,
    expectedProfit: series.expectedProfit,
    sport: series.sport,
    offerType: series.offerType,
    scopeCourse: series.scopeCourse,
    scopeRaceId: series.scopeRaceId,
    scopeRaceLabel: series.scopeRaceLabel,
    rules: series.rules,
    offerUrl: series.offerUrl,
    expiresAt: series.templateExpiresAt,
  };
}

function offerCampaignFieldsEqual(
  a: Omit<OfferInstanceTemplate, "expiresAt">,
  b: Omit<OfferInstanceTemplate, "expiresAt">
): boolean {
  return (
    a.bookmaker === b.bookmaker &&
    a.title === b.title &&
    a.description === b.description &&
    a.expectedProfit === b.expectedProfit &&
    a.sport === b.sport &&
    a.offerType === b.offerType &&
    a.scopeCourse === b.scopeCourse &&
    a.scopeRaceId === b.scopeRaceId &&
    a.scopeRaceLabel === b.scopeRaceLabel &&
    a.rules === b.rules &&
    a.offerUrl === b.offerUrl
  );
}

function expiryClockEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getHours() === right.getHours() &&
    left.getMinutes() === right.getMinutes() &&
    left.getSeconds() === right.getSeconds()
  );
}

/**
 * Planned/active instance that still mirrors the previous series template
 * (no completion, no linked bets). Safe to restamp when the template changes.
 * Expiry is compared after shifting the template clock onto this instance's date.
 */
function isUntouchedOfferClone(
  inst: OfferRow,
  previousTemplate: OfferInstanceTemplate,
  offsetDays: number,
  offerIdsWithBets: Set<number>
): boolean {
  if (inst.status !== "planned" && inst.status !== "active") return false;
  if (inst.completedAt != null) return false;
  if (offerIdsWithBets.has(inst.id)) return false;
  if (!inst.instanceDate) return false;
  const fields = offerTemplateFields(inst);
  if (!offerCampaignFieldsEqual(fields, previousTemplate)) return false;
  const expectedExpiry = instanceExpiresAt(
    previousTemplate.expiresAt,
    inst.instanceDate,
    offsetDays
  );
  return fields.expiresAt === expectedExpiry;
}

function deriveExpiryOffsetDays(
  instanceDate: string | null | undefined,
  expiresAt: number | null | undefined
): number | undefined {
  if (!instanceDate || expiresAt == null) return undefined;
  const expiresYmd = localYmd(new Date(expiresAt));
  const diffDays = Math.round(
    (parseYmd(expiresYmd).getTime() - parseYmd(instanceDate).getTime()) / 86_400_000
  );
  return diffDays > 0 ? diffDays : undefined;
}

/**
 * After editing one occurrence, optionally push its campaign fields onto the
 * series template and restamp untouched sibling occurrences. Future materialisations
 * then pick up the same terms.
 *
 * Idempotent when the edited instance already matches the series template.
 */
export function syncOfferSeriesTemplateFromOffer(
  offerId: number,
  now = Date.now(),
  opts?: { skipMaterialise?: boolean }
): boolean {
  const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!offer?.seriesId) return false;

  const series = db.select().from(offerSeries).where(eq(offerSeries.id, offer.seriesId)).get();
  if (!series) return false;

  const nextTemplate = offerTemplateFields(offer);
  const previousTemplate = seriesTemplateFields(series);
  const rule = parseRecurrenceRule(series.ruleJson);
  const previousOffset = rule?.expiryOffsetDays ?? 0;
  const derivedOffset = deriveExpiryOffsetDays(offer.instanceDate, offer.expiresAt);
  const nextOffset = derivedOffset ?? previousOffset;

  // Campaign fields + expiry span/clock. Absolute expiresAt differs per instance date,
  // so compare offset + clock time rather than the raw timestamp.
  const expiryUnchanged =
    previousOffset === nextOffset && expiryClockEqual(previousTemplate.expiresAt, nextTemplate.expiresAt);
  if (offerCampaignFieldsEqual(previousTemplate, nextTemplate) && expiryUnchanged) {
    return false;
  }

  const nextRule =
    rule == null
      ? null
      : {
          ...rule,
          ...(derivedOffset != null
            ? { expiryOffsetDays: derivedOffset }
            : rule.expiryOffsetDays != null
              ? { expiryOffsetDays: rule.expiryOffsetDays }
              : {}),
        };

  const offerIdsWithBets = new Set(
    db
      .select()
      .from(bets)
      .all()
      .map((b) => b.offerId)
      .filter((id): id is number => id != null)
  );

  const siblings = db
    .select()
    .from(offers)
    .where(eq(offers.seriesId, offer.seriesId))
    .all()
    .filter((inst) => inst.id !== offerId);

  for (const inst of siblings) {
    if (!isUntouchedOfferClone(inst, previousTemplate, previousOffset, offerIdsWithBets)) {
      continue;
    }
    const racing = isRacingSport(nextTemplate.sport);
    db.update(offers)
      .set({
        bookmaker: nextTemplate.bookmaker,
        title: nextTemplate.title,
        description: nextTemplate.description,
        expectedProfit: nextTemplate.expectedProfit,
        sport: nextTemplate.sport,
        offerType: nextTemplate.offerType,
        scopeCourse: nextTemplate.scopeCourse,
        scopeRaceId: nextTemplate.scopeRaceId,
        scopeRaceLabel: nextTemplate.scopeRaceLabel,
        rules: nextTemplate.rules,
        offerUrl: nextTemplate.offerUrl,
        expiresAt: instanceExpiresAt(nextTemplate.expiresAt, inst.instanceDate!, nextOffset),
        ...(racing && inst.instanceDate ? { eventDate: inst.instanceDate } : {}),
      })
      .where(eq(offers.id, inst.id))
      .run();
  }

  db.update(offerSeries)
    .set({
      bookmaker: nextTemplate.bookmaker,
      title: nextTemplate.title,
      description: nextTemplate.description,
      expectedProfit: nextTemplate.expectedProfit,
      sport: nextTemplate.sport,
      offerType: nextTemplate.offerType,
      scopeCourse: nextTemplate.scopeCourse,
      scopeRaceId: nextTemplate.scopeRaceId,
      scopeRaceLabel: nextTemplate.scopeRaceLabel,
      rules: nextTemplate.rules,
      offerUrl: nextTemplate.offerUrl,
      templateExpiresAt: nextTemplate.expiresAt,
      ...(nextRule ? { ruleJson: JSON.stringify(nextRule) } : {}),
      updatedAt: now,
    })
    .where(eq(offerSeries.id, offer.seriesId))
    .run();

  if (!opts?.skipMaterialise) {
    syncOfferSeriesInstances(now);
  }
  return true;
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
