import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { recordManualTransaction, getBalanceSummary } from "@/lib/services/balances";
import { balanceSummaryFromRows } from "@/lib/services/balance-summary";
import { db, accounts } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import {
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
  recordNeonManualTransaction,
} from "@/lib/db/neon-desk-accounts";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const txSchema = z.object({
  entries: z
    .array(
      z.object({
        accountId: z.number(),
        amount: z.number(),
        category: z.enum(["top_up", "withdrawal", "adjustment", "free_bet"]),
        note: z.string().optional(),
        affectPnl: z.boolean().optional(),
      })
    )
    .min(1),
});

async function neonBalanceSummary() {
  const [accountRows, transactionRows, betRows] = await Promise.all([
    listNeonDeskAccounts(),
    listNeonDeskBalanceTransactions(),
    listNeonDeskBets(),
  ]);
  return balanceSummaryFromRows(accountRows, transactionRows, betRows);
}

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    return NextResponse.json(await neonBalanceSummary());
  }
  return NextResponse.json(getBalanceSummary());
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = txSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (isNeonDesk()) {
    try {
      const accountRows = await listNeonDeskAccounts();
      for (const entry of parsed.data.entries) {
        const account = accountRows.find((a) => a.id === entry.accountId);
        if (!account || !account.isActive) {
          return NextResponse.json(
            { error: `Account ${entry.accountId} not found` },
            { status: 400 }
          );
        }
        if (entry.amount === 0) continue;
        await recordNeonManualTransaction({
          account,
          amount: entry.amount,
          category: entry.category,
          note: entry.note,
          affectPnl: entry.affectPnl,
        });
      }
      return NextResponse.json(await neonBalanceSummary());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the balance.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  for (const entry of parsed.data.entries) {
    const account = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, entry.accountId))
      .get();
    if (!account || !account.isActive) {
      return NextResponse.json({ error: `Account ${entry.accountId} not found` }, { status: 400 });
    }
    if (entry.amount === 0) continue;
    recordManualTransaction(entry.accountId, entry.amount, entry.category, entry.note, {
      affectPnl: entry.affectPnl,
    });
  }

  return NextResponse.json(getBalanceSummary());
});
