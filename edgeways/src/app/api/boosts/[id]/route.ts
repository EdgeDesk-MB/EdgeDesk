import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteBoostDiary,
  getBoostDiary,
  linkBoostDiaryBet,
  settleBoostDiary,
} from "@/lib/services/boosts";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const patchSchema = z.union([
  z.object({
    betId: z.number().int().positive(),
  }),
  z.object({
    outcome: z.enum(["won", "lost", "void"]),
  }),
]);

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const diaryId = Number(id);
  if (!Number.isFinite(diaryId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if ("betId" in parsed.data) {
    const row = linkBoostDiaryBet(diaryId, parsed.data.betId);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const entry = getBoostDiary(diaryId);
    return NextResponse.json({ entry });
  }

  const result = settleBoostDiary(diaryId, parsed.data.outcome);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ entry: result.entry, bet: result.bet });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = deleteBoostDiary(Number(id));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
