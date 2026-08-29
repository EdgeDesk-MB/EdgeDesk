import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, betBuilderRuns, betBuilderSelections, bets } from "@/lib/db";
import {
  logBetBuilderWholeLay,
  markBetBuilderNoLay,
  settleBetBuilderRun,
  updateBetBuilderRun,
} from "@/lib/services/bet-builder-desk";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  deleteNeonBetBuilderRun,
  logNeonBetBuilderWholeLay,
  markNeonBetBuilderNoLay,
  patchNeonBetBuilderRunFlags,
  settleNeonBetBuilderRun,
  updateNeonBetBuilderRun,
} from "@/lib/db/neon-desk-bet-builder";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  muteAlerts: z.boolean().optional(),
  noLay: z.literal(true).optional(),
  status: z.literal("abandoned").optional(),
  /** Whole-ticket settle (builder wins or loses as one unit). */
  result: z.enum(["won", "lost", "void"]).optional(),
  wholeLay: z
    .object({
      layOdds: z.number().gt(1),
      layStake: z.number().gt(0),
      exchangeId: z.number().int().positive().nullable().optional(),
    })
    .optional(),
  /** Full edit payload from Bet Builder Desk Edit dialog. */
  label: z.string().min(1).optional(),
  bookmaker: z.string().nullable().optional(),
  stake: z.number().gt(0).optional(),
  backOdds: z.number().gt(1).optional(),
  commission: z.number().min(0).max(0.5).optional(),
  eventLabel: z.string().nullable().optional(),
  eventId: z.number().nullable().optional(),
  sport: z.string().max(40).nullable().optional(),
  scheduledAt: z.number().int().nullable().optional(),
  backBetType: z.enum(["qualifying", "free_snr", "free_sr"]).optional(),
  selections: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        label: z.string().min(1),
        market: z.string().nullable().optional(),
        selection: z.string().nullable().optional(),
      })
    )
    .min(2)
    .optional(),
});

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await deniedFeatureResponse("bet_builder_desk");
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const runId = Number(id);
  if (isNeonDesk()) {
    if (p.wholeLay) {
      const run = await logNeonBetBuilderWholeLay(
        runId,
        p.wholeLay.layOdds,
        p.wholeLay.layStake,
        p.wholeLay.exchangeId
      );
      if (!run) return NextResponse.json({ error: "Cannot log whole lay" }, { status: 400 });
      return NextResponse.json({ run });
    }
    if (p.noLay) {
      const run = await markNeonBetBuilderNoLay(runId);
      if (!run) return NextResponse.json({ error: "Cannot mark no lay" }, { status: 400 });
      return NextResponse.json({ run });
    }
    if (p.result) {
      const run = await settleNeonBetBuilderRun(runId, p.result);
      if (!run) return NextResponse.json({ error: "Cannot settle bet builder" }, { status: 400 });
      return NextResponse.json({ run });
    }
    if (p.label != null && p.selections != null) {
      const view = await updateNeonBetBuilderRun(runId, {
        label: p.label,
        bookmaker: p.bookmaker,
        stake: p.stake,
        backOdds: p.backOdds,
        commission: p.commission,
        eventLabel: p.eventLabel,
        eventId: p.eventId,
        sport: p.sport,
        scheduledAt: p.scheduledAt,
        backBetType: p.backBetType,
        selections: p.selections,
      });
      if (!view) {
        return NextResponse.json(
          { error: "Cannot update bet builder - check selections, or money fields after lay/results" },
          { status: 400 }
        );
      }
      return NextResponse.json(view);
    }
    const run = await patchNeonBetBuilderRunFlags(runId, {
      muteAlerts: p.muteAlerts,
      status: p.status,
    });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run });
  }
  if (p.wholeLay) {
    const run = logBetBuilderWholeLay(
      runId,
      p.wholeLay.layOdds,
      p.wholeLay.layStake,
      p.wholeLay.exchangeId
    );
    if (!run) return NextResponse.json({ error: "Cannot log whole lay" }, { status: 400 });
    return NextResponse.json({ run });
  }
  if (p.noLay) {
    const run = markBetBuilderNoLay(runId);
    if (!run) return NextResponse.json({ error: "Cannot mark no lay" }, { status: 400 });
    return NextResponse.json({ run });
  }
  if (p.result) {
    const run = settleBetBuilderRun(runId, p.result);
    if (!run) return NextResponse.json({ error: "Cannot settle bet builder" }, { status: 400 });
    return NextResponse.json({ run });
  }
  if (p.label != null && p.selections != null) {
    const view = updateBetBuilderRun(runId, {
      label: p.label,
      bookmaker: p.bookmaker,
      stake: p.stake,
      backOdds: p.backOdds,
      commission: p.commission,
      eventLabel: p.eventLabel,
      eventId: p.eventId,
      sport: p.sport,
      scheduledAt: p.scheduledAt,
      backBetType: p.backBetType,
      selections: p.selections,
    });
    if (!view) {
      return NextResponse.json(
        { error: "Cannot update bet builder - check selections, or money fields after lay/results" },
        { status: 400 }
      );
    }
    return NextResponse.json(view);
  }
  const run = db
    .update(betBuilderRuns)
    .set({
      ...(p.muteAlerts !== undefined ? { muteAlerts: p.muteAlerts ? 1 : 0 } : {}),
      ...(p.status ? { status: p.status } : {}),
    })
    .where(eq(betBuilderRuns.id, runId))
    .returning()
    .get();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await deniedFeatureResponse("bet_builder_desk");
  if (denied) return denied;
  const { id } = await ctx.params;
  const runId = Number(id);
  if (isNeonDesk()) {
    const ok = await deleteNeonBetBuilderRun(runId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const run = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).get();
  const linkedBetIds = [run?.backBetId, run?.wholeLayBetId].filter(
    (x): x is number => x != null
  );
  for (const betId of linkedBetIds) {
    db.update(bets)
      .set({ status: "void", actualProfit: 0, settledAt: Date.now() })
      .where(and(eq(bets.id, betId), eq(bets.status, "open")))
      .run();
  }
  db.delete(betBuilderSelections).where(eq(betBuilderSelections.runId, runId)).run();
  db.delete(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).run();
  return NextResponse.json({ ok: true });
});
