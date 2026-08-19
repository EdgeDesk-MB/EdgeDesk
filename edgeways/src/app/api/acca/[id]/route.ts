import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, accaLegs, accaRuns, bets } from "@/lib/db";
import {
  logWholeLay,
  markAccaNoLay,
  setRunBoost,
  updateAccaRun,
} from "@/lib/services/acca-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  muteAlerts: z.boolean().optional(),
  status: z.literal("abandoned").optional(),
  wholeLay: z
    .object({
      layOdds: z.number().gt(1),
      layStake: z.number().gt(0),
      exchangeId: z.number().int().positive().nullable().optional(),
    })
    .optional(),
  boostPct: z.number().min(0).max(500).nullable().optional(),
  noLay: z.literal(true).optional(),
  /** Full edit payload from Acca Desk Edit dialog. */
  label: z.string().min(1).optional(),
  bookmaker: z.string().nullable().optional(),
  stake: z.number().gt(0).optional(),
  commission: z.number().min(0).max(0.5).optional(),
  refundAmount: z.number().min(0).nullable().optional(),
  backBetType: z.enum(["qualifying", "free_snr", "free_sr"]).optional(),
  legs: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        label: z.string().min(1),
        backOdds: z.number().gt(1),
        eventId: z.number().nullable().optional(),
        sport: z.string().max(40).nullable().optional(),
        market: z.string().nullable().optional(),
        selection: z.string().nullable().optional(),
        scheduledAt: z.number().int().nullable().optional(),
      })
    )
    .min(2)
    .optional(),
});

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  if (p.wholeLay) {
    const run = logWholeLay(
      Number(id),
      p.wholeLay.layOdds,
      p.wholeLay.layStake,
      p.wholeLay.exchangeId
    );
    if (!run) return NextResponse.json({ error: "Cannot log whole lay" }, { status: 400 });
    return NextResponse.json({ run });
  }
  if (p.noLay === true) {
    const run = markAccaNoLay(Number(id));
    if (!run) return NextResponse.json({ error: "Cannot mark no lay" }, { status: 400 });
    return NextResponse.json({ run });
  }
  if (p.label != null && p.legs != null) {
    const view = updateAccaRun(Number(id), {
      label: p.label,
      bookmaker: p.bookmaker,
      stake: p.stake,
      commission: p.commission,
      refundAmount: p.refundAmount,
      boostPct: p.boostPct,
      backBetType: p.backBetType,
      legs: p.legs,
    });
    if (!view) {
      return NextResponse.json(
        { error: "Cannot update run - check legs, or money fields after lays/results" },
        { status: 400 }
      );
    }
    return NextResponse.json(view);
  }
  if (p.boostPct !== undefined) {
    const run = setRunBoost(Number(id), p.boostPct);
    if (!run) return NextResponse.json({ error: "Cannot set boost - run is no longer active" }, { status: 400 });
    return NextResponse.json({ run });
  }
  const run = db
    .update(accaRuns)
    .set({
      ...(p.muteAlerts !== undefined ? { muteAlerts: p.muteAlerts ? 1 : 0 } : {}),
      ...(p.status ? { status: p.status } : {}),
    })
    .where(eq(accaRuns.id, Number(id)))
    .returning()
    .get();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Void any still-open linked bets - deleting the run must not leave
  // tracker rows that nothing will ever settle (auditor F5).
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, Number(id))).get();
  const legs = db.select().from(accaLegs).where(eq(accaLegs.runId, Number(id))).all();
  const linkedBetIds = [
    run?.backBetId,
    run?.wholeLayBetId,
    ...legs.map((l) => l.layBetId),
  ].filter((x): x is number => x != null);
  for (const betId of linkedBetIds) {
    db.update(bets)
      .set({ status: "void", actualProfit: 0, settledAt: Date.now() })
      .where(and(eq(bets.id, betId), eq(bets.status, "open")))
      .run();
  }
  db.delete(accaLegs).where(eq(accaLegs.runId, Number(id))).run();
  db.delete(accaRuns).where(eq(accaRuns.id, Number(id))).run();
  return NextResponse.json({ ok: true });
});
