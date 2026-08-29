import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBetBuilderRun, listBetBuilderRuns } from "@/lib/services/bet-builder-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";
import { blockHostedDeskMutation } from "@/lib/db/hosted-desk-guard";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const denied = await deniedFeatureResponse("bet_builder_desk");
  if (denied) return denied;
  return NextResponse.json({ runs: listBetBuilderRuns() });
});

const selectionSchema = z.object({
  label: z.string().min(1).max(200),
  market: z.string().nullable().optional(),
  selection: z.string().nullable().optional(),
});

const createSchema = z.object({
  label: z.string().min(1).max(200),
  method: z.enum(["combined", "no_lay"]),
  stake: z.number().gt(0),
  backOdds: z.number().gt(1),
  bookmaker: z.string().max(120).nullable().optional(),
  commission: z.number().min(0).max(0.2).optional(),
  offerId: z.number().nullable().optional(),
  eventLabel: z.string().max(200).nullable().optional(),
  eventId: z.number().nullable().optional(),
  sport: z.string().max(40).nullable().optional(),
  scheduledAt: z.number().nullable().optional(),
  backBetType: z.enum(["qualifying", "free_snr", "free_sr"]).optional(),
  selections: z.array(selectionSchema).min(2).max(12),
  wholeLay: z
    .object({
      layOdds: z.number().gt(1),
      layStake: z.number().gt(0),
      exchangeId: z.number().int().positive().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const denied = await deniedFeatureResponse("bet_builder_desk");
  if (denied) return denied;
  const blocked = blockHostedDeskMutation("Bet Builder Desk");
  if (blocked) return blocked;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(createBetBuilderRun(parsed.data));
});
