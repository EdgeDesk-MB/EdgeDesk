import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteSystemRun,
  patchSystemRun,
  setSystemLegResult,
  updateSystemRun,
} from "@/lib/services/systems-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";
import { blockHostedDeskMutation } from "@/lib/db/hosted-desk-guard";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  classification: z.enum(["ev_play", "mug_bet", "qualifying"]).optional(),
  legId: z.number().int().positive().optional(),
  result: z.enum(["won", "placed", "lost", "void"]).optional(),
  /** Full edit payload from Systems Desk Edit dialog. */
  label: z.string().min(1).optional(),
  bookmaker: z.string().nullable().optional(),
  unitStake: z.number().gt(0).optional(),
  eachWay: z.boolean().optional(),
  placeFraction: z.number().gt(0).lt(1).nullable().optional(),
  backBetType: z.enum(["qualifying", "free_snr", "free_sr"]).optional(),
  legs: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        label: z.string().min(1),
        oddsDecimal: z.number().gt(1),
        eventId: z.number().nullable().optional(),
        sport: z.string().max(40).nullable().optional(),
        market: z.string().nullable().optional(),
        selection: z.string().nullable().optional(),
        scheduledAt: z.number().int().nullable().optional(),
      })
    )
    .min(3)
    .max(8)
    .optional(),
});

export const PATCH = withDeskScope(async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = await deniedFeatureResponse("systems_desk");
  if (denied) return denied;
  const blocked = blockHostedDeskMutation("Systems Desk");
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  if (p.legId != null && p.result != null) {
    const out = setSystemLegResult(p.legId, p.result);
    if (!out) {
      return NextResponse.json({ error: "Could not update leg" }, { status: 400 });
    }
    return NextResponse.json(out);
  }
  if (p.label != null && p.legs != null) {
    const view = updateSystemRun(Number(id), {
      label: p.label,
      bookmaker: p.bookmaker,
      unitStake: p.unitStake,
      eachWay: p.eachWay,
      placeFraction: p.placeFraction,
      classification: p.classification,
      backBetType: p.backBetType,
      legs: p.legs,
    });
    if (!view) {
      return NextResponse.json(
        { error: "Cannot update system - check legs, or money fields after results" },
        { status: 400 }
      );
    }
    return NextResponse.json(view);
  }
  if (p.classification != null) {
    const run = patchSystemRun(Number(id), { classification: p.classification });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run });
  }
  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
});

export const DELETE = withDeskScope(async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = await deniedFeatureResponse("systems_desk");
  if (denied) return denied;
  const blocked = blockHostedDeskMutation("Systems Desk");
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const ok = deleteSystemRun(Number(id));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
