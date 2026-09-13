import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, accounts, bets, events, mugPlans } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  deleteNeonDeskBet,
  getNeonDeskBet,
  patchNeonDeskBet,
  type NeonDeskBetPatch,
} from "@/lib/db/neon-desk";
import { purgeNeonDeskHistoryForBet } from "@/lib/db/neon-desk-history";
import {
  syncNeonBoostDiaryFromBet,
  unlinkNeonBoostDiaryForBet,
} from "@/lib/db/neon-desk-boosts";
import {
  ledgerNeonBetSettlement,
  logNeonLedgerFailure,
  purgeNeonDeskLedgerForBet,
  reledgerNeonOpenBetPlacement,
} from "@/lib/db/neon-desk-ledger";
import { stampNeonMugPlansForBookmaker } from "@/lib/db/neon-desk-mug-plans";
import { purgeNeonDeskSettlementTransactionsForBet } from "@/lib/db/neon-desk-accounts";
import { resolveTriggerFields } from "@/lib/services/bet-triggers";
import {
  ledgerFromSettledBet,
  purgeLedgerForDeletedBet,
  reledgerDutchFreeLegs,
  reledgerOpenBetPlacement,
} from "@/lib/services/balances";
import { purgeHistoryForBet } from "@/lib/services/history-feed";
import {
  resolveOfferForBet,
  spawnCourseOfferSiblingsIfNeeded,
  syncOfferStatuses,
} from "@/lib/services/offers";
import { syncBoostDiaryFromBet, unlinkBoostDiaryForBet } from "@/lib/services/boosts";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import type { BetRow } from "@/lib/db/schema";
import { getNeonEvent } from "@/lib/db/neon-events";
import { resyncNeonSettledBetAgainstEvent } from "@/lib/db/neon-desk-resync-settlement";
import { resyncSettledBetAgainstEvent, applyFreeBetEffectsForBet } from "@/lib/services/resync-settlement";

export const dynamic = "force-dynamic";

const dutchLegSchema = z.object({
  label: z.string(),
  market: z.string(),
  selection: z.string(),
  odds: z.number().positive(),
  stake: z.number().min(0),
  earlyPayout: z.boolean().optional(),
  bookmaker: z.string().optional(),
  freeBet: z.enum(["snr", "sr"]).optional(),
});

const patchSchema = z.object({
  purpose: z.enum(["edge", "mug"]).nullable().optional(),
  /** Dutch bets: replace the leg set (Add bet's legs editor, edit mode) */
  legs: z.array(dutchLegSchema).nullable().optional(),
  status: z
    .enum(["open", "won", "lost", "void", "early_payout", "half_win", "half_lose", "push"])
    .optional(),
  actualProfit: z.number().optional(),
  label: z.string().min(1).optional(),
  betType: z.string().optional(),
  bookmaker: z.string().optional(),
  exchangeId: z.number().nullable().optional(),
  backStake: z.number().min(0).optional(),
  backOdds: z.number().min(0).optional(),
  layStake: z.number().min(0).optional(),
  layOdds: z.number().min(0).optional(),
  commission: z.number().min(0).max(0.2).optional(),
  earlyPayout: z.boolean().optional(),
  expectedProfit: z.number().optional(),
  notes: z.string().optional(),
  eventId: z.number().nullable().optional(),
  market: z.string().optional(),
  selection: z.string().optional(),
  /** Set or clear (empty string) the "wins IF" trigger; re-parsed server-side */
  triggerText: z.string().optional(),
  /** Team names for trigger parsing / event tracking when no event is linked yet */
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  offerId: z.number().nullable().optional(),
  refundAmount: z.number().optional(),
  refundRetention: z.number().optional(),
});

type PatchBody = z.infer<typeof patchSchema>;

