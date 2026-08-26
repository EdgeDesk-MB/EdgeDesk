import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAccaRun, listAccaRuns } from "@/lib/services/acca-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const denied = await deniedFeatureResponse("acca_desk");
  if (denied) return denied;
  return NextResponse.json({ runs: listAccaRuns() });
});

const legSchema = z.object({
  label: z.string().min(1).max(200),
  backOdds: z.number().gt(1),
  eventId: z.number().nullable().optional(),
  sport: z.string().max(40).nullable().optional(),
  market: z.string().nullable().optional(),
  selection: z.string().nullable().optional(),
  scheduledAt: z.number().nullable().optional(),
});

const createSchema = z.object({
  label: z.string().min(1).max(200),
  method: z.enum(["sequential", "insurance_legs", "insurance_whole", "combined"]),
  stake: z.number().gt(0),
  bookmaker: z.string().max(120).nullable().optional(),
  commission: z.number().min(0).max(0.2).optional(),
  offerId: z.number().nullable().optional(),
  refundAmount: z.number().min(0).nullable().optional(),
  boostPct: z.number().min(0).max(500).nullable().optional(),
  backBetType: z.enum(["qualifying", "free_snr", "free_sr"]).optional(),
  noLay: z.boolean().optional(),
  legs: z.array(legSchema).min(2).max(12),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const denied = await deniedFeatureResponse("acca_desk");
  if (denied) return denied;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(createAccaRun(parsed.data));
});
