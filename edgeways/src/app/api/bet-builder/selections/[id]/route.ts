import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setBetBuilderSelectionResult } from "@/lib/services/bet-builder-desk";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { setNeonBetBuilderSelectionResult } from "@/lib/db/neon-desk-bet-builder";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  result: z.enum(["won", "lost", "void"]),
});

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await deniedFeatureResponse("bet_builder_desk");
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const out = isNeonDesk()
    ? await setNeonBetBuilderSelectionResult(Number(id), parsed.data.result)
    : setBetBuilderSelectionResult(Number(id), parsed.data.result);
  if (!out) return NextResponse.json({ error: "Cannot set result" }, { status: 400 });
  return NextResponse.json(out);
});
