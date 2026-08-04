import { NextRequest, NextResponse } from "next/server";
import { getRacingDesk } from "@/lib/services/racing-desk";

export const dynamic = "force-dynamic";

/**
 * Offer Edge plays for every active racing offer on a date.
 *
 * A thin projection of the Racing Desk payload: the offer surfaces only need the
 * ranked plays, not the full racecards.
 */
export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const { edgePlays, summary } = await getRacingDesk(date);
  return NextResponse.json({ date, plays: edgePlays, source: summary.source });
}
