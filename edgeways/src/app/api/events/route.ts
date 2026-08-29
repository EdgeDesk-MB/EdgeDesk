import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { generateScript, type SimPreset } from "@/lib/services/sim";
import {
  parseRaceResults,
  serializeRacecardRunners,
  serializeRaceResults,
  withPreservedRaceDisplayMeta,
  type RaceDisplayMeta,
} from "@/lib/racing";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { blockHostedDeskMutation } from "@/lib/db/hosted-desk-guard";
import { listNeonEventsForDesk } from "@/lib/db/neon-desk-tracked-events";
import { createOrRefreshNeonEvent } from "@/lib/db/neon-event-write";

export const dynamic = "force-dynamic";

const raceMetaSchema = z.object({
  type: z.string().optional(),
  distance: z.string().optional(),
  raceClass: z.string().optional(),
  prize: z.string().optional(),
  going: z.string().optional(),
  fieldSize: z.number().int().positive().optional(),
});

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
  /** Optional racecard details for result-dialog headers */
  raceMeta: raceMetaSchema.optional(),
  homeScore: z.number().optional(),
  awayScore: z.number().optional(),
  minute: z.number().optional(),
  /** For sim events */
  simPreset: z.enum(["two_up_drama", "random", "btts_thriller", "bore_draw"]).optional(),
  /** Named strikers for sim goalscorer triggers - each scores their side's first goal */
  simStars: z.object({ homeStar: z.string().optional(), awayStar: z.string().optional() }).optional(),
});

function raceMetaFromInput(input: {
  raceMeta?: z.infer<typeof raceMetaSchema>;
  runners?: string[];
}): RaceDisplayMeta | undefined {
  const meta = input.raceMeta;
  if (!meta && !input.runners?.length) return undefined;
  return {
    ...meta,
    fieldSize: meta?.fieldSize ?? input.runners?.length,
  };
}

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    return NextResponse.json({ events: await listNeonEventsForDesk() });
  }
  return NextResponse.json({ events: db.select().from(events).all() });
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  if (isNeonDesk()) {
    if (input.source === "sim") {
      const blocked = blockHostedDeskMutation("Simulations");
      if (blocked) return blocked;
    }
    const { event, existing } = await createOrRefreshNeonEvent({
      ...input,
      raceMeta: raceMetaFromInput(input),
    });
    return NextResponse.json({ event, existing: existing || undefined });
  }
  const now = Date.now();

  if (input.externalId) {
    const existing = db
      .select()
      .from(events)
      .all()
      .find((e) => e.externalId === input.externalId);
    if (existing) {
      // Refresh pending-card meta (prize/going/type) when re-tracking before a result lands.
      if (
        existing.sport === "horse_racing" &&
        !parseRaceResults(existing.goals) &&
        input.runners?.length
      ) {
        db.update(events)
          .set({
            homeTeam: input.homeTeam,
            competition: input.competition ?? existing.competition,
            goals: serializeRacecardRunners(input.runners, raceMetaFromInput(input)),
          })
          .where(eq(events.id, existing.id))
          .run();
      } else if (
        existing.sport === "horse_racing" &&
        parseRaceResults(existing.goals) &&
        input.raceMeta
      ) {
        const result = parseRaceResults(existing.goals)!;
        db.update(events)
          .set({
            goals: serializeRaceResults(
              withPreservedRaceDisplayMeta(
                { ...result, ...raceMetaFromInput(input) },
                existing.goals
              )
            ),
          })
          .where(eq(events.id, existing.id))
          .run();
      }
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
          ? serializeRacecardRunners(input.runners, raceMetaFromInput(input))
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
});
