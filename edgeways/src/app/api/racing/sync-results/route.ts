import { NextRequest, NextResponse } from "next/server";
import { syncRacingResultsForEvents } from "@/lib/services/sync-racing-results";

export const dynamic = "force-dynamic";

/**
 * Fetch racing results for tracked events.
 * - `?eventId=` - one race
 * - `?force=1` - overwrite existing / incomplete results (manual Fetch results)
 * - `?skipCache=1` - bypass 90s results cache
 */
export async function POST(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const force =
    req.nextUrl.searchParams.get("force") === "1" ||
    req.nextUrl.searchParams.get("force") === "true";
  const skipCache =
    force ||
    req.nextUrl.searchParams.get("skipCache") === "1" ||
    req.nextUrl.searchParams.get("skipCache") === "true";
  const ids = eventId ? [Number(eventId)].filter(Number.isFinite) : undefined;
  const result = await syncRacingResultsForEvents(ids, { force, skipCache });
  return NextResponse.json(result);
}
