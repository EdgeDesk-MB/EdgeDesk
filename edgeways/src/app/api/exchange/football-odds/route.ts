import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { ALL_FOOTBALL_ODDS_MISSING } from "@/lib/services/exchange/football-odds-map";
import { fetchBetfairFootballOdds } from "@/lib/services/exchange/football-odds";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const home = req.nextUrl.searchParams.get("home")?.trim() ?? "";
  const away = req.nextUrl.searchParams.get("away")?.trim() ?? "";
  const startRaw = req.nextUrl.searchParams.get("start");
  const startTime = startRaw ? Number(startRaw) : undefined;

  if (!home || !away) {
    return NextResponse.json({ error: "home and away are required" }, { status: 400 });
  }

  if ((await cookies()).get(PUBLIC_DEMO_COOKIE)?.value === "1") {
    return NextResponse.json({
      status: "unmatched",
      odds: {},
      missing: ALL_FOOTBALL_ODDS_MISSING,
      error: "Betfair prices are not available on the public demo.",
    });
  }

  const denied = await lockedFeedResponse("exchange_lay", {
    source: "locked",
    status: "unmatched",
    odds: {},
    missing: ALL_FOOTBALL_ODDS_MISSING,
    error: "Live exchange prices sit on Edge.",
  });
  if (denied) return denied;

  const result = await fetchBetfairFootballOdds({
    homeTeam: home,
    awayTeam: away,
    startTime: startTime != null && Number.isFinite(startTime) ? startTime : undefined,
    matchOddsOnly: req.nextUrl.searchParams.get("matchOddsOnly") === "1",
  });
  return NextResponse.json(result);
});
