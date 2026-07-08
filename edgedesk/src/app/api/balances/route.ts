import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { recordManualTransaction, getBalanceSummary } from "@/lib/services/balances";
import { db, accounts } from "@/lib/db";

export const dynamic = "force-dynamic";

const txSchema = z.object({
  entries: z
    .array(
      z.object({
        accountId: z.number(),
        amount: z.number(),
        category: z.enum(["top_up", "withdrawal", "adjustment", "free_bet"]),
        note: z.string().optional(),
      })
    )
    .min(1),
});

export async function GET() {
  return NextResponse.json(getBalanceSummary());
}

export async function POST(req: NextRequest) {
  const parsed = txSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
    recordManualTransaction(entry.accountId, entry.amount, entry.category, entry.note);
  }

  return NextResponse.json(getBalanceSummary());
}
