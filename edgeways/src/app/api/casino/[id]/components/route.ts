import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, casinoOfferComponents, casinoOffers } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { deriveComponentEv } from "@/lib/calc/casino-reward-ev";
import {
  countNeonDeskCasinoComponents,
  getNeonCasinoOfferSummary,
  getNeonDeskCasinoOffer,
  insertNeonDeskCasinoComponent,
} from "@/lib/db/neon-desk-casino";
import { sealNeonCasinoSeriesTemplateFromOffer } from "@/lib/db/neon-desk-casino-series";
import { syncCasinoSeriesTemplateFromOffer } from "@/lib/offers/casino-offer-recurrence";
import { getCasinoOfferSummary } from "@/lib/services/casino-offers";
import { componentFieldsSchema, toComponentRowValues } from "./schema";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** K1: adds one component to an existing campaign, appended after its current components. */
export const POST = withDeskScope(async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);

  if (isNeonDesk()) {
    const offer = await getNeonDeskCasinoOffer(offerId);
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    const parsed = componentFieldsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const fields = toComponentRowValues(parsed.data);
    const expectedEv = deriveComponentEv(parsed.data);
    const sortOrder = await countNeonDeskCasinoComponents(offerId);
    await insertNeonDeskCasinoComponent({
      casinoOfferId: offerId,
      ...fields,
      expectedEv,
      sortOrder,
    });
    await sealNeonCasinoSeriesTemplateFromOffer(offerId).catch(() => 0);
    return NextResponse.json({ offer: await getNeonCasinoOfferSummary(offerId) });
  }

  const offer = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

  const parsed = componentFieldsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = toComponentRowValues(parsed.data);
  const expectedEv = deriveComponentEv(parsed.data);

  const existingCount = db
    .select()
    .from(casinoOfferComponents)
    .where(eq(casinoOfferComponents.casinoOfferId, offerId))
    .all().length;

  db.insert(casinoOfferComponents)
    .values({
      casinoOfferId: offerId,
      ...fields,
      expectedEv,
      sortOrder: existingCount,
      createdAt: Date.now(),
    })
    .run();

  // K3: seal on first step, then re-sync the series template whenever steps
  // change so multi-step campaigns keep matching EVs across the horizon.
  syncCasinoSeriesTemplateFromOffer(offerId);

  return NextResponse.json({ offer: getCasinoOfferSummary(offerId) });
});
