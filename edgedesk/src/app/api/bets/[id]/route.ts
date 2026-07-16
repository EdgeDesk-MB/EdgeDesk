import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, accounts, bets, events, mugPlans } from "@/lib/db";
import { resolveTriggerFields } from "@/lib/services/bet-triggers";
import { ledgerFromSettledBet } from "@/lib/services/balances";
import { purgeHistoryForBet } from "@/lib/services/history-feed";
import { resolveOfferForBet, syncOfferStatuses } from "@/lib/services/offers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  purpose: z.enum(["edge", "mug"]).nullable().optional(),
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
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const existing = db.select().from(bets).where(eq(bets.id, Number(id))).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextLabel = p.label !== undefined ? p.label : existing.label;
  const shouldReparseTriggers =
    p.triggerText !== undefined ||
    p.label !== undefined ||
    (p.eventId !== undefined && (existing.triggerText || existing.triggerRule));

  let triggerFields: { triggerText: string | null; triggerRule: string | null } | undefined;
  if (shouldReparseTriggers) {
    const eventId = p.eventId !== undefined ? p.eventId : existing.eventId;
    triggerFields = resolveTriggerFields({
      label: nextLabel,
      triggerText: p.triggerText !== undefined ? p.triggerText : existing.triggerText,
      eventId,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
    });
  }

  const updated = db
    .update(bets)
    .set({
      ...(p.status ? { status: p.status } : {}),
      ...(p.actualProfit !== undefined ? { actualProfit: p.actualProfit } : {}),
      ...(p.label !== undefined ? { label: p.label } : {}),
      ...(p.betType !== undefined ? { betType: p.betType } : {}),
      ...(p.bookmaker !== undefined ? { bookmaker: p.bookmaker } : {}),
      ...(p.exchangeId !== undefined ? { exchangeId: p.exchangeId } : {}),
      ...(p.purpose !== undefined ? { purpose: p.purpose } : {}),
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
      // A mug bet must never stay offer-linked (mirrors the POST guard);
      // placed after the offerId spread so it always wins.
      ...(p.purpose === "mug" ? { offerId: null } : {}),
      ...(triggerFields ?? {}),
      ...(p.status && p.status !== "open" ? { settledAt: Date.now() } : {}),
      // Imported history keeps balanceSettled=1 - its stake was never
      // debited, so a re-settle must never credit a payout (E3).
      ...(p.status === "open"
        ? {
            settledAt: null,
            actualProfit: null,
            ...(existing.source === "import" ? {} : { balanceSettled: 0 }),
          }
        : {}),
    })
    .where(eq(bets.id, Number(id)))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  if (updated.status !== "open") ledgerFromSettledBet(updated);
  syncOfferStatuses();
  return NextResponse.json({ bet: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const betId = Number(id);
  purgeHistoryForBet(betId);
  db.delete(bets).where(eq(bets.id, betId)).run();
  return NextResponse.json({ ok: true });
}
