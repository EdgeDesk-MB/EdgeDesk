/**
 * Recurring casino offers (K3): one series template + component template,
 * materialised as separate casino_offers rows (each with freshly derived EV).
 * Mirrors offer-recurrence.ts; reuses the shared rule grammar unchanged.
 */
import "server-only";

import { eq } from "drizzle-orm";
import {
  db,
  casinoOfferComponents,
  casinoOfferSeries,
  casinoOfferSeriesComponents,
  casinoOffers,
  type CasinoOfferRow,
  type CasinoOfferSeriesComponentRow,
  type CasinoOfferSeriesRow,
} from "@/lib/db";
import { deriveComponentEv } from "@/lib/calc/casino-reward-ev";
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

export type { OfferRecurrenceMeta, OfferRecurrenceRule } from "@/lib/services/offers.types";
export type { OfferDeleteScope };
export {
  DEFAULT_RECURRENCE_RULE,
  addDaysYmd,
  expandRecurrenceDates,
  formatRecurrenceLabel,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
} from "@/lib/offers/offer-recurrence-shared";

export type CasinoInstanceTemplate = Pick<CasinoOfferRow, "casino" | "title" | "notes" | "expiresAt">;

function instanceStatusForDate(
  instanceDate: string,
  todayKey: string
): CasinoOfferRow["status"] {
  if (instanceDate < todayKey) return "expired";
  if (instanceDate === todayKey) return "active";
  return "planned";
}

function componentTemplateFields(row: CasinoOfferSeriesComponentRow) {
  return {
    componentType: row.componentType,
    amount: row.amount,
    wageringMultiplier: row.wageringMultiplier,
    rtp: row.rtp,
    contributionPct: row.contributionPct,
    spins: row.spins,
    spinValue: row.spinValue,
    chipCount: row.chipCount,
    chipValue: row.chipValue,
    houseEdgePreset: row.houseEdgePreset,
    cashbackPct: row.cashbackPct,
    cashbackCap: row.cashbackCap,
    game: row.game,
    sortOrder: row.sortOrder,
  };
}

function insertCasinoInstance(
  series: CasinoOfferSeriesRow,
  componentsTemplate: CasinoOfferSeriesComponentRow[],
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

  const offer = db
    .insert(casinoOffers)
    .values({
      casino: series.casino,
      title: series.title,
      bonusAmount: 0,
      wageringMultiplier: 0,
      rtp: null,
      contributionPct: null,
      expectedEv: 0,
      game: null,
      status,
      notes: series.notes,
      expiresAt,
      seriesId: series.id,
      instanceDate,
      createdAt: now,
      completedAt: null,
    })
    .returning()
    .get();

  for (const tmpl of componentsTemplate) {
    const fields = componentTemplateFields(tmpl);
    const expectedEv = deriveComponentEv(fields);
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offer.id,
        ...fields,
        expectedEv,
        createdAt: now,
      })
      .run();
  }
}

/** True when the instance has user work beyond a fresh template materialisation. */
function instanceHasUserWork(
  inst: CasinoOfferRow,
  components: { casinoOfferId: number }[],
  templateCount: number
): boolean {
  if (inst.status !== "planned") return true;
  if (inst.actualProfit != null) return true;
  if (inst.completedAt != null) return true;
  const count = components.filter((c) => c.casinoOfferId === inst.id).length;
  // Diverged from template (extra/removed steps) counts as user work.
  if (templateCount > 0 && count !== templateCount) return true;
  return false;
}

/** Stop recurrence from `fromDateKey` forward; remove empty future planned instances. */
export function stopCasinoOfferRecurrence(seriesId: number, fromDateKey: string): void {
  const now = Date.now();
  db.update(casinoOfferSeries)
    .set({
      recurrenceEnabled: 0,
      recurrenceStoppedFrom: fromDateKey,
      updatedAt: now,
    })
    .where(eq(casinoOfferSeries.id, seriesId))
    .run();

  const templateCount = db
    .select()
    .from(casinoOfferSeriesComponents)
    .where(eq(casinoOfferSeriesComponents.seriesId, seriesId))
    .all().length;
  const allComponents = db.select().from(casinoOfferComponents).all();
  const instances = db
    .select()
    .from(casinoOffers)
    .where(eq(casinoOffers.seriesId, seriesId))
    .all();

  for (const inst of instances) {
    if (!inst.instanceDate || inst.instanceDate < fromDateKey) continue;
    if (instanceHasUserWork(inst, allComponents, templateCount)) continue;
    db.delete(casinoOfferComponents).where(eq(casinoOfferComponents.casinoOfferId, inst.id)).run();
    db.delete(casinoOffers).where(eq(casinoOffers.id, inst.id)).run();
  }
}

