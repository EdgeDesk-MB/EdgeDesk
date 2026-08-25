import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { publicDemoOfferEdge } from "@/lib/demo/public-racing-desk";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { getRacingDesk } from "@/lib/services/racing-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { resolveEntitlementBilling } from "@/lib/entitlements/resolve-billing";

export const dynamic = "force-dynamic";

/**
 * Offer Edge plays for every active racing offer on a date.
 *
 * A thin projection of the Racing Desk payload: the offer surfaces only need the
 * ranked plays, not the full racecards. Edge-tier only (EDGE-22) — the client
 * hides the panel, this is the server-side guard behind it.
 */
export const GET = withDeskScope(async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if ((await cookies()).get(PUBLIC_DEMO_COOKIE)?.value === "1") {
    return NextResponse.json(publicDemoOfferEdge(date));
  }
  const billing = await resolveEntitlementBilling();
  // Fail open when no billing row resolves (signed out / lookup blip) — the
  // desk gate already hides the feature; never 403 a paying user on a blip.
  if (billing && !canDesk({ billing }, "offer_edge")) {
    return NextResponse.json(
      { date, plays: [], source: "locked" },
      { status: 403 }
    );
  }
  const { edgePlays, summary } = await getRacingDesk(date);
  return NextResponse.json({ date, plays: edgePlays, source: summary.source });
});
