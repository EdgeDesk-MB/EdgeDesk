import { NextRequest, NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, bets, events, history } from "@/lib/db";
import { resolveTriggerFields } from "@/lib/services/bet-triggers";
import { ledgerBetPlacement, ledgerFromSettledBet } from "@/lib/services/balances";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";
import { resolveOfferForBet, resolveOfferForFreeBetUsage } from "@/lib/services/offers";

export const dynamic = "force-dynamic";

const legSchema = z.object({
  label: z.string(),
  market: z.string(),
  selection: z.string(),
  odds: z.number().positive(),
  stake: z.number().min(0),
  earlyPayout: z.boolean().optional(),
});

const createSchema = z.object({
  eventId: z.number().optional(),
  label: z.string().min(1),
  market: z.string().default("match_odds"),
  selection: z.string().default(""),
  betType: z.string().default("qualifying"),
  bookmaker: z.string().optional(),
  exchangeId: z.number().optional(),
  backStake: z.number().min(0).default(0),
  backOdds: z.number().min(0).default(0),
  layStake: z.number().min(0).default(0),
  layOdds: z.number().min(0).default(0),
  commission: z.number().min(0).max(0.2).default(0.02),
  earlyPayout: z.boolean().default(false),
  refundAmount: z.number().optional(),
  refundRetention: z.number().optional(),
  legs: z.array(legSchema).optional(),
  /** "The bet wins IF …" - parsed server-side into a structured rule */
  triggerText: z.string().optional(),
  expectedProfit: z.number().optional(),
  notes: z.string().optional(),
  /** Team names for trigger parsing when no event is linked yet */
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  offerId: z.number().optional(),
  /** Mobile quick-log capture - flags the bet for later desktop review */
  quickLogged: z.boolean().default(false),
});

export async function GET() {
  return NextResponse.json({ bets: db.select().from(bets).all() });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const { triggerText, triggerRule } = resolveTriggerFields({
    label: input.label,
    triggerText: input.triggerText,
    eventId: input.eventId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
  });

  const resolvedOfferId = resolveOfferForBet({
    offerId: input.offerId,
    label: input.label,
    triggerText,
    bookmaker: input.bookmaker,
    expectedProfit: input.expectedProfit,
  });
  const offerId =
    resolveOfferForFreeBetUsage({
      offerId: resolvedOfferId ?? input.offerId,
      betType: input.betType,
      bookmaker: input.bookmaker,
      backStake: input.backStake,
    }) ?? resolvedOfferId;

  const inserted = db
    .insert(bets)
    .values({
      eventId: input.eventId,
      offerId,
      label: input.label,
      market: input.market,
      selection: input.selection,
      betType: input.betType,
      bookmaker: input.bookmaker,
      exchangeId: input.exchangeId,
      backStake: input.backStake,
      backOdds: input.backOdds,
      layStake: input.layStake,
      layOdds: input.layOdds,
      commission: input.commission,
      earlyPayout: input.earlyPayout ? 1 : 0,
      refundAmount: input.refundAmount,
      refundRetention: input.refundRetention,
      legs: input.legs ? JSON.stringify(input.legs) : null,
      triggerText,
      triggerRule,
      expectedProfit: input.expectedProfit,
      notes: input.notes,
      createdAt: Date.now(),
      quickLogged: input.quickLogged ? Date.now() : null,
    })
    .returning()
    .get();

  ledgerBetPlacement(inserted);

  if (inserted.eventId) {
    await syncRacingResultsForEvents([inserted.eventId]);
  }

  const { syncOfferStatuses } = await import("@/lib/services/offers");
  syncOfferStatuses();

  return NextResponse.json({ bet: inserted });
}

/** Remove every bet and settlement rows in the history feed. */
export async function DELETE() {
  const all = db.select({ id: bets.id }).from(bets).all();
  db.delete(history).where(isNotNull(history.betId)).run();
  db.delete(bets).run();
  return NextResponse.json({ ok: true, deleted: all.length });
}
