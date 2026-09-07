import { NextRequest, NextResponse } from "next/server";
import { feedHorizonDates } from "@/lib/events";
import {
  demoRacecards,
  hasRacingApiKey,
  resultsToday,
} from "@/lib/services/theracingapi";
import { getRacecardsForDate, getRacecardsForHorizon } from "@/lib/services/racecard-store";
import { withRacingCardResult } from "@/lib/events/racing-card-result";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const dates = dateParam ? [dateParam] : feedHorizonDates();
  const date = dates[0]!;

  const denied = await lockedFeedResponse("racing_live_feeds", {
    source: "locked",
    racecards: [],
    date,
    dates,
  });
  if (denied) return denied;

  if (!hasRacingApiKey()) {
    return NextResponse.json({
      source: "demo",
      racecards: dateParam
        ? demoRacecards(date)
        : dates.flatMap((day) => demoRacecards(day)),
      date,
      dates,
    });
  }

  try {
    // Store-first: a persisted payload serves instantly and refreshes in the
    // background when stale, so an upstream 429 never blanks the desk once
    // the day has been fetched. No date = today and tomorrow (API horizon).
    const { cards: racecards, oddsTier } = dateParam
      ? await getRacecardsForDate(date)
      : await getRacecardsForHorizon();

    const { results } = await resultsToday();
    const enriched = racecards.map((card) =>
      withRacingCardResult(card, results.get(card.externalId))
    );

    return NextResponse.json({
      source: "racing-api",
      oddsTier,
      racecards: enriched,
      date,
      dates,
    });
  } catch (error) {
    // D8: never name the data provider in a client-facing error.
    console.error("[racecards] racing feed failed:", error);
    return NextResponse.json(
      {
        source: "error",
        racecards: [],
        date,
        dates,
        error: "Could not load racecards from the racing feed.",
      },
      { status: 502 }
    );
  }
});
