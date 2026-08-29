import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, accounts, exchanges } from "@/lib/db";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { getBalanceSummary } from "@/lib/services/balances";
import { freeBetBalanceByAccountFromTransactions } from "@/lib/accounts/free-bet-lot-math";
import { balanceSummaryFromRows } from "@/lib/services/balance-summary";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import {
  insertNeonDeskAccount,
  insertNeonDeskTransaction,
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
  neonExchangeExists,
} from "@/lib/db/neon-desk-accounts";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import {
  denyPublicDemoWrite,
  isPublicDemoRequest,
} from "@/lib/demo/public-demo-guard";
import { publicDemoApiGet } from "@/lib/demo/public-desk-api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["bookie", "exchange", "bank"]),
  exchangeId: z.number().optional(),
  brandColor: z.string().optional(),
  openingBalance: z.number().default(0),
  fundedByAccountId: z.number().nullable().optional(),
});

export const GET = withDeskScope(async function GET() {
  // EDGE-106: a demo session gets the canned desk, never live balances.
  if (await isPublicDemoRequest()) {
    return NextResponse.json(publicDemoApiGet("/api/accounts"));
  }
  if (isNeonDesk()) {
    const [accountRows, transactionRows, betRows] = await Promise.all([
      listNeonDeskAccounts(),
      listNeonDeskBalanceTransactions(),
      listNeonDeskBets(),
    ]);
    return NextResponse.json(
      balanceSummaryFromRows(
        accountRows,
        transactionRows,
        betRows,
        freeBetBalanceByAccountFromTransactions(accountRows, transactionRows)
      )
    );
  }
  return NextResponse.json(getBalanceSummary());
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (isNeonDesk()) {
    if (input.type === "exchange" && input.exchangeId) {
      if (!(await neonExchangeExists(input.exchangeId))) {
        return NextResponse.json({ error: "Exchange not found" }, { status: 400 });
      }
    }
    const existing = await listNeonDeskAccounts();
    if (input.fundedByAccountId != null) {
      const bank = existing.find((a) => a.id === input.fundedByAccountId);
      if (!bank || bank.type !== "bank") {
        return NextResponse.json({ error: "fundedBy must be a bank account" }, { status: 400 });
      }
    }
    const dup = existing.find(
      (a) =>
        a.isActive === 1 &&
        a.name.toLowerCase() === input.name.trim().toLowerCase() &&
        a.type === input.type
    );
    if (dup) {
      return NextResponse.json({ error: "An account with this name already exists" }, { status: 409 });
    }
    try {
      const inserted = await insertNeonDeskAccount({
        name: input.name.trim(),
        type: input.type,
        exchangeId: input.type === "exchange" ? input.exchangeId : null,
        fundedByAccountId:
          input.type === "bookie" || input.type === "exchange"
            ? input.fundedByAccountId ?? null
            : null,
        brandColor:
          input.brandColor ??
          (input.type === "bookie"
            ? bookieBrandColor(input.name.trim())
            : input.type === "bank"
              ? "#1e3a5f"
              : null),
        isActive: 1,
        createdAt: Date.now(),
      });
      if (input.openingBalance !== 0) {
        await insertNeonDeskTransaction({
          accountId: inserted.id,
          amount: input.openingBalance,
          category: "top_up",
          note: "Opening balance",
          createdAt: Date.now(),
        });
      }
      return NextResponse.json({ account: inserted });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the account.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (input.type === "exchange" && input.exchangeId) {
    const ex = db.select().from(exchanges).where(eq(exchanges.id, input.exchangeId)).get();
    if (!ex) return NextResponse.json({ error: "Exchange not found" }, { status: 400 });
  }

  if (input.fundedByAccountId != null) {
    const bank = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.fundedByAccountId))
      .get();
    if (!bank || bank.type !== "bank") {
      return NextResponse.json({ error: "fundedBy must be a bank account" }, { status: 400 });
    }
  }

  const dup = db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .find(
      (a) =>
        a.name.toLowerCase() === input.name.trim().toLowerCase() &&
        a.type === input.type
    );
  if (dup) {
    return NextResponse.json({ error: "An account with this name already exists" }, { status: 409 });
  }

  const inserted = db
    .insert(accounts)
    .values({
      name: input.name.trim(),
      type: input.type,
      exchangeId: input.type === "exchange" ? input.exchangeId : null,
      fundedByAccountId:
        input.type === "bookie" || input.type === "exchange"
          ? input.fundedByAccountId ?? null
          : null,
      brandColor:
        input.brandColor ??
        (input.type === "bookie"
          ? bookieBrandColor(input.name.trim())
          : input.type === "bank"
            ? "#1e3a5f"
            : null),
      isActive: 1,
      createdAt: Date.now(),
    })
    .returning()
    .get();

  if (input.openingBalance !== 0) {
    const { recordManualTransaction } = await import("@/lib/services/balances");
    recordManualTransaction(
      inserted.id,
      input.openingBalance,
      "top_up",
      "Opening balance"
    );
  }

  return NextResponse.json({ account: inserted });
});
