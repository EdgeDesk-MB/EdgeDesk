import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBoostDiary, listBoostDiary } from "@/lib/services/boosts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ entries: listBoostDiary() });
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
  layStake: z.number().min(0).nullable().optional(),
  layOdds: z.number().gt(1).nullable().optional(),
  commission: z.number().min(0).max(0.2).nullable().optional(),
  exchangeId: z.number().int().positive().nullable().optional(),
  exchangeBack: z.number().gt(1).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const entry = createBoostDiary(parsed.data);
  return NextResponse.json({ entry });
}
