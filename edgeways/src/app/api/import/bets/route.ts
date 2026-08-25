import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, bets } from "@/lib/db";
import { roundPence } from "@/lib/calc/money";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { insertNeonDeskBet } from "@/lib/db/neon-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  label: z.string().min(1).max(200),
  bookmaker: z.string().max(100).nullable(),
  betType: z.enum(["qualifying", "free_snr", "free_sr", "risk_free", "back_only"]),
  backStake: z.number().min(0).max(1_000_000),
  backOdds: z.number().min(0).max(10_000),
  actualProfit: z.number().min(-1_000_000).max(1_000_000),
  status: z.enum(["won", "lost", "void"]),
  createdAt: z.number().int().positive(),
  settledAt: z.number().int().positive(),
});

const bodySchema = z.object({ drafts: z.array(draftSchema).min(1).max(5000) });

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // History import: balance flags pre-set so settlement/ledger logic never
  // touches live balances; no offerId → no EV snapshots → the Edge Report's
  // capture data stays honest.
  if (isNeonDesk()) {
    let inserted = 0;
    for (const d of parsed.data.drafts) {
      await insertNeonDeskBet({
        label: d.label,
        market: "win",
        selection: "",
        betType: d.betType,
        bookmaker: d.bookmaker ?? undefined,
        backStake: roundPence(d.backStake),
        backOdds: d.backOdds,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        earlyPayout: 0,
        status: d.status,
        actualProfit: roundPence(d.actualProfit),
        balanceLedgered: 1,
        balanceSettled: 1,
        createdAt: d.createdAt,
        settledAt: d.settledAt,
        source: "import",
      });
      inserted++;
    }
    return NextResponse.json({ inserted });
  }

  const rows = parsed.data.drafts.map((d) => ({
    label: d.label,
    market: "win",
    selection: "",
    betType: d.betType,
    bookmaker: d.bookmaker,
    backStake: roundPence(d.backStake),
    backOdds: d.backOdds,
    layStake: 0,
    layOdds: 0,
    commission: 0,
    status: d.status,
    actualProfit: roundPence(d.actualProfit),
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: d.createdAt,
    settledAt: d.settledAt,
    source: "import",
  }));

  let inserted = 0;
  for (const row of rows) {
    db.insert(bets).values(row).run();
    inserted++;
  }

  return NextResponse.json({ inserted });
});
