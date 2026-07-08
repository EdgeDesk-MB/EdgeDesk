import { NextResponse } from "next/server";
import type { HistoryFilter } from "@/lib/history-display";
import { getHistoryFeed } from "@/lib/services/history-feed";
import { getAppState } from "@/lib/services/state";

const FILTERS: HistoryFilter[] = [
  "all",
  "bets",
  "placed",
  "settlements",
  "free_bets",
  "match_events",
  "racing",
];

export async function GET(req: Request) {
  await getAppState();

  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter") ?? "all";
  const filter = FILTERS.includes(filterParam as HistoryFilter)
    ? (filterParam as HistoryFilter)
    : "all";
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);

  const feed = getHistoryFeed({ limit, filter });

  return NextResponse.json({
    entries: feed.entries,
    events: feed.events,
    bets: feed.bets,
    promoAwards: feed.promoAwards,
    filter,
  });
}
