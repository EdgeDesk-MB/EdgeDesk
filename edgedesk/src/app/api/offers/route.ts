import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, offers } from "@/lib/db";
import { backfillOffersFromBets, listOfferSummaries } from "@/lib/services/offers";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  bookmaker: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  expectedProfit: z.number().optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  expiresAt: z.number().optional(),
  sport: z.string().nullable().optional(),
  offerType: z.string().nullable().optional(),
  scopeCourse: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
});

export async function GET() {
  backfillOffersFromBets();
  return NextResponse.json({ offers: listOfferSummaries() });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
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
      rules: input.rules ?? null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ offer: row });
}
