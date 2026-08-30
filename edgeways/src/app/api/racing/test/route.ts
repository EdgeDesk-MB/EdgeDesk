import { NextResponse } from "next/server";
import {
  hasRacingApiKey,
  resultsToday,
} from "@/lib/services/theracingapi";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** Probe Racing API results access (Basic tier). */
export const GET = withDeskScope(async function GET() {
  const denied = await lockedFeedResponse("racing_live_feeds", {
    source: "locked",
    tier: "none" as const,
    resultCount: 0,
    message: "Available on Edge subscription.",
  });
  if (denied) return denied;

  if (!hasRacingApiKey()) {
    return NextResponse.json({
      tier: "none" as const,
      resultCount: 0,
      message: "RACING_API_USERNAME / RACING_API_PASSWORD not set",
    });
  }

  try {
    const { results, tier, tierBlocked } = await resultsToday();
    if (tierBlocked || tier === "free") {
      return NextResponse.json({
        tier: "free" as const,
        resultCount: 0,
        message: "Credentials work for racecards - Basic plan needed for /v1/results/today",
      });
    }
    return NextResponse.json({
      tier: "basic" as const,
      resultCount: results.size,
      message:
        results.size > 0
          ? `${results.size} finished race${results.size === 1 ? "" : "s"} in today's feed`
          : "Basic access OK - no results published yet today",
    });
  } catch (e) {
    return NextResponse.json(
      {
        tier: "none" as const,
        resultCount: 0,
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
});
