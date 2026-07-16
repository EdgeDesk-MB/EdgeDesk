import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, boostDiary } from "@/lib/db";
import { roundPence } from "@/lib/calc/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = db.select().from(boostDiary).orderBy(desc(boostDiary.createdAt)).all();
  return NextResponse.json({ entries });
}

const createSchema = z.object({
  label: z.string().min(1).max(200),
  bookmaker: z.string().max(120).nullable().optional(),
  kind: z.enum(["boost", "builder"]),
  boostedOdds: z.number().gt(1),
  fairOdds: z.number().gt(1),
  stake: z.number().min(0),
  evGbp: z.number(),
  basis: z.enum(["estimated", "heuristic"]),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const row = db
    .insert(boostDiary)
    .values({
      label: input.label.trim(),
      bookmaker: input.bookmaker?.trim() || null,
      kind: input.kind,
      boostedOdds: input.boostedOdds,
      fairOdds: input.fairOdds,
      // Pence-round money at the write boundary so sub-penny stakes can
      // never reach settlement arithmetic.
      stake: roundPence(input.stake),
      evGbp: roundPence(input.evGbp),
      basis: input.basis,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ entry: row });
}
