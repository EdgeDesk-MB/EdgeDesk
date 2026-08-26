import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, offers } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import {
  insertNeonDeskOffer,
  listNeonDeskOffers,
} from "@/lib/db/neon-desk-offers";
import { summariseOffer as summariseOfferPure } from "@/lib/offers/offer-profit";
import {
  createOfferSeriesWithInstance,
  localYmd,
  type OfferRecurrenceRule,
} from "@/lib/offers/offer-recurrence";
import { normalizeOfferUrl } from "@/lib/offers/offer-url";
import {
  backfillOffersFromBets,
  listOfferSummaries,
  syncOfferSeriesInstances,
  syncOfferStatuses,
} from "@/lib/services/offers";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).optional(),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  byMonthday: z.number().int().min(1).max(31).optional(),
  expiryOffsetDays: z.number().int().min(0).max(365).optional(),
});

const offerUrlField = z
  .string()
  .nullable()
  .optional()
  .refine((v) => v == null || v.trim() === "" || normalizeOfferUrl(v) != null, {
    message: "Enter a valid http(s) link",
  });

const createSchema = z.object({
  bookmaker: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  expectedProfit: z.number().optional(),
  status: z.enum(["planned", "active", "completed", "expired"]).optional(),
  expiresAt: z.number().nullable().optional(),
  /** YYYY-MM-DD; offer auto-activates when this date arrives. */
  startsOn: z.string().nullable().optional(),
  sport: z.string().nullable().optional(),
  offerType: z.string().nullable().optional(),
  scopeCourse: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  scopeRaceId: z.string().nullable().optional(),
  scopeRaceLabel: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  offerUrl: offerUrlField,
  recurrence: recurrenceSchema.optional(),
});

export const GET = withDeskScope(async function GET() {
  const denied = await deniedFeatureResponse("offers_pipeline");
  if (denied) return denied;
  if (isNeonDesk()) {
    // Hosted desk: no series sync / backfill (SQLite-only machinery). Plain
    // campaign list with profit summaries computed from Neon rows.
    const [offerRows, betRows] = await Promise.all([
      listNeonDeskOffers(),
      listNeonDeskBets(),
    ]);
    const hosted = offerRows
      .map((o) =>
        summariseOfferPure(o, betRows.filter((b) => b.offerId === o.id), {})
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ offers: hosted });
  }
  backfillOffersFromBets();
  syncOfferSeriesInstances();
  syncOfferStatuses();
  return NextResponse.json({ offers: listOfferSummaries() });
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const denied = await deniedFeatureResponse("offers_pipeline");
  if (denied) return denied;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const offerUrl = normalizeOfferUrl(input.offerUrl ?? null);

  if (isNeonDesk()) {
    if (input.recurrence) {
      return NextResponse.json(
        { error: "Recurring offers are not available on the hosted desk yet." },
        { status: 400 }
      );
    }
    const hostedStartsOn = input.startsOn?.trim() || null;
    const hostedScheduled =
      hostedStartsOn != null && hostedStartsOn > localYmd(new Date());
    try {
      const row = await insertNeonDeskOffer({
        bookmaker: input.bookmaker?.trim() || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        expectedProfit: input.expectedProfit ?? null,
        status: hostedScheduled ? "planned" : (input.status ?? "active"),
        expiresAt: input.expiresAt ?? null,
        startsOn: hostedStartsOn,
        sport: input.sport ?? null,
        offerType: input.offerType ?? null,
        scopeCourse: input.scopeCourse ?? null,
        eventDate: input.eventDate ?? null,
        scopeRaceId: input.scopeRaceId ?? null,
        scopeRaceLabel: input.scopeRaceLabel ?? null,
        rules: input.rules ?? null,
        offerUrl,
        createdAt: Date.now(),
      });
      return NextResponse.json({ offer: row });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the offer.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (input.recurrence) {
    const rule: OfferRecurrenceRule = {
      freq: input.recurrence.freq,
      interval: input.recurrence.interval ?? 1,
      byWeekday: input.recurrence.byWeekday,
      byMonthday: input.recurrence.byMonthday,
      expiryOffsetDays: input.recurrence.expiryOffsetDays,
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
        offerUrl,
        expiresAt: input.expiresAt ?? null,
      },
      rule,
      { startsOn: input.startsOn ?? undefined }
    );
    const row = db.select().from(offers).where(eq(offers.id, offerId)).get();
    return NextResponse.json({ offer: row });
  }

  // A future "starts on" date always wins over a manually-picked status - the
  // offer isn't live yet, and syncOfferStatuses() auto-activates it on that day.
  const startsOn = input.startsOn?.trim() || null;
  const scheduledFuture = startsOn != null && startsOn > localYmd(new Date());
  const row = db
    .insert(offers)
    .values({
      bookmaker: input.bookmaker?.trim() || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      expectedProfit: input.expectedProfit ?? null,
      status: scheduledFuture ? "planned" : (input.status ?? "active"),
      expiresAt: input.expiresAt ?? null,
      startsOn,
      sport: input.sport ?? null,
      offerType: input.offerType ?? null,
      scopeCourse: input.scopeCourse ?? null,
      eventDate: input.eventDate ?? null,
      scopeRaceId: input.scopeRaceId ?? null,
      scopeRaceLabel: input.scopeRaceLabel ?? null,
      rules: input.rules ?? null,
      offerUrl,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ offer: row });
});
