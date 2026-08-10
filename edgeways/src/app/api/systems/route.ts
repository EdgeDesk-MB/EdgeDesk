import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSystemRun, listSystemRuns } from "@/lib/services/systems-desk";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: listSystemRuns() });
}

const legSchema = z.object({
  label: z.string().min(1).max(200),
  oddsDecimal: z.number().gt(1),
  eventId: z.number().nullable().optional(),
  sport: z.string().max(40).nullable().optional(),
  market: z.string().nullable().optional(),
  selection: z.string().nullable().optional(),
  scheduledAt: z.number().nullable().optional(),
});

const createSchema = z.object({
  label: z.string().min(1).max(200),
  structure: z.enum([
    "trixie",
    "patent",
    "yankee",
    "canadian",
    "heinz",
    "super_heinz",
    "goliath",
    "lucky_15",
    "lucky_31",
    "lucky_63",
  ]),
  unitStake: z.number().gt(0),
  bookmaker: z.string().max(120).nullable().optional(),
  eachWay: z.boolean().optional(),
  placeFraction: z.number().gt(0).lt(1).nullable().optional(),
  classification: z.enum(["ev_play", "mug_bet", "qualifying"]).optional(),
  offerId: z.number().nullable().optional(),
  backBetType: z.enum(["qualifying", "free_snr", "free_sr"]).optional(),
  legs: z.array(legSchema).min(3).max(8),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(createSystemRun(parsed.data));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create system run" },
      { status: 400 }
    );
  }
}
