import { NextRequest, NextResponse } from "next/server";
import { localCalendarDate } from "@/lib/events";
import {
  demoRacecards,
  hasRacingApiKey,
  isRacingTierAccessError,
  racecardsByDate,
  racecardsFree,
  resultsToday,
  type RacingRacecard,
} from "@/lib/services/theracingapi";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

async function loadRacecardsForDate(date: string): Promise<{
  racecards: RacingRacecard[];
  oddsTier: "free" | "standard";
}> {
  try {
    const { cards, oddsTier } = await racecardsByDate(date);
    if (cards.length > 0) return { racecards: cards, oddsTier };
  } catch (error) {
    if (!isRacingTierAccessError(error)) throw error;
  }

  const today = localCalendarDate();
  const tomorrow = localCalendarDate(new Date(Date.now() + 86400000));
  if (date === today) return { racecards: await racecardsFree("today"), oddsTier: "free" };
  if (date === tomorrow) return { racecards: await racecardsFree("tomorrow"), oddsTier: "free" };
  return { racecards: [], oddsTier: "free" };
}

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? localCalendarDate();

  const denied = await lockedFeedResponse("racing_live_feeds", {
    source: "locked",
    racecards: [],
  });
  if (denied) return denied;

  if (!hasRacingApiKey()) {
    return NextResponse.json({ source: "demo", racecards: demoRacecards(date) });
  }

  try {
    const { racecards, oddsTier } = await loadRacecardsForDate(date);

    const { results } = await resultsToday();
    const enriched = racecards.map((card) => {
      const result = results.get(card.externalId);
      if (!result) return card;
      return {
        ...card,
        status: "finished" as const,
        winner: result.winner,
      };
    });

    return NextResponse.json({ source: "racing-api", oddsTier, racecards: enriched });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load racecards from The Racing API";
    return NextResponse.json(
      { source: "error", racecards: [], error: message },
      { status: 502 }
    );
  }
});
