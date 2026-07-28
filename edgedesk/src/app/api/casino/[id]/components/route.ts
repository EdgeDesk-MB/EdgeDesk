import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, casinoOfferComponents, casinoOffers } from "@/lib/db";
import { deriveComponentEv } from "@/lib/calc/casino-reward-ev";
import { getCasinoOfferSummary } from "@/lib/services/casino-offers";
import { componentFieldsSchema, toComponentRowValues } from "./schema";

export const dynamic = "force-dynamic";

/** K1: adds one component to an existing campaign, appended after its current components. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offerId = Number(id);
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

  return NextResponse.json({ offer: getCasinoOfferSummary(offerId) });
}
