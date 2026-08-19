import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, bets, offers } from "@/lib/db";
import { awardUnconditionalFreeBetEarly, getPromoAwardsByBetId } from "@/lib/services/balances";
import { syncOfferStatuses } from "@/lib/services/offers";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** Credit an unconditional free bet early (bookie released it on placement). */
export const POST = withDeskScope(async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const betId = Number(id);
  if (!Number.isFinite(betId) || betId <= 0) {
    return NextResponse.json({ error: "Invalid bet id" }, { status: 400 });
  }

  const bet = db.select().from(bets).where(eq(bets.id, betId)).get();
  if (!bet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const offerTitle =
    bet.offerId != null
      ? db.select({ title: offers.title }).from(offers).where(eq(offers.id, bet.offerId)).get()
          ?.title
      : null;

  const result = awardUnconditionalFreeBetEarly(bet, offerTitle);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  syncOfferStatuses();

  return NextResponse.json({
    awarded: true,
    amount: result.amount,
    promo: getPromoAwardsByBetId()[betId] ?? {
      amount: result.amount,
      reason: "Awarded on placement",
    },
  });
});
