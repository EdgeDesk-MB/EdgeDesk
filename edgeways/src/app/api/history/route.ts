import { NextResponse } from "next/server";
import { isDeskCampaignLayHistoryEntry, type HistoryFilter } from "@/lib/history-display";
import { buildHistoryPage, parseHistoryPageLimit } from "@/lib/history-page";
import { dedupeHistoryForDisplay, getHistoryPage } from "@/lib/services/history-feed";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonDeskOfferTitles } from "@/lib/db/neon-desk-offers";
import { listNeonDeskHistory, syncNeonDeskEventHistory } from "@/lib/db/neon-desk-history";
import { listNeonEventsByIds } from "@/lib/db/neon-events";
import { listNeonDeskTrackedEventIds } from "@/lib/db/neon-desk-tracked-events";
import { deskVisibleEventIds } from "@/lib/events/desk-tracked-events";
import { withDeskScope } from "@/lib/db/with-desk-scope";

const FILTERS: HistoryFilter[] = [
  "all",
  "bets",
  "placed",
  "settlements",
  "casino",
  "free_bets",
  "match_events",
  "racing",
  "boosts",
];

export const GET = withDeskScope(async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter") ?? "all";
  const filter = FILTERS.includes(filterParam as HistoryFilter)
    ? (filterParam as HistoryFilter)
    : "all";
  const limit = parseHistoryPageLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor");

  if (isNeonDesk()) {
    return NextResponse.json(await getHostedHistoryPage({ filter, cursor, limit }));
  }
  return NextResponse.json(getHistoryPage({ filter, cursor, limit }));
});

/**
 * Hosted page: same pipeline over Neon rows. A fixed handful of queries per
 * request, whatever the desk size. Event commentary syncs on the first page only.
 */
async function getHostedHistoryPage(input: {
  filter: HistoryFilter;
  cursor: string | null;
  limit: number;
}) {
  const [initialRows, betRows, offerTitles, followedIds] = await Promise.all([
    listNeonDeskHistory(null),
    listNeonDeskBets(),
    listNeonDeskOfferTitles(),
    listNeonDeskTrackedEventIds().catch(() => []),
  ]);
  const events = await listNeonEventsByIds([...deskVisibleEventIds(followedIds, betRows)]).catch(
    () => []
  );
  let rows = initialRows;
  if (!input.cursor) {
    const written = await syncNeonDeskEventHistory(events, initialRows).catch(() => 0);
    if (written > 0) rows = await listNeonDeskHistory(null);
  }
  return buildHistoryPage({
    rows: dedupeHistoryForDisplay(rows, events),
    events,
    bets: betRows,
    promoAwards: {},
    offerTitles,
    filter: input.filter,
    cursor: input.cursor,
    limit: input.limit,
    isHidden: isDeskCampaignLayHistoryEntry,
  });
}