/** Roll recurring instance status by calendar day. */
export function rollCasinoOfferSeriesInstanceStatuses(now = Date.now()): number {
  const todayKey = localYmd(new Date(now));
  let updated = 0;

  const templateCounts = new Map<number, number>();
  for (const row of db.select().from(casinoOfferSeriesComponents).all()) {
    templateCounts.set(row.seriesId, (templateCounts.get(row.seriesId) ?? 0) + 1);
  }
  const allComponents = db.select().from(casinoOfferComponents).all();
  const instances = db
    .select()
    .from(casinoOffers)
    .all()
    .filter((o) => o.seriesId != null && o.instanceDate);

  for (const inst of instances) {
    const dateKey = inst.instanceDate!;
    const templateCount = templateCounts.get(inst.seriesId!) ?? 0;

    if (dateKey < todayKey) {
      if (
        inst.status === "planned" &&
        !instanceHasUserWork(inst, allComponents, templateCount)
      ) {
        db.update(casinoOffers).set({ status: "expired" }).where(eq(casinoOffers.id, inst.id)).run();
        updated += 1;
      }
      continue;
    }

    if (dateKey === todayKey && inst.status === "planned") {
      db.update(casinoOffers).set({ status: "active" }).where(eq(casinoOffers.id, inst.id)).run();
      updated += 1;
    }
  }

  return updated;
}

/**
 * Materialise recurring instances within each series horizon.
 * Skips series whose component template is still empty (awaiting seal).
 */
export function syncCasinoOfferSeriesInstances(now = Date.now()): number {
  rollCasinoOfferSeriesInstanceStatuses(now);
  const todayKey = localYmd(new Date(now));
  let created = 0;

  const seriesList = db
    .select()
    .from(casinoOfferSeries)
    .all()
    .filter((s) => s.recurrenceEnabled === 1);

  for (const series of seriesList) {
    const rule = parseRecurrenceRule(series.ruleJson);
    if (!rule) continue;

    const componentsTemplate = db
      .select()
      .from(casinoOfferSeriesComponents)
      .where(eq(casinoOfferSeriesComponents.seriesId, series.id))
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

    // Do not stamp empty future shells - wait until the seed instance seals the template.
    if (componentsTemplate.length === 0) continue;

    const horizon = series.horizonDays ?? 14;
    const toKey = addDaysYmd(todayKey, horizon);
    const stoppedFrom = series.recurrenceStoppedFrom;

    const dates = expandRecurrenceDates(rule, todayKey, toKey).filter(
      (d) => !stoppedFrom || d < stoppedFrom
    );

    const skipped = new Set(parseSkippedDates(series.skippedDatesJson));
    const existing = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, series.id))
      .all();
    const existingDates = new Set(
      existing.map((o) => o.instanceDate).filter(Boolean) as string[]
    );

    for (const dateKey of dates) {
      if (existingDates.has(dateKey) || skipped.has(dateKey)) continue;
      insertCasinoInstance(series, componentsTemplate, dateKey, todayKey, now, rule);
      created += 1;
    }
  }

  return created;
}

