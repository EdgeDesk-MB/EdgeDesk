import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logLegLay, setLegResult } from "@/lib/services/acca-desk";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  lay: z.object({ layOdds: z.number().gt(1), layStake: z.number().gt(0) }).optional(),
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
    const leg = logLegLay(Number(id), p.lay.layOdds, p.lay.layStake);
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
