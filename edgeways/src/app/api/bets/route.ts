import { NextRequest, NextResponse } from "next/server";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, accounts, bets, events, history, mugPlans } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  deleteNeonDeskBets,
  insertNeonDeskBet,
  listNeonDeskBets,
} from "@/lib/db/neon-desk";
import { getNeonDeskOffer } from "@/lib/db/neon-desk-offers";
import { insertNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { linkNeonBoostDiaryBet } from "@/lib/db/neon-desk-boosts";
import { ledgerNeonBetPlacement, logNeonLedgerFailure } from "@/lib/db/neon-desk-ledger";
import { stampNeonMugPlansForBookmaker } from "@/lib/db/neon-desk-mug-plans";
import { resolveTriggerFields } from "@/lib/services/bet-triggers";
import { ledgerBetPlacement } from "@/lib/services/balances";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";
import { resolveOfferForBet, resolveOfferForFreeBetUsage } from "@/lib/services/offers";
import { linkBoostDiaryBet } from "@/lib/services/boosts";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const legSchema = z.object({
  label: z.string(),
  market: z.string(),
  selection: z.string(),
  odds: z.number().positive(),
  stake: z.number().min(0),
  earlyPayout: z.boolean().optional(),
  bookmaker: z.string().optional(),
  freeBet: z.enum(["snr", "sr"]).optional(),
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
  /** J5: 'mug' = camouflage bet, excluded from edge analytics */
  purpose: z.enum(["edge", "mug"]).nullable().optional(),
  /** J2b: link a boost diary row after Place bet → Add bet confirm */
  boostDiaryId: z.number().int().positive().optional(),
});

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    return NextResponse.json({ bets: await listNeonDeskBets() });
  }
  return NextResponse.json({ bets: db.select().from(bets).all() });
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const hostedDesk = isNeonDesk();

  const { triggerText, triggerRule } = resolveTriggerFields({
    betType: input.betType,
    label: input.label,
    triggerText: input.triggerText,
    eventId: hostedDesk ? undefined : input.eventId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
  });

  // Camouflage bets never attach to offers - they must not touch EV capture.
  // Hosted desk: no auto-matching yet, but an explicit offerId is honoured
  // (validated against this login's Neon offers below).
  const isMug = input.purpose === "mug";
  const resolvedOfferId =
    isMug || hostedDesk
      ? undefined
      : resolveOfferForBet({
          offerId: input.offerId,
          label: input.label,
          triggerText,
          bookmaker: input.bookmaker,
          expectedProfit: input.expectedProfit,
        });
  const offerId =
    isMug || hostedDesk
      ? undefined
      : resolveOfferForFreeBetUsage({
          offerId: resolvedOfferId ?? input.offerId,
          betType: input.betType,
          bookmaker: input.bookmaker,
          backStake: input.backStake,
        }) ?? resolvedOfferId;

  if (hostedDesk && input.offerId != null && !isMug) {
    const linked = await getNeonDeskOffer(input.offerId);
    if (!linked) {
      return NextResponse.json({ error: "Offer not found" }, { status: 400 });
    }
  }
  const hostedOfferId =
    hostedDesk && !isMug ? (input.offerId ?? undefined) : undefined;

  const values = {
    eventId: input.eventId,
    offerId: hostedDesk ? hostedOfferId : offerId,
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
    purpose: input.purpose ?? null,
  };

  if (hostedDesk) {
    try {
      const inserted = await insertNeonDeskBet(values);
      // History write is best-effort: the bet is the source of truth, and the
      // feed row must never block a placement.
      await insertNeonDeskHistory({
        dedupe: `bet-placed:${inserted.id}`,
        kind: "bet_placed",
        betId: inserted.id,
        eventId: inserted.eventId,
        title:
          inserted.betType === "free_snr" || inserted.betType === "free_sr"
            ? "Free bet placed"
            : "Bet placed",
        detail: inserted.label,
        createdAt: inserted.createdAt,
      }).catch(() => {});
      await ledgerNeonBetPlacement(inserted).catch((error) => {
        logNeonLedgerFailure("placement", inserted.id, error);
      });
      if (input.boostDiaryId != null) {
        await linkNeonBoostDiaryBet(input.boostDiaryId, inserted.id).catch(() => {});
      }
      if (inserted.purpose === "mug" && inserted.bookmaker) {
        await stampNeonMugPlansForBookmaker(
          inserted.bookmaker,
          inserted.createdAt
        ).catch(() => {});
      }
      return NextResponse.json({ bet: inserted });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the bet.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const inserted = db.insert(bets).values(values).returning().get();

  ledgerBetPlacement(inserted);

  if (input.boostDiaryId != null) {
    linkBoostDiaryBet(input.boostDiaryId, inserted.id);
  }

  // Logging a mug bet stamps the bookie's cadence plan (J5). Duplicate
  // wallet names can exist, so stamp every matching account's plan.
  if (inserted.purpose === "mug" && inserted.bookmaker) {
    const target = inserted.bookmaker.trim().toLowerCase();
    const matchingIds = db
      .select()
      .from(accounts)
      .all()
      .filter((a) => a.name.trim().toLowerCase() === target)
      .map((a) => a.id);
    if (matchingIds.length > 0) {
      db.update(mugPlans)
        .set({ lastMugAt: inserted.createdAt })
        .where(inArray(mugPlans.accountId, matchingIds))
        .run();
    }
  }

  if (inserted.eventId) {
    await syncRacingResultsForEvents([inserted.eventId]);
  }

  const { spawnCourseOfferSiblingsIfNeeded, syncOfferStatuses } = await import(
    "@/lib/services/offers"
  );
  syncOfferStatuses();
  if (inserted.offerId != null) spawnCourseOfferSiblingsIfNeeded();

  return NextResponse.json({ bet: inserted });
});

/** Remove every bet and settlement rows in the history feed. */
export const DELETE = withDeskScope(async function DELETE() {
  if (isNeonDesk()) {
    const deleted = await deleteNeonDeskBets();
    if (deleted == null) {
      return NextResponse.json({ error: "Sign in to clear bets." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, deleted });
  }
  const all = db.select({ id: bets.id }).from(bets).all();
  db.delete(history).where(isNotNull(history.betId)).run();
  db.delete(bets).run();
  return NextResponse.json({ ok: true, deleted: all.length });
});
