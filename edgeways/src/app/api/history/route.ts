import { NextResponse } from "next/server";
import type { EventRow } from "@/lib/db/schema";
import {
  buildHistoryContext,
  isDeskCampaignLayHistoryEntry,
  matchesHistoryFilter,
  sortHistoryEntries,
  type HistoryFilter,
} from "@/lib/history-display";
import { dedupeHistoryForDisplay, getHistoryFeed } from "@/lib/services/history-feed";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonDeskOffers } from "@/lib/db/neon-desk-offers";
import { listNeonDeskHistory } from "@/lib/db/neon-desk-history";
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
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);

  if (isNeonDesk()) {
    const hosted = await getHostedHistoryFeed(limit, filter);
    return NextResponse.json({ ...hosted, filter });
  }

  const feed = getHistoryFeed({ limit, filter });

  return NextResponse.json({
    entries: feed.entries,
    events: feed.events,
    bets: feed.bets,
    promoAwards: feed.promoAwards,
    offerTitles: feed.offerTitles,
    filter,
  });
});

/** Hosted feed: same display pipeline over Neon rows (no events yet). */
async function getHostedHistoryFeed(limit: number, filter: HistoryFilter) {
  const [rows, betRows, offerRows] = await Promise.all([
    listNeonDeskHistory(limit * 2),
    listNeonDeskBets(),
    listNeonDeskOffers(),
  ]);
  const events: EventRow[] = [];
  const promoAwards: Record<number, { amount: number; reason: string }> = {};
  const offerTitles = offerRows.map((o) => ({ id: o.id, title: o.title }));

  const raw = dedupeHistoryForDisplay(rows, events);
  const context = buildHistoryContext(events, betRows, promoAwards, offerTitles, raw);
  let entries = sortHistoryEntries(raw, context).filter(
    (e) => !isDeskCampaignLayHistoryEntry(e, context)
  );
  if (filter !== "all") {
    entries = entries.filter((e) => matchesHistoryFilter(e, filter, context));
  }
  entries = entries.slice(0, limit);

  return { entries, events, bets: betRows, promoAwards, offerTitles };
}