export function createCasinoOfferSeriesWithInstance(
  template: CasinoInstanceTemplate,
  rule: OfferRecurrenceRule,
  options?: { instanceDate?: string; startsOn?: string; now?: number }
): { seriesId: number; offerId: number } {
  const now = options?.now ?? Date.now();
  const todayKeyForAnchor = localYmd(new Date(now));
  const anchor =
    options?.startsOn && options.startsOn > todayKeyForAnchor
      ? options.startsOn
      : todayKeyForAnchor;
  const instanceDate =
    options?.instanceDate ??
    expandRecurrenceDates(rule, anchor, addDaysYmd(anchor, 400))[0] ??
    anchor;

  const series = db
    .insert(casinoOfferSeries)
    .values({
      recurrenceEnabled: 1,
      recurrenceStoppedFrom: null,
      ruleJson: JSON.stringify(rule),
      templateExpiresAt: template.expiresAt ?? null,
      horizonDays: 14,
      casino: template.casino,
      title: template.title,
      notes: template.notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  const todayKey = localYmd(new Date(now));
  const offer = db
    .insert(casinoOffers)
    .values({
      casino: template.casino,
      title: template.title,
      bonusAmount: 0,
      wageringMultiplier: 0,
      rtp: null,
      contributionPct: null,
      expectedEv: 0,
      game: null,
      status: instanceStatusForDate(instanceDate, todayKey),
      notes: template.notes,
      expiresAt: instanceExpiresAt(
        template.expiresAt ?? null,
        instanceDate,
        rule.expiryOffsetDays ?? 0
      ),
      seriesId: series.id,
      instanceDate,
      createdAt: now,
      completedAt: null,
    })
    .returning()
    .get();

  // Horizon sync waits until the component template is sealed from this seed instance.
  return { seriesId: series.id, offerId: offer.id };
}

/**
 * Copy components from a seed instance onto the series template (once), then
 * materialise the horizon. Idempotent when the template already has rows.
 */
export function maybeSealCasinoSeriesTemplate(offerId: number, now = Date.now()): boolean {
  const offer = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
  if (!offer?.seriesId) return false;

  const existingTemplate = db
    .select()
    .from(casinoOfferSeriesComponents)
    .where(eq(casinoOfferSeriesComponents.seriesId, offer.seriesId))
    .all();
  if (existingTemplate.length > 0) return false;

  const components = db
    .select()
    .from(casinoOfferComponents)
    .where(eq(casinoOfferComponents.casinoOfferId, offerId))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (components.length === 0) return false;

  for (const c of components) {
    db.insert(casinoOfferSeriesComponents)
      .values({
        seriesId: offer.seriesId,
        componentType: c.componentType,
        amount: c.amount,
        wageringMultiplier: c.wageringMultiplier,
        rtp: c.rtp,
        contributionPct: c.contributionPct,
        spins: c.spins,
        spinValue: c.spinValue,
        chipCount: c.chipCount,
        chipValue: c.chipValue,
        houseEdgePreset: c.houseEdgePreset,
        cashbackPct: c.cashbackPct,
        cashbackCap: c.cashbackCap,
        game: c.game,
        sortOrder: c.sortOrder,
        createdAt: now,
      })
      .run();
  }

  syncCasinoOfferSeriesInstances(now);
  return true;
}

export function getCasinoOfferRecurrenceMeta(
  offer: Pick<CasinoOfferRow, "seriesId" | "instanceDate">,
  series?: CasinoOfferSeriesRow | null
): OfferRecurrenceMeta | null {
  if (offer.seriesId == null) return null;
  const row =
    series ??
    db.select().from(casinoOfferSeries).where(eq(casinoOfferSeries.id, offer.seriesId)).get();
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

export function stopRecurrenceForCasinoOffer(
  offer: Pick<CasinoOfferRow, "id" | "seriesId" | "instanceDate">
): void {
  if (offer.seriesId == null) return;
  const fromKey = offer.instanceDate ?? localYmd(new Date());
  stopCasinoOfferRecurrence(offer.seriesId, fromKey);
}

function skipCasinoOfferSeriesDate(seriesId: number, dateKey: string): void {
  const series = db
    .select()
    .from(casinoOfferSeries)
    .where(eq(casinoOfferSeries.id, seriesId))
    .get();
  if (!series) return;
  const skipped = parseSkippedDates(series.skippedDatesJson);
  if (skipped.includes(dateKey)) return;
  skipped.push(dateKey);
  db.update(casinoOfferSeries)
    .set({
      skippedDatesJson: encodeSkippedDates(skipped),
      updatedAt: Date.now(),
    })
    .where(eq(casinoOfferSeries.id, seriesId))
    .run();
}

/**
 * Delete a casino campaign. For recurring instances:
 * - `instance`: remove this occurrence only and skip that date so sync does not recreate it
 * - `future`: remove this occurrence and stop the series from its date forward
 */
export function deleteCasinoOfferWithScope(
  offer: Pick<CasinoOfferRow, "id" | "seriesId" | "instanceDate">,
  scope: OfferDeleteScope = "instance"
): void {
  db.delete(casinoOfferComponents).where(eq(casinoOfferComponents.casinoOfferId, offer.id)).run();
  db.delete(casinoOffers).where(eq(casinoOffers.id, offer.id)).run();

  if (offer.seriesId == null) return;

  const fromKey = offer.instanceDate ?? localYmd(new Date());
  if (scope === "future") {
    stopCasinoOfferRecurrence(offer.seriesId, fromKey);
    return;
  }

  if (offer.instanceDate) {
    skipCasinoOfferSeriesDate(offer.seriesId, offer.instanceDate);
  }
}
