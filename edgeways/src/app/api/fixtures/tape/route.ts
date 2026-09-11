import { NextRequest, NextResponse } from "next/server";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { rateLimitResponse } from "@/lib/api-rate-limit";
import {
  fixtureById,
  fixtureLineups,
  fixtureMatchEvents,
} from "@/lib/services/apifootball";

export const dynamic = "force-dynamic";

/**
 * Commentary + XI for a day-card fixture that is not (yet) a tracked event.
 * Tracked rows keep using `/api/events/:id/tape` so the tape writes through.
 */
export const GET = withDeskScope(async function GET(req: NextRequest) {
  const limited = rateLimitResponse("event-tape", req, {
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const externalId = req.nextUrl.searchParams.get("externalId")?.trim() ?? "";
  const home = req.nextUrl.searchParams.get("home")?.trim() ?? "";
  if (!externalId || !home) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [tape, lineups, fixture] = await Promise.all([
    fixtureMatchEvents(externalId, home),
    fixtureLineups(externalId),
    fixtureById(externalId),
  ]);

  return NextResponse.json({
    goals: JSON.stringify(tape),
    lineups: lineups ? JSON.stringify(lineups) : null,
    homeScore: fixture?.homeScore,
    awayScore: fixture?.awayScore,
    minute: fixture?.minute,
    period: fixture?.period ?? null,
    status: fixture?.status,
    matchEnding: fixture?.matchEnding ?? null,
    htHomeScore: fixture?.htHomeScore ?? null,
    htAwayScore: fixture?.htAwayScore ?? null,
  });
});
