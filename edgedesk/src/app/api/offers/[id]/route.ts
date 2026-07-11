import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, bets, offers } from "@/lib/db";
import { stopRecurrenceForOffer } from "@/lib/offers/offer-recurrence";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  bookmaker: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  expectedProfit: z.number().optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  expiresAt: z.number().nullable().optional(),
  sport: z.string().nullable().optional(),
  offerType: z.string().nullable().optional(),
  scopeCourse: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  scopeRaceId: z.string().nullable().optional(),
  scopeRaceLabel: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  stopRecurrence: z.boolean().optional(),
});

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

  const updated = db
    .update(offers)
    .set({
      ...(p.bookmaker !== undefined ? { bookmaker: p.bookmaker || null } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.description !== undefined ? { description: p.description || null } : {}),
      ...(p.expectedProfit !== undefined ? { expectedProfit: p.expectedProfit } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.expiresAt !== undefined ? { expiresAt: p.expiresAt } : {}),
      ...(p.sport !== undefined ? { sport: p.sport } : {}),
      ...(p.offerType !== undefined ? { offerType: p.offerType } : {}),
      ...(p.scopeCourse !== undefined ? { scopeCourse: p.scopeCourse } : {}),
      ...(p.eventDate !== undefined ? { eventDate: p.eventDate } : {}),
      ...(p.scopeRaceId !== undefined ? { scopeRaceId: p.scopeRaceId } : {}),
      ...(p.scopeRaceLabel !== undefined ? { scopeRaceLabel: p.scopeRaceLabel } : {}),
      ...(p.rules !== undefined ? { rules: p.rules } : {}),
      ...(p.status === "completed" ? { completedAt: Date.now() } : {}),
    })
    .where(eq(offers.id, offerId))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ offer: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  const existing = db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.update(bets).set({ offerId: null }).where(eq(bets.offerId, offerId)).run();
  db.delete(offers).where(eq(offers.id, offerId)).run();
  return NextResponse.json({ ok: true });
}
