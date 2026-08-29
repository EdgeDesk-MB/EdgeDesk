import { NextRequest, NextResponse } from "next/server";
import { db, accounts, bets, offers } from "@/lib/db";
import { bookieNamesForOwner } from "@/lib/accounts/owners";
import { getAppSettings } from "@/lib/services/settings";
import { getAllSnapshots } from "@/lib/services/ev-snapshot";
import { listNeonAllSnapshots } from "@/lib/db/neon-desk-ev-snapshots";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import {
  buildEdgeReport,
  monthsWithSettledCampaigns,
} from "@/lib/report/edge-report";
import { buildSeasonReport, seasonYears } from "@/lib/report/season-report";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { deniedFeatureResponse } from "@/lib/entitlements/feed-guard";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonDeskAccounts } from "@/lib/db/neon-desk-accounts";
import { listNeonDeskOffers } from "@/lib/db/neon-desk-offers";
import { getNeonDeskSettings } from "@/lib/db/neon-desk-settings";
import type { AccountRow, BetRow, OfferRow } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const denied = await deniedFeatureResponse("do_next");
  if (denied) return denied;
  const hosted = isNeonDesk();
  let snapshots = (
    hosted ? await listNeonAllSnapshots() : getAllSnapshots()
  ) as EvSnapshotRow[];
  const [accountRows, betRows, offerRows]: [AccountRow[], BetRow[], OfferRow[]] = hosted
    ? await Promise.all([listNeonDeskAccounts(), listNeonDeskBets(), listNeonDeskOffers()])
    : [
        db.select().from(accounts).all(),
        db.select().from(bets).all(),
        db.select().from(offers).all(),
      ];

  // J8: ?owner= scopes both inputs through the bookmaker→account mapping.
  const owner = req.nextUrl.searchParams.get("owner");
  const ownerScope = owner ? bookieNamesForOwner(accountRows, owner) : null;
  const scopeBets = (rows: BetRow[]) =>
    ownerScope
      ? rows.filter((b) => b.bookmaker && ownerScope.has(b.bookmaker.trim().toLowerCase()))
      : rows;
  if (ownerScope) {
    const offerOk = new Set(
      offerRows
        .filter((o) => o.bookmaker && ownerScope.has(o.bookmaker.trim().toLowerCase()))
        .map((o) => o.id)
    );
    snapshots = snapshots.filter((s) => offerOk.has(s.offerId));
  }

  const minCampaigns = hosted
    ? (await getNeonDeskSettings()).tuning.edgeReportMinCampaigns
    : getAppSettings().tuning.edgeReportMinCampaigns;

  // G3: season (year) view
  if (req.nextUrl.searchParams.get("view") === "year") {
    const allBets = scopeBets(betRows);
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

  const allBets = scopeBets(betRows);
  const report = buildEdgeReport({
    snapshots,
    bets: allBets,
    month,
    minCampaigns,
  });
  return NextResponse.json({ months, report });
});
