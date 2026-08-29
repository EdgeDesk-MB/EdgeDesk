import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  confirmPendingTransaction,
  getBalanceSummary,
  listPendingTransactions,
} from "@/lib/services/balances";
import { db, accounts } from "@/lib/db";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import {
  denyPublicDemoWrite,
  isPublicDemoRequest,
} from "@/lib/demo/public-demo-guard";
import { publicDemoApiGet } from "@/lib/demo/public-desk-api";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  confirmNeonPendingTransaction,
  listNeonDeskAccounts,
  listNeonPendingTransactions,
} from "@/lib/db/neon-desk-accounts";
import { getNeonDeskBalanceSummary } from "@/lib/db/neon-desk-balance-summary";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  if (await isPublicDemoRequest()) {
    return NextResponse.json(publicDemoApiGet("/api/accounts/pending"));
  }
  if (isNeonDesk()) {
    const [pending, accounts] = await Promise.all([
      listNeonPendingTransactions(),
      listNeonDeskAccounts(),
    ]);
    const acctName = new Map(accounts.map((a) => [a.id, a.name] as const));
    return NextResponse.json({
      pending: pending.map((t) => ({
        ...t,
        accountName: acctName.get(t.accountId) ?? `Account ${t.accountId}`,
      })),
    });
  }
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
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (isNeonDesk()) {
    try {
      const ok = await confirmNeonPendingTransaction(parsed.data.transactionId);
      if (!ok) {
        return NextResponse.json({ error: "Pending transaction not found" }, { status: 404 });
      }
      return NextResponse.json(await getNeonDeskBalanceSummary());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not confirm the transfer.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }
  const ok = confirmPendingTransaction(parsed.data.transactionId);
  if (!ok) {
    return NextResponse.json({ error: "Pending transaction not found" }, { status: 404 });
  }
  return NextResponse.json(getBalanceSummary());
});
