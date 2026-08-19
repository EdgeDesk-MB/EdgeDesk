import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  confirmPendingTransaction,
  getBalanceSummary,
  listPendingTransactions,
} from "@/lib/services/balances";
import { db, accounts } from "@/lib/db";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const pending = listPendingTransactions();
  const acctName = new Map(
    db
      .select()
      .from(accounts)
      .all()
      .map((a) => [a.id, a.name] as const)
  );
  return NextResponse.json({
    pending: pending.map((t) => ({
      ...t,
      accountName: acctName.get(t.accountId) ?? `Account ${t.accountId}`,
    })),
  });
});

const confirmSchema = z.object({
  transactionId: z.number(),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ok = confirmPendingTransaction(parsed.data.transactionId);
  if (!ok) {
    return NextResponse.json({ error: "Pending transaction not found" }, { status: 404 });
  }
  return NextResponse.json(getBalanceSummary());
});
