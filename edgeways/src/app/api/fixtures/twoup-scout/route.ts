import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { verifyPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";
import { localCalendarDate } from "@/lib/events";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { resolveTwoupScoutPreview } from "@/lib/entitlements/twoup-scout-preview";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { getTwoupScoutForDate, getTwoupScoutForFixture } from "@/lib/services/twoup-scout";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date")?.trim();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : localCalendarDate();

  const lockedBody = {
    source: "locked" as const,
    date,
    items: [] as const,
    error: "Available on Edge subscription.",
  };
  if (!(await resolveTwoupScoutPreview())) {
    return NextResponse.json(lockedBody, { status: 403 });
  }
  const denied = await lockedFeedResponse("twoup_scout", lockedBody);
  if (denied) return denied;

  if (
    await verifyPublicDemoCookieValue(
      (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value
    )
  ) {
    return NextResponse.json({ source: "demo", date, items: [] });
  }

  try {
    const home = req.nextUrl.searchParams.get("home")?.trim() ?? "";
    const away = req.nextUrl.searchParams.get("away")?.trim() ?? "";
    const start = Number(req.nextUrl.searchParams.get("start"));
    if (home && away && Number.isFinite(start)) {
      const item = await getTwoupScoutForFixture({
        homeTeam: home,
        awayTeam: away,
        startTime: start,
        competition: req.nextUrl.searchParams.get("competition"),
        leagueCountry: req.nextUrl.searchParams.get("country"),
      });
      return NextResponse.json({
        source: "store",
        date,
        items: item ? [item] : [],
      });
    }
    const items = await getTwoupScoutForDate(date);
    return NextResponse.json({ source: "store", date, items });
  } catch (error) {
    console.error("[twoup-scout] failed:", error);
    return NextResponse.json({ source: "error", date, items: [] }, { status: 200 });
  }
});
