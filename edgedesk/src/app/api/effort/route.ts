import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, offerEffortSamples } from "@/lib/db";

export const dynamic = "force-dynamic";

const MIN_MINUTES = 0.25;
const MAX_MINUTES = 120;

export async function GET(req: NextRequest) {
  const offerId = Number(req.nextUrl.searchParams.get("offerId"));
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }
  const samples = db
    .select()
    .from(offerEffortSamples)
    .where(eq(offerEffortSamples.offerId, offerId))
    .orderBy(desc(offerEffortSamples.createdAt))
    .all();
  return NextResponse.json({ samples });
}

const createSchema = z.object({
  offerId: z.number().int().positive(),
  actionKind: z.string().min(1).max(50),
  startedAt: z.number().int().positive(),
  endedAt: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { offerId, actionKind, startedAt, endedAt } = parsed.data;
  const durationMin = (endedAt - startedAt) / 60_000;
  if (durationMin < MIN_MINUTES || durationMin > MAX_MINUTES) {
    // Sub-15s taps and hour-plus stale timers are noise, not measurements.
    return NextResponse.json({ skipped: true });
  }
  const row = db
    .insert(offerEffortSamples)
    .values({
      offerId,
      actionKind,
      startedAt,
      endedAt,
      durationMin: Math.round(durationMin * 100) / 100,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ sample: row });
}

const patchSchema = z.object({
  id: z.number().int().positive(),
  durationMin: z.number().min(MIN_MINUTES).max(MAX_MINUTES),
});

export async function PATCH(req: NextRequest) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const row = db
    .update(offerEffortSamples)
    .set({ durationMin: Math.round(parsed.data.durationMin * 100) / 100, edited: 1 })
    .where(eq(offerEffortSamples.id, parsed.data.id))
    .returning()
    .get();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sample: row });
}
