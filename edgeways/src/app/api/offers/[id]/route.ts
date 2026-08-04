import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, bets, offers } from "@/lib/db";
import { deleteOfferWithScope, stopRecurrenceForOffer } from "@/lib/offers/offer-recurrence";
import { summariseOffer } from "@/lib/services/offers";
import { quietOfferAlerts } from "@/lib/services/quiet-alerts";
import { MISTAKE_TAGS, setMistakeTag, writeEvLock, type MistakeTag } from "@/lib/services/ev-snapshot";
import { getPromoAwardsByBetId } from "@/lib/services/balances";
import { deriveOfferPipelineStage } from "@/lib/offers/pipeline";

export const dynamic = "force-dynamic";

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
  stopRecurrence: z.boolean().optional(),
  /** B7: tag the latest settled EV snapshot (null clears) */
  mistakeTag: z.enum(MISTAKE_TAGS).nullable().optional(),
});

const deleteScopeSchema = z.enum(["instance", "future"]).default("instance");

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const offerId = Number(id);
  const existing = db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (p.stopRecurrence) {
    stopRecurrenceForOffer(existing);
  }

  if (p.mistakeTag !== undefined) {
    setMistakeTag(offerId, p.mistakeTag as MistakeTag | null);
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
      ...(p.rules !== undefined ? { rules: p.rules } : {}),
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

  // Campaign finished or missed: pull down any £unclaimed push still on devices.
  if (
    (p.status === "completed" || p.status === "expired") &&
    existing.status !== p.status
  ) {
    quietOfferAlerts(offerId);
  }

  return NextResponse.json({ offer: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  const existing = db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scopeParsed = deleteScopeSchema.safeParse(req.nextUrl.searchParams.get("scope") ?? "instance");
  if (!scopeParsed.success) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  deleteOfferWithScope(existing, scopeParsed.data);
  quietOfferAlerts(offerId);
  return NextResponse.json({ ok: true });
}
