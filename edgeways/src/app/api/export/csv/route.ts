import { NextRequest, NextResponse } from "next/server";
import { db, bets, balanceTransactions, accounts, casinoOffers, events, offers } from "@/lib/db";
import { formatEventTitle } from "@/lib/events";
import { MARKET_LABELS } from "@/lib/markets";
import { computeMonthlyBreakdown, computeAccountBreakdown } from "@/lib/pnl/monthly-breakdown";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvEscape).join(",");
}

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type") ?? "bets";

  if (type === "balances") {
    const accts = db.select().from(accounts).all();
    const txs = db.select().from(balanceTransactions).all();
    const acctName = new Map(accts.map((a) => [a.id, a.name]));
    const lines = [
      row(["Date", "Account", "Category", "Amount", "Note", "Bet ID"]),
      ...txs.map((t) =>
        row([
          new Date(t.createdAt).toISOString(),
          acctName.get(t.accountId) ?? t.accountId,
          t.category,
          t.amount.toFixed(2),
          t.note,
          t.betId,
        ])
      ),
    ];
    return csvResponse("edgeways-balances.csv", lines.join("\n"));
  }

  if (type === "monthly") {
    const allBets = db.select().from(bets).all();
    const casinoSettlements = db
      .select()
      .from(casinoOffers)
      .all()
      .filter((o) => o.status === "completed" && o.actualProfit != null)
      .map((o) => ({
        time: o.completedAt ?? o.createdAt,
        amount: o.actualProfit!,
        casino: o.casino,
      }));
    const monthly = computeMonthlyBreakdown(allBets, casinoSettlements);
    const byAccount = computeAccountBreakdown(allBets, casinoSettlements);
    const lines = [
      row(["Section", "Name", "Bets", "Profit"]),
      ...monthly.map((m) => row(["Month", m.label, m.betCount, m.profit.toFixed(2)])),
      ...byAccount.map((a) =>
        row(["Account", `${a.name} (${a.kind})`, a.betCount, a.profit.toFixed(2)])
      ),
    ];
    const stamp = new Date().toISOString().slice(0, 7);
    return csvResponse(`edgeways-monthly-pnl-${stamp}.csv`, lines.join("\n"));
  }

  if (type === "offers") {
    const allOffers = db.select().from(offers).all();
    const lines = [
      row([
        "ID",
        "Title",
        "Bookmaker",
        "Status",
        "Sport",
        "Expected",
        "Created",
        "Expires",
        "Completed",
      ]),
      ...allOffers.map((o) =>
        row([
          o.id,
          o.title,
          o.bookmaker,
          o.status,
          o.sport,
          o.expectedProfit?.toFixed(2),
          new Date(o.createdAt).toISOString(),
          o.expiresAt != null ? new Date(o.expiresAt).toISOString() : "",
          o.completedAt != null ? new Date(o.completedAt).toISOString() : "",
        ])
      ),
    ];
    return csvResponse("edgeways-offers.csv", lines.join("\n"));
  }

  const eventById = new Map(db.select().from(events).all().map((e) => [e.id, e]));
  const allBets = db.select().from(bets).all();

  const lines = [
    row([
      "ID",
      "Date",
      "Label",
      "Bookie",
      "Market",
      "Selection",
      "Type",
      "Back Stake",
      "Back Odds",
      "Lay Stake",
      "Lay Odds",
      "Expected",
      "Actual",
      "Status",
      "Event",
      "Offer ID",
    ]),
    ...allBets.map((b) => {
      const ev = b.eventId != null ? eventById.get(b.eventId) : undefined;
      return row([
        b.id,
        new Date(b.createdAt).toISOString(),
        b.label,
        b.bookmaker,
        MARKET_LABELS[b.market] ?? b.market,
        b.selection,
        b.betType,
        b.backStake.toFixed(2),
        b.backOdds.toFixed(2),
        b.layStake.toFixed(2),
        b.layOdds.toFixed(2),
        b.expectedProfit?.toFixed(2),
        b.actualProfit?.toFixed(2),
        b.status,
        ev ? formatEventTitle(ev) : "",
        b.offerId,
      ]);
    }),
  ];

  return csvResponse("edgeways-bets.csv", lines.join("\n"));
});
