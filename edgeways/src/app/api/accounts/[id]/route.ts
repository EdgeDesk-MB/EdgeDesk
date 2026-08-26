import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, accounts } from "@/lib/db";
import { getAccountTransactions } from "@/lib/services/balances";
import { renameVenueAccount } from "@/lib/accounts/rename-venue";
import { listFreeBetLots } from "@/lib/accounts/free-bet-lots";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
  patchNeonDeskAccount,
  renameNeonDeskAccount,
} from "@/lib/db/neon-desk-accounts";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import {
  denyPublicDemoWrite,
  isPublicDemoRequest,
} from "@/lib/demo/public-demo-guard";
import { publicDemoApiGet } from "@/lib/demo/public-desk-api";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  brandColor: z.string().optional(),
  accessStatus: z.enum(["available", "gubbed", "closed"]).optional(),
  owner: z.string().min(1).max(60).optional(),
  notes: z.string().nullable().optional(),
  fundedByAccountId: z.number().nullable().optional(),
  wrRemaining: z.number().min(0).optional(),
  wrMinOdds: z.number().nullable().optional(),
  wrType: z.enum(["stake", "risk_win"]).optional(),
  /** B9 manual health flag - only "cooling" is stored; null = healthy */
  health: z.enum(["cooling"]).nullable().optional(),
});

function patchFields(p: z.infer<typeof patchSchema>) {
  return {
    ...(p.isActive !== undefined ? { isActive: p.isActive ? 1 : 0 } : {}),
    ...(p.brandColor !== undefined ? { brandColor: p.brandColor } : {}),
    ...(p.accessStatus !== undefined ? { accessStatus: p.accessStatus } : {}),
    ...(p.owner !== undefined ? { owner: p.owner.trim() || "me" } : {}),
    ...(p.notes !== undefined ? { notes: p.notes } : {}),
    ...(p.fundedByAccountId !== undefined
      ? { fundedByAccountId: p.fundedByAccountId }
      : {}),
    ...(p.wrRemaining !== undefined ? { wrRemaining: p.wrRemaining } : {}),
    ...(p.wrMinOdds !== undefined
      ? { wrMinOdds: p.wrMinOdds != null && p.wrMinOdds > 1 ? p.wrMinOdds : null }
      : {}),
    ...(p.wrType !== undefined ? { wrType: p.wrType } : {}),
    ...(p.health !== undefined
      ? { health: p.health, healthUpdatedAt: Date.now() }
      : {}),
  };
}

export const GET = withDeskScope(async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // EDGE-106: a demo session gets the canned account, never the live one.
  if (await isPublicDemoRequest()) {
    return NextResponse.json(publicDemoApiGet(`/api/accounts/${id}`));
  }

  if (isNeonDesk()) {
    const accountId = Number(id);
    const [accountRows, transactionRows] = await Promise.all([
      listNeonDeskAccounts(),
      listNeonDeskBalanceTransactions(),
    ]);
    const account = accountRows.find((a) => a.id === accountId);
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      account,
      transactions: transactionRows
        .filter((t) => t.accountId === accountId)
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
        .slice(0, 50),
      freeBetLots: [],
    });
  }

  const account = db.select().from(accounts).where(eq(accounts.id, Number(id))).get();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    account,
    transactions: getAccountTransactions(account.id),
    freeBetLots: account.type === "bookie" ? listFreeBetLots(account.id) : [],
  });
});

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const accountId = Number(id);

  if (isNeonDesk()) {
    try {
      if (p.fundedByAccountId != null) {
        const accountRows = await listNeonDeskAccounts();
        const bank = accountRows.find((a) => a.id === p.fundedByAccountId);
        if (!bank || bank.type !== "bank") {
          return NextResponse.json({ error: "fundedBy must be a bank account" }, { status: 400 });
        }
      }
      if (p.name !== undefined) {
        const renamed = await renameNeonDeskAccount(accountId, p.name);
        if (!renamed.account) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const extra = patchFields(p);
        if (Object.keys(extra).length > 0) {
          const updated = await patchNeonDeskAccount(accountId, extra);
          return NextResponse.json({
            account: updated ?? renamed.account,
            rename: { betsUpdated: renamed.betsUpdated, offersUpdated: renamed.offersUpdated },
          });
        }
        return NextResponse.json({
          account: renamed.account,
          rename: { betsUpdated: renamed.betsUpdated, offersUpdated: renamed.offersUpdated },
        });
      }
      const updated = await patchNeonDeskAccount(accountId, patchFields(p));
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ account: updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the account.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (p.fundedByAccountId != null) {
    const bank = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, p.fundedByAccountId))
      .get();
    if (!bank || bank.type !== "bank") {
      return NextResponse.json({ error: "fundedBy must be a bank account" }, { status: 400 });
    }
  }

  if (p.name !== undefined) {
    try {
      const renamed = renameVenueAccount(accountId, p.name);
      const extra = patchFields(p);
      if (Object.keys(extra).length > 0) {
        const updated = db
          .update(accounts)
          .set(extra)
          .where(eq(accounts.id, accountId))
          .returning()
          .get();
        return NextResponse.json({
          account: updated ?? renamed.account,
          rename: {
            betsUpdated: renamed.betsUpdated,
            offersUpdated: renamed.offersUpdated,
            prefsUpdated: renamed.prefsUpdated,
          },
        });
      }
      return NextResponse.json({
        account: renamed.account,
        rename: {
          betsUpdated: renamed.betsUpdated,
          offersUpdated: renamed.offersUpdated,
          prefsUpdated: renamed.prefsUpdated,
        },
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
  }

  const updated = db
    .update(accounts)
    .set(patchFields(p))
    .where(eq(accounts.id, accountId))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ account: updated });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const { id } = await ctx.params;
  if (isNeonDesk()) {
    const updated = await patchNeonDeskAccount(Number(id), { isActive: 0 });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  db.update(accounts).set({ isActive: 0 }).where(eq(accounts.id, Number(id))).run();
  return NextResponse.json({ ok: true });
});
