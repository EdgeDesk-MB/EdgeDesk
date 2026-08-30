/**
 * Hosted sports offer recurrence. Every series row is clerk-scoped.
 * Pure date maths lives in offer-recurrence-shared; this file only writes Neon.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import {
  insertNeonDeskOffer,
  listNeonDeskOffers,
  patchNeonDeskOffer,
  deleteNeonDeskOffer,
} from "@/lib/db/neon-desk-offers";
import { toSqliteOfferSeriesRow } from "@/lib/db/neon-desk-map";
import { offerSeries as pgOfferSeries } from "@/lib/db/schema.pg";
import type { OfferRow, OfferSeriesRow } from "@/lib/db/schema";
import type { OfferRecurrenceMeta, OfferRecurrenceRule } from "@/lib/services/offers.types";
import {
  addDaysYmd,
  encodeSkippedDates,
  expandRecurrenceDates,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
  parseSkippedDates,
} from "@/lib/offers/offer-recurrence-shared";
type NeonOfferInstanceTemplate = Pick<
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

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function instanceStatusForDate(
  instanceDate: string,
  todayKey: string
): OfferRow["status"] {
  if (instanceDate < todayKey) return "expired";
  if (instanceDate === todayKey) return "active";
  return "planned";
}

function isRacingSport(sport: string | null | undefined): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}

export async function listNeonOfferSeries(): Promise<OfferSeriesRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgOfferSeries)
    .where(eq(pgOfferSeries.clerkUserId, clerkUserId));
  return rows.map(toSqliteOfferSeriesRow);
}

export function neonOfferRecurrenceMeta(
  offer: Pick<OfferRow, "seriesId" | "instanceDate">,
  series: OfferSeriesRow | null | undefined
): OfferRecurrenceMeta | null {
  if (offer.seriesId == null || !series) return null;
  const rule = parseRecurrenceRule(series.ruleJson);
  if (!rule) return null;
  return {
    seriesId: series.id,
    enabled: series.recurrenceEnabled === 1,
    rule,
    instanceDate: offer.instanceDate ?? null,
    stoppedFrom: series.recurrenceStoppedFrom ?? null,
  };
}

async function insertInstance(
  series: OfferSeriesRow,
  instanceDate: string,
  todayKey: string,
  now: number,
  rule: OfferRecurrenceRule
): Promise<void> {
  const racing = isRacingSport(series.sport);
  await insertNeonDeskOffer({
    bookmaker: series.bookmaker,
    title: series.title,
    description: series.description,
    expectedProfit: series.expectedProfit,
    status: instanceStatusForDate(instanceDate, todayKey),
    expiresAt: instanceExpiresAt(
      series.templateExpiresAt,
      instanceDate,
      rule.expiryOffsetDays ?? 0
    ),
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
  });
}

export async function syncNeonOfferSeriesInstances(now = Date.now()): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const todayKey = localYmd(new Date(now));
  const [seriesList, offers, bets] = await Promise.all([
    listNeonOfferSeries(),
    listNeonDeskOffers(),
    listNeonDeskBets(),
  ]);
  let created = 0;

  for (const inst of offers) {
    if (inst.seriesId == null || !inst.instanceDate) continue;
    if (inst.instanceDate < todayKey) {
      if (inst.status === "planned" && !bets.some((b) => b.offerId === inst.id)) {
        await patchNeonDeskOffer(inst.id, { status: "expired" });
      }
      continue;
    }
    if (inst.instanceDate === todayKey && inst.status === "planned") {
      await patchNeonDeskOffer(inst.id, { status: "active" });
    }
  }

  for (const series of seriesList) {
    if (series.recurrenceEnabled !== 1) continue;
    const rule = parseRecurrenceRule(series.ruleJson);
    if (!rule) continue;
    const horizon = series.horizonDays ?? 14;
    const toKey = addDaysYmd(todayKey, horizon);
    const dates = expandRecurrenceDates(rule, todayKey, toKey).filter(
      (d) => !series.recurrenceStoppedFrom || d < series.recurrenceStoppedFrom
    );
    const skipped = new Set(parseSkippedDates(series.skippedDatesJson));
    const existingDates = new Set(
      offers
        .filter((o) => o.seriesId === series.id)
        .map((o) => o.instanceDate)
        .filter((d): d is string => Boolean(d))
    );
    for (const dateKey of dates) {
      if (existingDates.has(dateKey) || skipped.has(dateKey)) continue;
      await insertInstance(series, dateKey, todayKey, now, rule);
      existingDates.add(dateKey);
      created += 1;
    }
  }
  return created;
}

export async function createNeonOfferSeriesWithInstance(
  template: NeonOfferInstanceTemplate,
  rule: OfferRecurrenceRule,
  options?: { instanceDate?: string; startsOn?: string; now?: number }
): Promise<{ seriesId: number; offerId: number }> {
  const clerkUserId = requireClerk("save a recurring offer");
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

  const rows = await getNeonDb()
    .insert(pgOfferSeries)
    .values({
      clerkUserId,
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
    .returning();
  const series = rows[0];
  if (!series) throw new Error("Neon did not return the saved series.");

  const todayKey = localYmd(new Date(now));
  const racing = isRacingSport(template.sport);
  const offer = await insertNeonDeskOffer({
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
  });
  await syncNeonOfferSeriesInstances(now);
  return { seriesId: series.id, offerId: offer.id };
}

export async function stopNeonRecurrenceForOffer(
  offer: Pick<OfferRow, "id" | "seriesId" | "instanceDate">
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId || offer.seriesId == null) return;
  const fromKey = offer.instanceDate ?? localYmd(new Date());
  await getNeonDb()
    .update(pgOfferSeries)
    .set({
      recurrenceEnabled: 0,
      recurrenceStoppedFrom: fromKey,
      updatedAt: Date.now(),
    })
    .where(
      and(eq(pgOfferSeries.id, offer.seriesId), eq(pgOfferSeries.clerkUserId, clerkUserId))
    );
  const [offers, bets] = await Promise.all([listNeonDeskOffers(), listNeonDeskBets()]);
  for (const inst of offers) {
    if (inst.seriesId !== offer.seriesId) continue;
    if (!inst.instanceDate || inst.instanceDate < fromKey) continue;
    if (inst.status !== "planned") continue;
    if (bets.some((b) => b.offerId === inst.id)) continue;
    await deleteNeonDeskOffer(inst.id);
  }
}

export async function skipNeonOfferSeriesDate(
  seriesId: number,
  dateKey: string
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const rows = await getNeonDb()
    .select()
    .from(pgOfferSeries)
    .where(and(eq(pgOfferSeries.id, seriesId), eq(pgOfferSeries.clerkUserId, clerkUserId)))
    .limit(1);
  const series = rows[0];
  if (!series) return;
  const skipped = parseSkippedDates(series.skippedDatesJson);
  if (skipped.includes(dateKey)) return;
  skipped.push(dateKey);
  await getNeonDb()
    .update(pgOfferSeries)
    .set({
      skippedDatesJson: encodeSkippedDates(skipped),
      updatedAt: Date.now(),
    })
    .where(and(eq(pgOfferSeries.id, seriesId), eq(pgOfferSeries.clerkUserId, clerkUserId)));
}

export async function deleteNeonOfferWithScope(
  offer: Pick<OfferRow, "id" | "seriesId" | "instanceDate">,
  scope: "instance" | "future"
): Promise<boolean> {
  const deleted = await deleteNeonDeskOffer(offer.id);
  if (!deleted) return false;
  if (offer.seriesId == null) return true;
  const fromKey = offer.instanceDate ?? localYmd(new Date());
  if (scope === "future") {
    await stopNeonRecurrenceForOffer(offer);
    return true;
  }
  if (offer.instanceDate) {
    await skipNeonOfferSeriesDate(offer.seriesId, fromKey);
  }
  return true;
}

export async function syncNeonOfferSeriesTemplateFromOffer(
  offerId: number,
  now = Date.now()
): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const offers = await listNeonDeskOffers();
  const offer = offers.find((o) => o.id === offerId);
  if (!offer?.seriesId) return false;
  const seriesList = await listNeonOfferSeries();
  const series = seriesList.find((s) => s.id === offer.seriesId);
  if (!series) return false;

  await getNeonDb()
    .update(pgOfferSeries)
    .set({
      bookmaker: offer.bookmaker,
      title: offer.title,
      description: offer.description,
      expectedProfit: offer.expectedProfit,
      sport: offer.sport,
      offerType: offer.offerType,
      scopeCourse: offer.scopeCourse,
      scopeRaceId: offer.scopeRaceId,
      scopeRaceLabel: offer.scopeRaceLabel,
      rules: offer.rules,
      offerUrl: offer.offerUrl,
      templateExpiresAt: offer.expiresAt,
      updatedAt: now,
    })
    .where(and(eq(pgOfferSeries.id, series.id), eq(pgOfferSeries.clerkUserId, clerkUserId)));
  await syncNeonOfferSeriesInstances(now);
  return true;
}
