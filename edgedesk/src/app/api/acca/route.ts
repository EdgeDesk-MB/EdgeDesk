import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAccaRun, listAccaRuns } from "@/lib/services/acca-desk";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: listAccaRuns() });
}

const legSchema = z.object({
  label: z.string().min(1).max(200),
  backOdds: z.number().gt(1),
  eventId: z.number().nullable().optional(),
  market: z.string().nullable().optional(),
  selection: z.string().nullable().optional(),
  scheduledAt: z.number().nullable().optional(),
});

const createSchema = z.object({
  label: z.string().min(1).max(200),
  method: z.enum(["sequential", "insurance_legs", "insurance_whole"]),
  stake: z.number().gt(0),
  bookmaker: z.string().max(120).nullable().optional(),
  commission: z.number().min(0).max(0.2).optional(),
  offerId: z.number().nullable().optional(),
  refundAmount: z.number().min(0).nullable().optional(),
  legs: z.array(legSchema).min(2).max(12),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(createAccaRun(parsed.data));
}
