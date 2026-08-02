import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, casinoOffers } from "@/lib/db";
import {
  createCasinoOfferSeriesWithInstance,
  syncCasinoOfferSeriesInstances,
} from "@/lib/offers/casino-offer-recurrence";
import { getCasinoOfferSummaries, getCasinoOfferSummary } from "@/lib/services/casino-offers";

export const dynamic = "force-dynamic";

const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  byMonthday: z.number().int().min(1).max(31).optional(),
  expiryOffsetDays: z.number().int().min(0).max(365).optional(),
});

const createSchema = z.object({
  casino: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  status: z.enum(["planned", "active"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
  expiresAt: z.number().nullable().optional(),
  recurrence: recurrenceSchema.optional(),
});

export async function GET() {
  syncCasinoOfferSeriesInstances();
  const offers = getCasinoOfferSummaries();
  return NextResponse.json({ offers });
}

/**
 * K1: creates the CAMPAIGN only - no reward fields. A campaign starts with
 * zero components (add them via POST /api/casino/[id]/components), same
 * as a sports offer campaign starting with zero linked bets.
 *
 * K3: when `recurrence` is set, creates a series + first instance instead.
 * Horizon materialisation waits until the first component seals the template.
 */
export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.recurrence) {
    const { offerId } = createCasinoOfferSeriesWithInstance(
      {
        casino: input.casino?.trim() || null,
        title: input.title.trim(),
        notes: input.notes ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      input.recurrence
    );
    return NextResponse.json({ offer: getCasinoOfferSummary(offerId) });
  }

  const row = db
    .insert(casinoOffers)
    .values({
      casino: input.casino?.trim() || null,
      title: input.title.trim(),
      // Legacy columns (pre-K1) - zeroed/nulled for a new campaign; the K1
      // backfill migration only ever targets bonus_amount > 0 rows, so this
      // never gets mistaken for an unmigrated legacy offer.
      bonusAmount: 0,
      wageringMultiplier: 0,
      rtp: null,
      contributionPct: null,
      expectedEv: 0,
      game: null,
      status: input.status ?? "planned",
      notes: input.notes ?? null,
      expiresAt: input.expiresAt ?? null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ offer: getCasinoOfferSummary(row.id) });
}
