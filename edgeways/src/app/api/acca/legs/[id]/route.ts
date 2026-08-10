import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logLegLay, setLegResult } from "@/lib/services/acca-desk";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  lay: z
    .object({
      /** Ignored when layStake is 0 (deliberate no lay). */
      layOdds: z.number(),
      /** 0 = deliberate no lay; > 0 requires layOdds > 1. */
      layStake: z.number().min(0),
      exchangeId: z.number().int().positive().nullable().optional(),
    })
    .refine((d) => d.layStake === 0 || d.layOdds > 1, {
      message: "layOdds must be greater than 1 when laying",
    })
    .optional(),
  result: z.enum(["won", "lost", "void"]).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  if (p.lay) {
    const leg = logLegLay(Number(id), p.lay.layOdds, p.lay.layStake, p.lay.exchangeId);
    if (!leg) return NextResponse.json({ error: "Cannot log lay" }, { status: 400 });
    return NextResponse.json({ leg });
  }
  if (p.result) {
    const out = setLegResult(Number(id), p.result);
    if (!out) return NextResponse.json({ error: "Cannot set result" }, { status: 400 });
    return NextResponse.json(out);
  }
  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
