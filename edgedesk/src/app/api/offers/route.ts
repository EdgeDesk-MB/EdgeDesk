import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, offers } from "@/lib/db";
import {
  createOfferSeriesWithInstance,
  type OfferRecurrenceRule,
} from "@/lib/offers/offer-recurrence";
import {
  backfillOffersFromBets,
  listOfferSummaries,
  syncOfferSeriesInstances,
} from "@/lib/services/offers";

export const dynamic = "force-dynamic";

const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly"]),
  interval: z.number().int().min(1).optional(),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
});

const createSchema = z.object({
  bookmaker: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  expectedProfit: z.number().optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  expiresAt: z.number().nullable().optional(),
  sport: z.string().nullable().optional(),
  offerType: z.string().nullable().optional(),
  scopeCourse: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  scopeRaceId: z.string().nullable().optional(),
  scopeRaceLabel: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  recurrence: recurrenceSchema.optional(),
});

export async function GET() {
  backfillOffersFromBets();
  syncOfferSeriesInstances();
  return NextResponse.json({ offers: listOfferSummaries() });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.recurrence) {
    const rule: OfferRecurrenceRule = {
      freq: input.recurrence.freq,
      interval: input.recurrence.interval ?? 1,
      byWeekday: input.recurrence.byWeekday,
    };
    const { offerId } = createOfferSeriesWithInstance(
      {
        bookmaker: input.bookmaker?.trim() || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        expectedProfit: input.expectedProfit ?? null,
        sport: input.sport ?? null,
        offerType: input.offerType ?? null,
        scopeCourse: input.scopeCourse ?? null,
        scopeRaceId: input.scopeRaceId ?? null,
        scopeRaceLabel: input.scopeRaceLabel ?? null,
        rules: input.rules ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      rule
    );
    const row = db.select().from(offers).where(eq(offers.id, offerId)).get();
    return NextResponse.json({ offer: row });
  }

  const row = db
    .insert(offers)
    .values({
      bookmaker: input.bookmaker?.trim() || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      expectedProfit: input.expectedProfit ?? null,
      status: input.status ?? "active",
      expiresAt: input.expiresAt ?? null,
      sport: input.sport ?? null,
      offerType: input.offerType ?? null,
      scopeCourse: input.scopeCourse ?? null,
      eventDate: input.eventDate ?? null,
      scopeRaceId: input.scopeRaceId ?? null,
      scopeRaceLabel: input.scopeRaceLabel ?? null,
      rules: input.rules ?? null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ offer: row });
}
