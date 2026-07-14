import { NextRequest, NextResponse } from "next/server";
import { db, bets } from "@/lib/db";
import { getAppSettings } from "@/lib/services/settings";
import { getAllSnapshots } from "@/lib/services/ev-snapshot";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import {
  buildEdgeReport,
  monthsWithSettledCampaigns,
} from "@/lib/report/edge-report";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const snapshots = getAllSnapshots() as EvSnapshotRow[];
  const months = monthsWithSettledCampaigns(snapshots);
  const requested = req.nextUrl.searchParams.get("month");
  const month =
    requested && /^\d{4}-\d{2}$/.test(requested) ? requested : (months[0] ?? null);

  if (!month) {
    return NextResponse.json({ months: [], report: null });
  }

  const allBets = db.select().from(bets).all();
  const report = buildEdgeReport({
    snapshots,
    bets: allBets,
    month,
    minCampaigns: getAppSettings().tuning.edgeReportMinCampaigns,
  });
  return NextResponse.json({ months, report });
}
