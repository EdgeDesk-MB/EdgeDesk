import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, events } from "@/lib/db";
import { searchFixtureByTeams } from "@/lib/services/apifootball";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const trackSchema = z.object({
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  sport: z.string().default("football"),
  startTime: z.number().optional(),
  competition: z.string().optional(),
});

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function teamsMatch(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Find-or-create an event for a match, so calculators can link bets in one step.
 * Resolution order: existing tracked event → real API-Football fixture → manual event.
 * Returns { event, mode } where mode ∈ "existing" | "api" | "manual".
 */
export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = trackSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { homeTeam, awayTeam, sport, startTime, competition } = parsed.data;

  // 1. An event we're already tracking (don't duplicate) - fuzzy team match
  const existing = db
    .select()
    .from(events)
    .all()
    .find(
      (e) =>
        e.status !== "finished" &&
        (e.sport ?? "football") === sport &&
        teamsMatch(e.homeTeam, homeTeam) &&
        teamsMatch(e.awayTeam, awayTeam)
    );
  if (existing) {
    return NextResponse.json({ event: existing, mode: "existing" });
  }

  const now = Date.now();

  // 2. A real fixture from API-Football (live score tracking works automatically)
  const fixture = await searchFixtureByTeams(homeTeam, awayTeam);
  if (fixture) {
    const inserted = db
      .insert(events)
      .values({
        sport: "football",
        competition: fixture.competition,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        startTime: fixture.startTime,
        source: "api",
        externalId: fixture.externalId,
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        minute: fixture.minute,
        createdAt: now,
      })
      .returning()
      .get();
    return NextResponse.json({ event: inserted, mode: "api" });
  }

  // 3. Manual event - scores updated by hand on the Events page
  const inserted = db
    .insert(events)
    .values({
      sport,
      competition: competition ?? null,
      homeTeam,
      awayTeam,
      startTime: startTime ?? now,
      source: "manual",
      status: "upcoming",
      createdAt: now,
    })
    .returning()
    .get();
  return NextResponse.json({ event: inserted, mode: "manual" });
});
