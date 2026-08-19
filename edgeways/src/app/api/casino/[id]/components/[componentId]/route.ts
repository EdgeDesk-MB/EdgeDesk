import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, casinoOfferComponents } from "@/lib/db";
import { deriveComponentEv } from "@/lib/calc/casino-reward-ev";
import { syncCasinoSeriesTemplateFromOffer } from "@/lib/offers/casino-offer-recurrence";
import { getCasinoOfferSummary } from "@/lib/services/casino-offers";
import { componentFieldsSchema, toComponentRowValues } from "../schema";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/**
 * K1: full replace of a component's type-specific fields (not a partial
 * patch) - the edit dialog always resends the whole form, and re-deriving
 * EV from a partial merge risks stale fields from a since-changed
 * componentType. sortOrder is untouched.
 */
export const PATCH = withDeskScope(async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; componentId: string }> }
) {
  const { id, componentId } = await ctx.params;
  const offerId = Number(id);
  const compId = Number(componentId);
  const existing = db
    .select()
    .from(casinoOfferComponents)
    .where(
      and(eq(casinoOfferComponents.id, compId), eq(casinoOfferComponents.casinoOfferId, offerId))
    )
    .get();
  if (!existing) return NextResponse.json({ error: "Component not found" }, { status: 404 });

  const parsed = componentFieldsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = toComponentRowValues(parsed.data);
  const expectedEv = deriveComponentEv(parsed.data);

  db.update(casinoOfferComponents)
    .set({ ...fields, expectedEv })
    .where(eq(casinoOfferComponents.id, compId))
    .run();

  syncCasinoSeriesTemplateFromOffer(offerId);

  return NextResponse.json({ offer: getCasinoOfferSummary(offerId) });
});

export const DELETE = withDeskScope(async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; componentId: string }> }
) {
  const { id, componentId } = await ctx.params;
  const offerId = Number(id);
  const compId = Number(componentId);
  const existing = db
    .select()
    .from(casinoOfferComponents)
    .where(
      and(eq(casinoOfferComponents.id, compId), eq(casinoOfferComponents.casinoOfferId, offerId))
    )
    .get();
  if (!existing) return NextResponse.json({ error: "Component not found" }, { status: 404 });

  db.delete(casinoOfferComponents).where(eq(casinoOfferComponents.id, compId)).run();
  syncCasinoSeriesTemplateFromOffer(offerId);
  return NextResponse.json({ offer: getCasinoOfferSummary(offerId) });
});
