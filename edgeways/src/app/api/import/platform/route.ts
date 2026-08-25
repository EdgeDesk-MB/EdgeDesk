import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db, bets } from "@/lib/db";
import { roundPence } from "@/lib/calc/money";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  insertNeonDeskBet,
  listNeonDeskImportFingerprints,
} from "@/lib/db/neon-desk";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  label: z.string().min(1).max(200),
  selection: z.string().max(200).optional().default(""),
  bookmaker: z.string().max(100).nullable(),
  betType: z.enum([
    "qualifying",
    "free_snr",
    "free_sr",
    "risk_free",
    "back_only",
    "dutch",
    "boost",
  ]),
  purpose: z.enum(["mug"]).nullable().optional(),
  market: z.string().max(40).optional(),
  sport: z.string().max(40).nullable().optional(),
  expectedProfit: z.number().min(-1_000_000).max(1_000_000).nullable().optional(),
  actualProfit: z.number().min(-1_000_000).max(1_000_000),
  status: z.enum(["won", "lost", "void"]),
  createdAt: z.number().int().positive(),
  settledAt: z.number().int().positive(),
  notes: z.string().max(2000).nullable().optional(),
  fingerprint: z.string().min(1).max(200),
  importMeta: z.string().max(4000).optional(),
});

const bodySchema = z.object({
  drafts: z.array(draftSchema).min(1).max(200),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (isNeonDesk()) {
    const seen = await listNeonDeskImportFingerprints();
    let inserted = 0;
    let skipped = 0;
    for (const draft of parsed.data.drafts) {
      if (seen.has(draft.fingerprint)) {
        skipped++;
        continue;
      }
      await insertNeonDeskBet({
        label: draft.label,
        market: draft.market || "win",
        selection: draft.selection ?? "",
        betType: draft.betType,
        purpose: draft.purpose ?? null,
        bookmaker: draft.bookmaker ?? undefined,
        sport: draft.sport ?? null,
        backStake: 0,
        backOdds: 0,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        earlyPayout: 0,
        status: draft.status,
        expectedProfit:
          draft.expectedProfit == null ? undefined : roundPence(draft.expectedProfit),
        actualProfit: roundPence(draft.actualProfit),
        notes: draft.notes ?? undefined,
        balanceLedgered: 1,
        balanceSettled: 1,
        createdAt: draft.createdAt,
        settledAt: draft.settledAt,
        source: "import",
        importFingerprint: draft.fingerprint,
        importMeta: draft.importMeta ?? null,
      });
      seen.add(draft.fingerprint);
      inserted++;
    }
    return NextResponse.json({ inserted, skipped });
  }

  const fingerprints = parsed.data.drafts.map((row) => row.fingerprint);
  const existing = db
    .select({ fingerprint: bets.importFingerprint })
    .from(bets)
    .where(inArray(bets.importFingerprint, fingerprints))
    .all();
  const seen = new Set(
    existing.map((row) => row.fingerprint).filter((value): value is string => Boolean(value))
  );

  let inserted = 0;
  let skipped = 0;
  for (const draft of parsed.data.drafts) {
    if (seen.has(draft.fingerprint)) {
      skipped++;
      continue;
    }
    db.insert(bets)
      .values({
        label: draft.label,
        market: draft.market || "win",
        selection: draft.selection ?? "",
        betType: draft.betType,
        purpose: draft.purpose ?? null,
        bookmaker: draft.bookmaker,
        sport: draft.sport ?? null,
        backStake: 0,
        backOdds: 0,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: draft.status,
        expectedProfit:
          draft.expectedProfit == null ? null : roundPence(draft.expectedProfit),
        actualProfit: roundPence(draft.actualProfit),
        notes: draft.notes ?? null,
        balanceLedgered: 1,
        balanceSettled: 1,
        createdAt: draft.createdAt,
        settledAt: draft.settledAt,
        source: "import",
        importFingerprint: draft.fingerprint,
        importMeta: draft.importMeta ?? null,
      })
      .run();
    seen.add(draft.fingerprint);
    inserted++;
  }

  return NextResponse.json({ inserted, skipped });
});
