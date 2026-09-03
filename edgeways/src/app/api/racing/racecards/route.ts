import { NextRequest, NextResponse } from "next/server";
import { localCalendarDate } from "@/lib/events";
import {
  demoRacecards,
  hasRacingApiKey,
  resultsToday,
} from "@/lib/services/theracingapi";
import { getRacecardsForDate } from "@/lib/services/racecard-store";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

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
    // Store-first: a persisted payload serves instantly and refreshes in the
    // background when stale, so an upstream 429 never blanks the desk once
    // the day has been fetched.
    const { cards: racecards, oddsTier } = await getRacecardsForDate(date);

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
    // D8: never name the data provider in a client-facing error.
    console.error("[racecards] racing feed failed:", error);
    return NextResponse.json(
      {
        source: "error",
        racecards: [],
        error: "Could not load racecards from the racing feed.",
      },
      { status: 502 }
    );
  }
});