function betPatchValues(
  p: PatchBody,
  existing: Pick<BetRow, "source">,
  triggerFields?: { triggerText: string | null; triggerRule: string | null }
): NeonDeskBetPatch {
  return {
    ...(p.status ? { status: p.status } : {}),
    ...(p.actualProfit !== undefined ? { actualProfit: p.actualProfit } : {}),
    ...(p.label !== undefined ? { label: p.label } : {}),
    ...(p.betType !== undefined ? { betType: p.betType } : {}),
    ...(p.bookmaker !== undefined ? { bookmaker: p.bookmaker } : {}),
    ...(p.exchangeId !== undefined ? { exchangeId: p.exchangeId } : {}),
    ...(p.purpose !== undefined ? { purpose: p.purpose } : {}),
    ...(p.legs !== undefined ? { legs: p.legs ? JSON.stringify(p.legs) : null } : {}),
    ...(p.backStake !== undefined ? { backStake: p.backStake } : {}),
    ...(p.backOdds !== undefined ? { backOdds: p.backOdds } : {}),
    ...(p.layStake !== undefined ? { layStake: p.layStake } : {}),
    ...(p.layOdds !== undefined ? { layOdds: p.layOdds } : {}),
    ...(p.commission !== undefined ? { commission: p.commission } : {}),
    ...(p.earlyPayout !== undefined ? { earlyPayout: p.earlyPayout ? 1 : 0 } : {}),
    ...(p.expectedProfit !== undefined ? { expectedProfit: p.expectedProfit } : {}),
    ...(p.notes !== undefined ? { notes: p.notes } : {}),
    ...(p.eventId !== undefined ? { eventId: p.eventId } : {}),
    ...(p.market !== undefined ? { market: p.market } : {}),
    ...(p.selection !== undefined ? { selection: p.selection } : {}),
    ...(p.offerId !== undefined ? { offerId: p.offerId } : {}),
    ...(p.refundAmount !== undefined ? { refundAmount: p.refundAmount } : {}),
    ...(p.refundRetention !== undefined ? { refundRetention: p.refundRetention } : {}),
    ...(p.purpose === "mug" ? { offerId: null } : {}),
    ...(triggerFields ?? {}),
    ...(p.status && p.status !== "open" ? { settledAt: Date.now() } : {}),
    ...(p.status === "open"
      ? {
          settledAt: null,
          actualProfit: null,
          ...(existing.source === "import" ? {} : { balanceSettled: 0 }),
        }
      : {}),
  };
}

function neonWriteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not save the bet.";
  const status = message.startsWith("Sign in") ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const betId = Number(id);
  const hostedDesk = isNeonDesk();

  const existing = hostedDesk
    ? await getNeonDeskBet(betId)
    : db.select().from(bets).where(eq(bets.id, betId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextLabel = p.label !== undefined ? p.label : existing.label;
  const effectiveBetType = p.betType ?? existing.betType;
  const shouldReparseTriggers =
    p.triggerText !== undefined ||
    p.label !== undefined ||
    p.betType !== undefined ||
    (p.eventId !== undefined && (existing.triggerText || existing.triggerRule));

  let triggerFields: { triggerText: string | null; triggerRule: string | null } | undefined;
  if (shouldReparseTriggers) {
    const eventId = p.eventId !== undefined ? p.eventId : existing.eventId;
    triggerFields = resolveTriggerFields({
      betType: effectiveBetType,
      label: nextLabel,
      triggerText: p.triggerText !== undefined ? p.triggerText : existing.triggerText,
      eventId,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
    });
  }

  const set = betPatchValues(p, existing, triggerFields);

  if (hostedDesk) {
    try {
      if (p.status === "open" && existing.status !== "open") {
        await purgeNeonDeskSettlementTransactionsForBet(betId);
      }
      let updated = await patchNeonDeskBet(betId, set);
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const placementTouched =
        p.betType !== undefined ||
        p.backStake !== undefined ||
        p.layStake !== undefined ||
        p.layOdds !== undefined ||
        p.bookmaker !== undefined ||
        p.exchangeId !== undefined;
      if (placementTouched && updated.status === "open") {
        await reledgerNeonOpenBetPlacement(updated).catch((error) => {
          logNeonLedgerFailure("reledger", updated.id, error);
        });
      }
      if (p.status === undefined && updated.eventId != null) {
        const event = await getNeonEvent(updated.eventId);
        if (event) {
          const corrected = await resyncNeonSettledBetAgainstEvent(updated, event);
          if (corrected) updated = corrected;
        }
      }
      if (updated.status !== "open") {
        await ledgerNeonBetSettlement(updated).catch((error) => {
          logNeonLedgerFailure("settlement", updated.id, error);
        });
      }
      if (p.purpose === "mug" && updated.bookmaker) {
        await stampNeonMugPlansForBookmaker(
          updated.bookmaker,
          updated.createdAt
        ).catch(() => {});
      }
      await syncNeonBoostDiaryFromBet(updated).catch(() => {});
      return NextResponse.json({ bet: updated });
    } catch (error) {
      return neonWriteError(error);
    }
  }

  const patched = db.update(bets).set(set).where(eq(bets.id, betId)).returning().get();
  if (!patched) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let updated = patched;

  // Editing a bet into a mug stamps the cadence plan with the bet's
  // placement date - only ever moving the stamp FORWARD (J5).
  if (p.purpose === "mug" && updated.bookmaker) {
    const target = updated.bookmaker.trim().toLowerCase();
    const matchingIds = db
      .select()
      .from(accounts)
      .all()
      .filter((a) => a.name.trim().toLowerCase() === target)
      .map((a) => a.id);
    if (matchingIds.length > 0) {
      for (const plan of db
        .select()
        .from(mugPlans)
        .where(inArray(mugPlans.accountId, matchingIds))
        .all()) {
        if ((plan.lastMugAt ?? 0) < updated.createdAt) {
          db.update(mugPlans)
            .set({ lastMugAt: updated.createdAt })
            .where(eq(mugPlans.id, plan.id))
            .run();
        }
      }
    }
  }
  const placementTouched =
    p.betType !== undefined ||
    p.backStake !== undefined ||
    p.layStake !== undefined ||
    p.layOdds !== undefined ||
    p.bookmaker !== undefined ||
    p.exchangeId !== undefined;
  if (p.legs !== undefined) {
    reledgerDutchFreeLegs(updated);
  } else if (placementTouched && updated.status === "open") {
    reledgerOpenBetPlacement(existing, updated);
  }
  if (p.status === undefined && updated.eventId != null) {
    const event = db.select().from(events).where(eq(events.id, updated.eventId)).get();
    if (event) {
      const corrected = resyncSettledBetAgainstEvent(updated, event);
      if (corrected) {
        applyFreeBetEffectsForBet(corrected, event);
        updated = db.select().from(bets).where(eq(bets.id, corrected.id)).get() ?? corrected;
      }
    }
  }
  if (updated.status !== "open") ledgerFromSettledBet(updated);
  syncBoostDiaryFromBet(updated);
  syncOfferStatuses();
  if (updated.offerId != null || existing.offerId != null) {
    spawnCourseOfferSiblingsIfNeeded();
  }
  return NextResponse.json({ bet: updated });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const betId = Number(id);

  if (isNeonDesk()) {
    try {
      const deleted = await deleteNeonDeskBet(betId);
      if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await unlinkNeonBoostDiaryForBet(betId).catch(() => {});
      await purgeNeonDeskLedgerForBet(betId);
      await purgeNeonDeskHistoryForBet(betId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return neonWriteError(error);
    }
  }

  unlinkBoostDiaryForBet(betId);
  purgeHistoryForBet(betId);
  purgeLedgerForDeletedBet(betId);
  db.delete(bets).where(eq(bets.id, betId)).run();
  return NextResponse.json({ ok: true });
});
