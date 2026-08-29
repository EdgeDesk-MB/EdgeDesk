import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBoostDiary, listBoostDiary } from "@/lib/services/boosts";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  createNeonBoostDiary,
  listNeonBoostDiary,
} from "@/lib/db/neon-desk-boosts";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    return NextResponse.json({ entries: await listNeonBoostDiary() });
  }
  return NextResponse.json({ entries: listBoostDiary() });
});

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

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (isNeonDesk()) {
    try {
      const entry = await createNeonBoostDiary(parsed.data);
      return NextResponse.json({ entry });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the boost.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }
  const entry = createBoostDiary(parsed.data);
  return NextResponse.json({ entry });
});
