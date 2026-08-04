import { NextRequest, NextResponse } from "next/server";
import {
  demoFixtures,
  fixturesByDate,
  hasApiKey,
  localCalendarDate,
} from "@/lib/services/apifootball";

export const dynamic = "force-dynamic";

function isRateLimitError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("request limit") ||
    msg.includes("budget exhausted") ||
    msg.includes("rate limit")
  );
}

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? localCalendarDate();

  if (!hasApiKey()) {
    return NextResponse.json({ source: "demo", fixtures: demoFixtures() });
  }

  try {
    const fixtures = await fixturesByDate(date);
    return NextResponse.json({ source: "api-football", fixtures, date });
  } catch (error) {
    // Free tier often returns HTTP 200 + errors.requests when capped -
    // fall back to demo so Fixtures / EP Desk handoff still works.
    if (isRateLimitError(error)) {
      return NextResponse.json({
        source: "demo",
        fixtures: demoFixtures(),
        date,
        warning:
          "API-Football daily request limit reached - showing demo fixtures until the quota resets.",
      });
    }
    return NextResponse.json(
      {
        source: "demo",
        fixtures: demoFixtures(),
        date,
        warning: `API-Football unavailable (${String(error)}) - showing demo fixtures.`,
      },
      { status: 200 }
    );
  }
}
