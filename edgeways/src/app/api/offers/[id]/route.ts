import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, bets, offers } from "@/lib/db";
import {
  deleteOfferWithScope,
  stopRecurrenceForOffer,
  syncOfferSeriesTemplateFromOffer,
} from "@/lib/offers/offer-recurrence";
import { summariseOffer } from "@/lib/services/offers";
import { quietOfferAlerts } from "@/lib/services/quiet-alerts";
import { cancelPendingRemindersForOffer } from "@/lib/services/user-reminders";
import { MISTAKE_TAGS, setMistakeTag, writeEvLock, type MistakeTag } from "@/lib/services/ev-snapshot";
import { getPromoAwardsByBetId } from "@/lib/services/balances";
import { deriveOfferPipelineStage } from "@/lib/offers/pipeline";
import { normalizeOfferUrl } from "@/lib/offers/offer-url";
import { retireUnusedSameDayOfferSiblings } from "@/lib/offers/course-offer-sync";
import {
  markPlaybookStepDone,
  readPlaybookFromRulesJson,
  syncPlaybookFromOfferProfit,
  withPlaybookOnRules,
} from "@/lib/offers/offer-playbook";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  deleteNeonDeskOffer,
  getNeonDeskOffer,
  patchNeonDeskOffer,
} from "@/lib/db/neon-desk-offers";

export const dynamic = "force-dynamic";

const offerUrlField = z
  .string()
  .nullable()
  .optional()
  .refine((v) => v == null || v.trim() === "" || normalizeOfferUrl(v) != null, {
    message: "Enter a valid http(s) link",
  });

const patchSchema = z.object({
  bookmaker: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  expectedProfit: z.number().optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  expiresAt: z.number().nullable().optional(),
  startsOn: z.string().nullable().optional(),
  sport: z.string().nullable().optional(),
  offerType: z.string().nullable().optional(),
  scopeCourse: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  scopeRaceId: z.string().nullable().optional(),
  scopeRaceLabel: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  offerUrl: offerUrlField,
  stopRecurrence: z.boolean().optional(),
  /** When true, push campaign fields onto the series template and untouched repeats */
  updateSeries: z.boolean().optional(),
  /** B7: tag the latest settled EV snapshot (null clears) */
  mistakeTag: z.enum(MISTAKE_TAGS).nullable().optional(),
  /** O1: mark a playbook step done (hybrid wizard) */
  playbookStepDone: z.string().min(1).optional(),
});

