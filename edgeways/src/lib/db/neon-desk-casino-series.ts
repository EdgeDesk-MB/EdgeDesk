/**
 * Hosted casino recurrence. casino_offer_series already has clerk_user_id.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { deriveComponentEv } from "@/lib/calc/casino-reward-ev";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import {
  insertNeonDeskCasinoComponent,
  insertNeonDeskCasinoOffer,
  listNeonDeskCasinoRows,
} from "@/lib/db/neon-desk-casino";
import {
  casinoOfferSeries as pgCasinoOfferSeries,
  casinoOfferSeriesComponents as pgCasinoOfferSeriesComponents,
} from "@/lib/db/schema.pg";
import type { CasinoOfferRow } from "@/lib/db/schema";
import type { OfferRecurrenceRule } from "@/lib/services/offers.types";
import {
  addDaysYmd,
  expandRecurrenceDates,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
  parseSkippedDates,
} from "@/lib/offers/offer-recurrence-shared";

function instanceStatusForDate(
  instanceDate: string,
  todayKey: string
): CasinoOfferRow["status"] {
  if (instanceDate < todayKey) return "expired";
  if (instanceDate === todayKey) return "active";
  return "planned";
}

export async function createNeonCasinoOfferSeriesWithInstance(
  template: Pick<CasinoOfferRow, "casino" | "title" | "notes" | "offerUrl" | "expiresAt">,
  rule: OfferRecurrenceRule,
  options?: { startsOn?: string; now?: number }
): Promise<{ seriesId: number; offerId: number }> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error("Sign in to save a recurring casino offer.");
  const now = options?.now ?? Date.now();
  const todayKeyForAnchor = localYmd(new Date(now));
  const anchor =
    options?.startsOn && options.startsOn > todayKeyForAnchor
      ? options.startsOn
      : todayKeyForAnchor;
  const instanceDate =
    expandRecurrenceDates(rule, anchor, addDaysYmd(anchor, 400))[0] ?? anchor;

  const seriesRows = await getNeonDb()
    .insert(pgCasinoOfferSeries)
    .values({
      clerkUserId,
      recurrenceEnabled: 1,
      recurrenceStoppedFrom: null,
      ruleJson: JSON.stringify(rule),
      templateExpiresAt: template.expiresAt ?? null,
      horizonDays: 14,
      casino: template.casino,
      title: template.title,
      notes: template.notes,
      offerUrl: template.offerUrl,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const series = seriesRows[0];
  if (!series) throw new Error("Neon did not return the saved casino series.");

  const todayKey = localYmd(new Date(now));
  const offer = await insertNeonDeskCasinoOffer({
    casino: template.casino,
    title: template.title,
    notes: template.notes,
    offerUrl: template.offerUrl,
    expiresAt: instanceExpiresAt(
      template.expiresAt ?? null,
      instanceDate,
      rule.expiryOffsetDays ?? 0
    ),
    status: instanceStatusForDate(instanceDate, todayKey) === "expired" ? "planned" : instanceStatusForDate(instanceDate, todayKey) === "active" ? "active" : "planned",
    seriesId: series.id,
    instanceDate,
  });
  return { seriesId: series.id, offerId: offer.id };
}

export async function stopNeonCasinoRecurrenceForOffer(
  offer: Pick<CasinoOfferRow, "seriesId" | "instanceDate">
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId || offer.seriesId == null) return;
  const fromKey = offer.instanceDate ?? localYmd(new Date());
  await getNeonDb()
    .update(pgCasinoOfferSeries)
    .set({
      recurrenceEnabled: 0,
      recurrenceStoppedFrom: fromKey,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(pgCasinoOfferSeries.id, offer.seriesId),
        eq(pgCasinoOfferSeries.clerkUserId, clerkUserId)
      )
    );
}

export async function sealNeonCasinoSeriesTemplateFromOffer(
  offerId: number,
  now = Date.now()
): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const rows = await listNeonDeskCasinoRows();
  const offer = rows.offers.find((o) => o.id === offerId);
  if (!offer?.seriesId) return 0;
  const components = rows.components
    .filter((c) => c.casinoOfferId === offerId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (components.length === 0) return 0;

  await getNeonDb()
    .delete(pgCasinoOfferSeriesComponents)
    .where(
      and(
        eq(pgCasinoOfferSeriesComponents.seriesId, offer.seriesId),
        eq(pgCasinoOfferSeriesComponents.clerkUserId, clerkUserId)
      )
    );
  for (const c of components) {
    await getNeonDb().insert(pgCasinoOfferSeriesComponents).values({
      clerkUserId,
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
      eligibleGamesJson: c.eligibleGamesJson,
      sortOrder: c.sortOrder,
      createdAt: now,
    });
  }
  return syncNeonCasinoOfferSeriesInstances(now);
}

export async function syncNeonCasinoOfferSeriesInstances(now = Date.now()): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const todayKey = localYmd(new Date(now));
  const rows = await listNeonDeskCasinoRows();
  let created = 0;

  for (const series of rows.series) {
    if (series.recurrenceEnabled !== 1) continue;
    const rule = parseRecurrenceRule(series.ruleJson);
    if (!rule) continue;
    const template = rows.seriesComponents
      .filter((c) => c.seriesId === series.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    if (template.length === 0) continue;
    const horizon = series.horizonDays ?? 14;
    const dates = expandRecurrenceDates(rule, todayKey, addDaysYmd(todayKey, horizon)).filter(
      (d) => !series.recurrenceStoppedFrom || d < series.recurrenceStoppedFrom
    );
    const skipped = new Set(parseSkippedDates(series.skippedDatesJson));
    const existingDates = new Set(
      rows.offers
        .filter((o) => o.seriesId === series.id)
        .map((o) => o.instanceDate)
        .filter((d): d is string => Boolean(d))
    );
    for (const dateKey of dates) {
      if (existingDates.has(dateKey) || skipped.has(dateKey)) continue;
      const offer = await insertNeonDeskCasinoOffer({
        casino: series.casino,
        title: series.title,
        notes: series.notes,
        offerUrl: series.offerUrl,
        expiresAt: instanceExpiresAt(
          series.templateExpiresAt,
          dateKey,
          rule.expiryOffsetDays ?? 0
        ),
        status: instanceStatusForDate(dateKey, todayKey) === "active" ? "active" : "planned",
        seriesId: series.id,
        instanceDate: dateKey,
      });
      for (const tmpl of template) {
        await insertNeonDeskCasinoComponent({
          casinoOfferId: offer.id,
          componentType: tmpl.componentType,
          amount: tmpl.amount,
          wageringMultiplier: tmpl.wageringMultiplier,
          rtp: tmpl.rtp,
          contributionPct: tmpl.contributionPct,
          spins: tmpl.spins,
          spinValue: tmpl.spinValue,
          chipCount: tmpl.chipCount,
          chipValue: tmpl.chipValue,
          houseEdgePreset: tmpl.houseEdgePreset,
          cashbackPct: tmpl.cashbackPct,
          cashbackCap: tmpl.cashbackCap,
          game: tmpl.game,
          eligibleGamesJson: tmpl.eligibleGamesJson,
          expectedEv: deriveComponentEv(tmpl),
          sortOrder: tmpl.sortOrder,
        });
      }
      existingDates.add(dateKey);
      created += 1;
    }
  }
  return created;
}
