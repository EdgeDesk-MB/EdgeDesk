import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, events } from "@/lib/db";
import { parseRacecardRunners } from "@/lib/racing";
import { demoRacecards, hasRacingApiKey, racecardsFree } from "@/lib/services/theracingapi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = db.select().from(events).where(eq(events.id, eventId)).get();
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let runners = parseRacecardRunners(event.goals);

  if (runners.length === 0 && event.externalId) {
    const cards = hasRacingApiKey()
      ? [...(await racecardsFree("today")), ...(await racecardsFree("tomorrow"))]
      : demoRacecards();
    const card = cards.find((c) => c.externalId === event.externalId);
    if (card?.runners.length) runners = card.runners;
  }

  return NextResponse.json({ eventId, runners });
}
