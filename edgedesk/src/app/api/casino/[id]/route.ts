import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, casinoOfferComponents, casinoOffers } from "@/lib/db";
import { getCasinoOfferSummary } from "@/lib/services/casino-offers";

export const dynamic = "force-dynamic";

/** K1: campaign-level fields only - reward fields live on the components endpoints. */
const patchSchema = z.object({
  casino: z.string().max(120).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  actualProfit: z.number().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  expiresAt: z.number().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const offerId = Number(id);
  const existing = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.update(casinoOffers)
    .set({
      ...(p.casino !== undefined ? { casino: p.casino?.trim() || null } : {}),
      ...(p.title !== undefined ? { title: p.title.trim() } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.actualProfit !== undefined ? { actualProfit: p.actualProfit } : {}),
      ...(p.notes !== undefined ? { notes: p.notes } : {}),
      ...(p.expiresAt !== undefined ? { expiresAt: p.expiresAt } : {}),
      ...(p.status === "completed" ? { completedAt: Date.now() } : {}),
    })
    .where(eq(casinoOffers.id, offerId))
    .run();
  return NextResponse.json({ offer: getCasinoOfferSummary(offerId) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  const existing = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // No FK cascade in the SQLite bootstrap - delete components before the campaign.
  db.delete(casinoOfferComponents).where(eq(casinoOfferComponents.casinoOfferId, offerId)).run();
  db.delete(casinoOffers).where(eq(casinoOffers.id, offerId)).run();
  return NextResponse.json({ ok: true });
}
