import { NextRequest, NextResponse } from "next/server";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";

export const dynamic = "force-dynamic";

/** Force-fetch racing results for tracked events (open bets / Events page). */
export async function POST(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const ids = eventId ? [Number(eventId)].filter(Number.isFinite) : undefined;
  const result = await syncRacingResultsForEvents(ids);
  return NextResponse.json(result);
}
