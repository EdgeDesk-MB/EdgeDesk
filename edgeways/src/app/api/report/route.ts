import { NextRequest, NextResponse } from "next/server";
import { db, accounts, bets, offers } from "@/lib/db";
import { bookieNamesForOwner } from "@/lib/accounts/owners";
import { getAppSettings } from "@/lib/services/settings";
import { getAllSnapshots } from "@/lib/services/ev-snapshot";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import {
  buildEdgeReport,
  monthsWithSettledCampaigns,
} from "@/lib/report/edge-report";
import { buildSeasonReport, seasonYears } from "@/lib/report/season-report";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(req: NextRequest) {
  let snapshots = getAllSnapshots() as EvSnapshotRow[];

  // J8: ?owner= scopes both inputs through the bookmaker→account mapping.
  const owner = req.nextUrl.searchParams.get("owner");
  const ownerScope = owner
    ? bookieNamesForOwner(db.select().from(accounts).all(), owner)
    : null;
  const scopeBets = (rows: (typeof bets.$inferSelect)[]) =>
    ownerScope
      ? rows.filter((b) => b.bookmaker && ownerScope.has(b.bookmaker.trim().toLowerCase()))
      : rows;
  if (ownerScope) {
    const offerRows = db.select().from(offers).all();
    const offerOk = new Set(
      offerRows
        .filter((o) => o.bookmaker && ownerScope.has(o.bookmaker.trim().toLowerCase()))
        .map((o) => o.id)
    );
    snapshots = snapshots.filter((s) => offerOk.has(s.offerId));
  }

  // G3: season (year) view
  if (req.nextUrl.searchParams.get("view") === "year") {
    const allBets = scopeBets(db.select().from(bets).all());
    const years = seasonYears(snapshots, allBets);
    const requestedYear = Number(req.nextUrl.searchParams.get("year"));
    const year = years.includes(requestedYear) ? requestedYear : (years[0] ?? null);
    if (year == null) return NextResponse.json({ years: [], season: null });
    return NextResponse.json({
      years,
      season: buildSeasonReport({ snapshots, bets: allBets, year }),
    });
  }

  const months = monthsWithSettledCampaigns(snapshots);
  const requested = req.nextUrl.searchParams.get("month");
  const month =
    requested && /^\d{4}-\d{2}$/.test(requested) ? requested : (months[0] ?? null);

  if (!month) {
    return NextResponse.json({ months: [], report: null });
  }

  const allBets = scopeBets(db.select().from(bets).all());
  const report = buildEdgeReport({
    snapshots,
    bets: allBets,
    month,
    minCampaigns: getAppSettings().tuning.edgeReportMinCampaigns,
  });
  return NextResponse.json({ months, report });
});
