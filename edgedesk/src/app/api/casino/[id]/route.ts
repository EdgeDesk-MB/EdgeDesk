import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, casinoOffers } from "@/lib/db";
import { casinoOfferEv, houseEdgeFromRtp, DEFAULT_RTP } from "@/lib/calc/casino-ev";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  casino: z.string().max(120).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  bonusAmount: z.number().positive().optional(),
  wageringMultiplier: z.number().min(0).max(200).optional(),
  rtp: z.number().min(0.5).max(1).nullable().optional(),
  contributionPct: z.number().min(0.01).max(1).nullable().optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  actualProfit: z.number().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
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

  // Re-derive the EV lock only while the offer is still open to edits.
  const inputsChanged =
    p.bonusAmount !== undefined ||
    p.wageringMultiplier !== undefined ||
    p.rtp !== undefined ||
    p.contributionPct !== undefined;
  let expectedEv = existing.expectedEv;
  if (inputsChanged && existing.status !== "completed") {
    expectedEv = casinoOfferEv({
      bonusAmount: p.bonusAmount ?? existing.bonusAmount,
      wageringMultiplier: p.wageringMultiplier ?? existing.wageringMultiplier,
      houseEdge: houseEdgeFromRtp((p.rtp === undefined ? existing.rtp : p.rtp) ?? DEFAULT_RTP),
      contributionPct:
        (p.contributionPct === undefined ? existing.contributionPct : p.contributionPct) ??
        undefined,
    }).ev;
  }

  const updated = db
    .update(casinoOffers)
    .set({
      ...(p.casino !== undefined ? { casino: p.casino?.trim() || null } : {}),
      ...(p.title !== undefined ? { title: p.title.trim() } : {}),
      ...(p.bonusAmount !== undefined ? { bonusAmount: p.bonusAmount } : {}),
      ...(p.wageringMultiplier !== undefined ? { wageringMultiplier: p.wageringMultiplier } : {}),
      ...(p.rtp !== undefined ? { rtp: p.rtp } : {}),
      ...(p.contributionPct !== undefined ? { contributionPct: p.contributionPct } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.actualProfit !== undefined ? { actualProfit: p.actualProfit } : {}),
      ...(p.notes !== undefined ? { notes: p.notes } : {}),
      ...(p.status === "completed" ? { completedAt: Date.now() } : {}),
      expectedEv,
    })
    .where(eq(casinoOffers.id, offerId))
    .returning()
    .get();
  return NextResponse.json({ offer: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  const existing = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.delete(casinoOffers).where(eq(casinoOffers.id, offerId)).run();
  return NextResponse.json({ ok: true });
}
