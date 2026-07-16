import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, boostDiary } from "@/lib/db";
import { roundPence } from "@/lib/calc/money";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  outcome: z.enum(["won", "lost", "void"]),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = db.select().from(boostDiary).where(eq(boostDiary.id, Number(id))).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { outcome } = parsed.data;
  // Boost diary entries are simple backs: won pays stake × (odds − 1),
  // lost loses the stake, void returns it.
  const actualProfit =
    outcome === "won"
      ? roundPence(existing.stake * (existing.boostedOdds - 1))
      : outcome === "lost"
        ? -existing.stake
        : 0;

  const row = db
    .update(boostDiary)
    .set({ outcome, actualProfit, settledAt: Date.now() })
    .where(eq(boostDiary.id, Number(id)))
    .returning()
    .get();
  return NextResponse.json({ entry: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = db.select().from(boostDiary).where(eq(boostDiary.id, Number(id))).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.delete(boostDiary).where(eq(boostDiary.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
