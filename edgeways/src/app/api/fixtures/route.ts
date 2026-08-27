import { NextRequest, NextResponse } from "next/server";
import {
  demoFixtures,
  fixturesByDate,
  hasApiKey,
  localCalendarDate,
} from "@/lib/services/apifootball";
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
  const date =
    req.nextUrl.searchParams.get("date") ?? localCalendarDate();

  // Guard before the demo fallback so unsigned hosted callers get 403, not
  // free demo fixtures. Callers tolerate `{ fixtures: [] }` and paint empty.
  const locked = await lockedFeedResponse("calculators", {
    source: "locked",
    fixtures: [],
    date,
  });
  if (locked) return locked;

  if (!hasApiKey()) {
    return NextResponse.json({ source: "demo", fixtures: demoFixtures() });
  }

  try {
    const fixtures = await fixturesByDate(date);
    return NextResponse.json({ source: "feed", fixtures, date });
  } catch (error) {
    // Free tier often returns HTTP 200 + errors.requests when capped -
    // fall back to demo so Fixtures / EP Desk handoff still works.
    // D8: warnings are client-facing, so never name the data provider.
    if (isRateLimitError(error)) {
      return NextResponse.json({
        source: "demo",
        fixtures: demoFixtures(),
        date,
        warning:
          "Football fixtures are temporarily using sample data. Live scores will return shortly.",
      });
    }
    console.error("[fixtures] football feed failed:", error);
    return NextResponse.json(
      {
        source: "demo",
        fixtures: demoFixtures(),
        date,
        warning: "Football fixtures are temporarily using sample data.",
      },
      { status: 200 }
    );
  }
});
