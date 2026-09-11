import { NextRequest, NextResponse } from "next/server";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { rateLimitResponse } from "@/lib/api-rate-limit";
import { ensureEventMatchTape } from "@/lib/services/event-match-tape";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitResponse("event-tape", req, {
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const event = await ensureEventMatchTape(eventId, { refresh });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: event.id,
    goals: event.goals,
    lineups: event.lineups,
    tapeFetchedAt: event.tapeFetchedAt ?? null,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    minute: event.minute,
    period: event.period,
    status: event.status,
    matchEnding: event.matchEnding,
    htHomeScore: event.htHomeScore,
    htAwayScore: event.htAwayScore,
  });
});
