import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, accounts } from "@/lib/db";
import { getAccountTransactions } from "@/lib/services/balances";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  brandColor: z.string().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const account = db.select().from(accounts).where(eq(accounts.id, Number(id))).get();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    account,
    transactions: getAccountTransactions(account.id),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const updated = db
    .update(accounts)
    .set({
      ...(p.name !== undefined ? { name: p.name.trim() } : {}),
      ...(p.isActive !== undefined ? { isActive: p.isActive ? 1 : 0 } : {}),
      ...(p.brandColor !== undefined ? { brandColor: p.brandColor } : {}),
    })
    .where(eq(accounts.id, Number(id)))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ account: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db.update(accounts).set({ isActive: 0 }).where(eq(accounts.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
