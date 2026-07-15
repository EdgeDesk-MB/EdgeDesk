import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, casinoOffers } from "@/lib/db";
import { casinoOfferEv, houseEdgeFromRtp, DEFAULT_RTP } from "@/lib/calc/casino-ev";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  casino: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  bonusAmount: z.number().positive(),
  wageringMultiplier: z.number().min(0).max(200),
  /** 0-1; omitted = 96% heuristic default */
  rtp: z.number().min(0.5).max(1).nullable().optional(),
  /** 0-1; omitted = 100% */
  contributionPct: z.number().min(0.01).max(1).nullable().optional(),
  status: z.enum(["planned", "active"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export async function GET() {
  const offers = db.select().from(casinoOffers).all().sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ offers });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const { ev } = casinoOfferEv({
    bonusAmount: input.bonusAmount,
    wageringMultiplier: input.wageringMultiplier,
    houseEdge: houseEdgeFromRtp(input.rtp ?? DEFAULT_RTP),
    contributionPct: input.contributionPct ?? undefined,
  });
  const row = db
    .insert(casinoOffers)
    .values({
      casino: input.casino?.trim() || null,
      title: input.title.trim(),
      bonusAmount: input.bonusAmount,
      wageringMultiplier: input.wageringMultiplier,
      rtp: input.rtp ?? null,
      contributionPct: input.contributionPct ?? null,
      status: input.status ?? "planned",
      expectedEv: ev,
      notes: input.notes ?? null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ offer: row });
}
