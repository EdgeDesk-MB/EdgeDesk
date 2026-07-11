import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { generateScript, type SimPreset } from "@/lib/services/sim";
import { serializeRacecardRunners } from "@/lib/racing";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  sport: z.string().default("football"),
  competition: z.string().optional(),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  startTime: z.number().optional(),
  source: z.enum(["api", "manual", "sim"]).default("manual"),
  externalId: z.string().optional(),
  status: z.enum(["upcoming", "live", "finished"]).optional(),
  /** Horse racing racecard runners (stored until results replace goals) */
  runners: z.array(z.string()).optional(),
  homeScore: z.number().optional(),
  awayScore: z.number().optional(),
  minute: z.number().optional(),
  /** For sim events */
  simPreset: z.enum(["two_up_drama", "random", "btts_thriller", "bore_draw"]).optional(),
  /** Named strikers for sim goalscorer triggers - each scores their side's first goal */
  simStars: z.object({ homeStar: z.string().optional(), awayStar: z.string().optional() }).optional(),
});

export async function GET() {
  return NextResponse.json({ events: db.select().from(events).all() });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const now = Date.now();

  if (input.externalId) {
    const existing = db
      .select()
      .from(events)
      .all()
      .find((e) => e.externalId === input.externalId);
    if (existing) {
      await syncRacingResultsForEvents([existing.id]);
      const refreshed = db.select().from(events).where(eq(events.id, existing.id)).get() ?? existing;
      return NextResponse.json({ event: refreshed, existing: true });
    }
  }

  const isSim = input.source === "sim";
  const script = isSim
    ? generateScript((input.simPreset ?? "random") as SimPreset, input.simStars)
    : null;

  const inserted = db
    .insert(events)
    .values({
      sport: input.sport,
      competition: input.competition,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      startTime: input.startTime ?? now,
      source: input.source,
      externalId: input.externalId,
      status: input.status ?? (isSim ? "live" : "upcoming"),
      homeScore: input.homeScore ?? 0,
      awayScore: input.awayScore ?? 0,
      minute: input.minute ?? 0,
      goals:
        input.sport === "horse_racing" && input.runners?.length
          ? serializeRacecardRunners(input.runners)
          : null,
      simScript: script ? JSON.stringify(script) : null,
      simStartedAt: isSim ? now : null,
      createdAt: now,
    })
    .returning()
    .get();

  if (inserted.sport === "horse_racing" && inserted.externalId) {
    await syncRacingResultsForEvents([inserted.id]);
    const refreshed = db.select().from(events).where(eq(events.id, inserted.id)).get() ?? inserted;
    return NextResponse.json({ event: refreshed });
  }

  return NextResponse.json({ event: inserted });
}