const deleteScopeSchema = z.enum(["instance", "future"]).default("instance");

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const offerId = Number(id);

  if (isNeonDesk()) {
    // Hosted desk: series recurrence, EV snapshots and playbooks are still
    // SQLite-only; edit the campaign row directly.
    if (p.stopRecurrence || p.updateSeries || p.mistakeTag !== undefined || p.playbookStepDone) {
      return NextResponse.json(
        { error: "That offer feature is not available on the hosted desk yet." },
        { status: 400 }
      );
    }
    const hostedExisting = await getNeonDeskOffer(offerId);
    if (!hostedExisting) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const hostedExpireStamp =
      p.status === "expired" && p.expiresAt === undefined
        ? { expiresAt: Date.now(), completedAt: null as number | null }
        : {};
    try {
      const updated = await patchNeonDeskOffer(offerId, {
        ...(p.bookmaker !== undefined ? { bookmaker: p.bookmaker || null } : {}),
        ...(p.title !== undefined ? { title: p.title } : {}),
        ...(p.description !== undefined ? { description: p.description || null } : {}),
        ...(p.expectedProfit !== undefined ? { expectedProfit: p.expectedProfit } : {}),
        ...(p.status !== undefined ? { status: p.status } : {}),
        ...(p.expiresAt !== undefined ? { expiresAt: p.expiresAt } : {}),
        ...(p.startsOn !== undefined ? { startsOn: p.startsOn } : {}),
        ...(p.sport !== undefined ? { sport: p.sport } : {}),
        ...(p.offerType !== undefined ? { offerType: p.offerType } : {}),
        ...(p.scopeCourse !== undefined ? { scopeCourse: p.scopeCourse } : {}),
        ...(p.eventDate !== undefined ? { eventDate: p.eventDate } : {}),
        ...(p.scopeRaceId !== undefined ? { scopeRaceId: p.scopeRaceId } : {}),
        ...(p.scopeRaceLabel !== undefined ? { scopeRaceLabel: p.scopeRaceLabel } : {}),
        ...(p.rules !== undefined ? { rules: p.rules } : {}),
        ...(p.offerUrl !== undefined ? { offerUrl: normalizeOfferUrl(p.offerUrl) } : {}),
        ...(p.status === "completed" ? { completedAt: Date.now() } : {}),
        ...hostedExpireStamp,
      });
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ offer: updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the offer.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const existing = db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (p.stopRecurrence) {
    stopRecurrenceForOffer(existing);
  }

  if (p.mistakeTag !== undefined) {
    setMistakeTag(offerId, p.mistakeTag as MistakeTag | null);
  }

  let rulesFromPlaybook: string | undefined;
  if (p.playbookStepDone) {
    try {
      const parsedRules = existing.rules
        ? (JSON.parse(existing.rules) as Record<string, unknown>)
        : { type: "promo_terms" };
      const pb = readPlaybookFromRulesJson(existing.rules);
      if (!pb) {
        return NextResponse.json(
          { error: "Offer has no completion playbook" },
          { status: 400 }
        );
      }
      const linked = db.select().from(bets).where(eq(bets.offerId, offerId)).all();
      const summary = summariseOffer(existing, linked, getPromoAwardsByBetId());
      const synced = syncPlaybookFromOfferProfit(pb, summary.profit);
      const marked = markPlaybookStepDone(synced, p.playbookStepDone);
      rulesFromPlaybook = JSON.stringify(withPlaybookOnRules(parsedRules, marked));
    } catch {
      return NextResponse.json({ error: "Could not update playbook" }, { status: 400 });
    }
  }

  // Manual expire: stamp a past deadline so syncOfferStatuses does not revive
  // the campaign when an explicit expiresAt / race scope is still in the future.
  const expireStamp =
    p.status === "expired" && p.expiresAt === undefined
      ? { expiresAt: Date.now(), completedAt: null as number | null }
      : {};

  const updated = db
    .update(offers)
    .set({
      ...(p.bookmaker !== undefined ? { bookmaker: p.bookmaker || null } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.description !== undefined ? { description: p.description || null } : {}),
      ...(p.expectedProfit !== undefined ? { expectedProfit: p.expectedProfit } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.expiresAt !== undefined ? { expiresAt: p.expiresAt } : {}),
      ...(p.startsOn !== undefined ? { startsOn: p.startsOn } : {}),
      ...(p.sport !== undefined ? { sport: p.sport } : {}),
      ...(p.offerType !== undefined ? { offerType: p.offerType } : {}),
      ...(p.scopeCourse !== undefined ? { scopeCourse: p.scopeCourse } : {}),
      ...(p.eventDate !== undefined ? { eventDate: p.eventDate } : {}),
      ...(p.scopeRaceId !== undefined ? { scopeRaceId: p.scopeRaceId } : {}),
      ...(p.scopeRaceLabel !== undefined ? { scopeRaceLabel: p.scopeRaceLabel } : {}),
      ...(p.rules !== undefined
        ? { rules: p.rules }
        : rulesFromPlaybook !== undefined
          ? { rules: rulesFromPlaybook }
          : {}),
      ...(p.offerUrl !== undefined ? { offerUrl: normalizeOfferUrl(p.offerUrl) } : {}),
      ...(p.status === "completed" ? { completedAt: Date.now() } : {}),
      ...expireStamp,
    })
    .where(eq(offers.id, offerId))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-lock EV snapshot when expectedProfit is edited on an active, non-settled offer;
  // planned→active transitions write v1 if the offer was never locked.
  const activated = p.status === "active" && existing.status === "planned";
  if (p.expectedProfit !== undefined || activated) {
    const linked = db.select().from(bets).where(eq(bets.offerId, offerId)).all();
    const summary = summariseOffer(updated, linked, getPromoAwardsByBetId());
    const stage = deriveOfferPipelineStage(summary);
    if (stage !== "settled" && stage !== "expired") {
      if (p.expectedProfit !== undefined) {
        writeEvLock(summary, { expectedProfit: p.expectedProfit });
      } else {
        writeEvLock(summary, { onlyIfUnlocked: true });
      }
    }
  }

  // Recurring campaigns: optionally restamp the series template + untouched siblings
  // after this instance has been written (so the edited row is the source of truth).
  if (p.updateSeries && !p.stopRecurrence) {
    syncOfferSeriesTemplateFromOffer(offerId);
  }

  // Campaign finished or missed: pull down any £unclaimed push still on devices,
  // and drop pending user reminders that no longer make sense.
  if (
    (p.status === "completed" || p.status === "expired") &&
    existing.status !== p.status
  ) {
    quietOfferAlerts(offerId);
    cancelPendingRemindersForOffer(offerId);
    // Unused same-day twins would otherwise keep Race picks recommending.
    retireUnusedSameDayOfferSiblings(offerId);
  }

  return NextResponse.json({ offer: updated });
});

export const DELETE = withDeskScope(async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);

  if (isNeonDesk()) {
    // No recurring series on the hosted desk yet - scope is always "instance".
    const deleted = await deleteNeonDeskOffer(offerId);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const existing = db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scopeParsed = deleteScopeSchema.safeParse(req.nextUrl.searchParams.get("scope") ?? "instance");
  if (!scopeParsed.success) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  deleteOfferWithScope(existing, scopeParsed.data);
  quietOfferAlerts(offerId);
  cancelPendingRemindersForOffer(offerId);
  return NextResponse.json({ ok: true });
});
