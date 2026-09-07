import { NextRequest, NextResponse } from "next/server";
import { feedHorizonDates } from "@/lib/events";
import {
  demoCompetitions,
  demoFixtures,
  demoFixturesForHorizon,
  hasApiKey,
} from "@/lib/services/apifootball";
import { peekFootballCompetitionCatalog } from "@/lib/services/football-competition-store";
import { getFixturesForDate, getFixturesForHorizon } from "@/lib/services/fixture-store";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

function isRateLimitError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("request limit") ||
    msg.includes("budget exhausted") ||
    msg.includes("rate limit")
  );
}

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const dates = dateParam ? [dateParam] : feedHorizonDates();
  const date = dates[0]!;
  const demoList = dateParam ? demoFixtures() : demoFixturesForHorizon();

  // Guard before the demo fallback so unsigned hosted callers get 403, not
  // free demo fixtures. Callers tolerate `{ fixtures: [] }` and paint empty.
  const locked = await lockedFeedResponse("calculators", {
    source: "locked",
    fixtures: [],
    competitions: [],
    date,
    dates,
  });
  if (locked) return locked;

  if (!hasApiKey()) {
    return NextResponse.json({
      source: "demo",
      fixtures: demoList,
      competitions: demoCompetitions(),
      date,
      dates,
    });
  }

  try {
    const [{ fixtures }, competitions] = await Promise.all([
      dateParam
        ? getFixturesForDate(dateParam).then((row) => ({ fixtures: row.fixtures }))
        : getFixturesForHorizon(),
      peekFootballCompetitionCatalog(),
    ]);
    return NextResponse.json({ source: "feed", fixtures, competitions, date, dates });
  } catch (error) {
    // Free tier often returns HTTP 200 + errors.requests when capped -
    // fall back to demo so Fixtures / EP Desk handoff still works.
    // D8: warnings are client-facing, so never name the data provider.
    if (isRateLimitError(error)) {
      return NextResponse.json({
        source: "demo",
        fixtures: demoList,
        competitions: demoCompetitions(),
        date,
        dates,
        warning:
          "Football fixtures are temporarily using sample data. Live scores will return shortly.",
      });
    }
    console.error("[fixtures] football feed failed:", error);
    return NextResponse.json(
      {
        source: "demo",
        fixtures: demoList,
        competitions: demoCompetitions(),
        date,
        dates,
        warning: "Football fixtures are temporarily using sample data.",
      },
      { status: 200 }
    );
  }
});
