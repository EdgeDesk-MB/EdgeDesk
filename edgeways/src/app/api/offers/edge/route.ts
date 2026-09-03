import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { publicDemoOfferEdge } from "@/lib/demo/public-racing-desk";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { verifyPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";
import { getRacingDesk } from "@/lib/services/racing-desk";
import { getDeskActor } from "@/lib/db/desk-scope";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

/**
 * Offer Edge plays for every active racing offer on a date.
 *
 * A thin projection of the Racing Desk payload: the offer surfaces only need the
 * ranked plays, not the full racecards. Edge-tier only (EDGE-22) — the client
 * hides the panel, this is the server-side guard behind it.
 */
export const GET = withDeskScope(async function GET(req: NextRequest) {
  // Aliased Neon id, not the raw Clerk id (see api/racing/desk).
  const clerkUserId = getDeskActor().neonClerkUserId || getDeskActor().clerkUserId;
  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (
    await verifyPublicDemoCookieValue(
      (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value
    )
  ) {
    return NextResponse.json(publicDemoOfferEdge(date));
  }
  const denied = await lockedFeedResponse("offer_edge", {
    date,
    plays: [],
    source: "locked",
  });
  if (denied) return denied;
  const { edgePlays, summary } = await getRacingDesk(date, { clerkUserId });
  return NextResponse.json({ date, plays: edgePlays, source: summary.source });
});
