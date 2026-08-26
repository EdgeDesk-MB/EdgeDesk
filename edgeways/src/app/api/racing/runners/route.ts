import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { localCalendarDate } from "@/lib/events";
import { parseRacecardRunners } from "@/lib/racing";
import { titleCaseHorse } from "@/lib/racing/parse-race-result-text";
import { sortRunnerNamesByOdds } from "@/lib/racing/odds";
import { isFeedDenied } from "@/lib/entitlements/feed-guard";
import { getDeskOrderedRunnerNames } from "@/lib/services/racing-desk";
import { demoRacecards, hasRacingApiKey, racecardsFree } from "@/lib/services/theracingapi";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

function formatNames(names: string[]): string[] {
  return names.map((r) => titleCaseHorse(r)).filter(Boolean);
}

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const eventIdRaw = req.nextUrl.searchParams.get("eventId");
  const externalIdParam = req.nextUrl.searchParams.get("externalId")?.trim() || null;
  const dateParam = req.nextUrl.searchParams.get("date")?.trim() || null;

  const eventId = eventIdRaw != null ? Number(eventIdRaw) : NaN;
  const hasEventId = Number.isFinite(eventId) && eventId > 0;

  if (!hasEventId && !externalIdParam) {
    return NextResponse.json({ error: "eventId or externalId required" }, { status: 400 });
  }

  const event = hasEventId
    ? db.select().from(events).where(eq(events.id, eventId)).get()
    : null;
  if (hasEventId && !event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const externalId = externalIdParam || event?.externalId || null;
  const date =
    dateParam ||
    (event?.startTime != null
      ? localCalendarDate(new Date(event.startTime))
      : localCalendarDate());

  const feedLocked = await isFeedDenied("racing_live_feeds");

  // Prefer Racing Desk enrichment (live exchange / bookie) so order matches the desk.
  if (!feedLocked && (externalId || hasEventId)) {
    try {
      const deskOrdered = await getDeskOrderedRunnerNames({
        date,
        externalId,
        trackedEventId: hasEventId ? eventId : null,
      });
      if (deskOrdered && deskOrdered.length > 0) {
        return NextResponse.json({
          eventId: hasEventId ? eventId : null,
          externalId,
          runners: formatNames(deskOrdered),
        });
      }
    } catch {
      /* fall through to racecard / stored card */
    }
  }

  let runners = formatNames(parseRacecardRunners(event?.goals));

  if (!feedLocked && externalId) {
    const cards = hasRacingApiKey()
      ? [...(await racecardsFree("today")), ...(await racecardsFree("tomorrow"))]
      : demoRacecards();
    const card = cards.find((c) => c.externalId === externalId);
    if (card?.runnerDetails?.length) {
      runners = formatNames(sortRunnerNamesByOdds(card.runnerDetails));
    } else if (runners.length === 0 && card?.runners.length) {
      runners = formatNames(card.runners);
    }
  }

  return NextResponse.json({
    eventId: hasEventId ? eventId : null,
    externalId,
    runners,
  });
});
