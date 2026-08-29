import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, exchanges } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { neonExchangeExists } from "@/lib/db/neon-desk-accounts";
import {
  listNeonDeskExchanges,
  setNeonDeskDefaultExchange,
  upsertNeonDeskExchangeRate,
} from "@/lib/db/neon-desk-exchange-rates";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  commissionPct: z.number().min(0).max(20).optional(),
  brandColor: z.string().optional(),
  backColor: z.string().optional(),
  layColor: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = withDeskScope(async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const exchangeId = Number(id);

  if (isNeonDesk()) {
    try {
      if (!(await neonExchangeExists(exchangeId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (p.commissionPct !== undefined) {
        await upsertNeonDeskExchangeRate(exchangeId, p.commissionPct);
      }
      if (p.isDefault) {
        await setNeonDeskDefaultExchange(exchangeId);
      }
      const rows = await listNeonDeskExchanges();
      const updated = rows.find((row) => row.id === exchangeId);
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ exchange: updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the exchange.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (p.isDefault) {
    db.update(exchanges).set({ isDefault: 0 }).run();
  }
  const updated = db
    .update(exchanges)
    .set({
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.commissionPct !== undefined ? { commissionPct: p.commissionPct } : {}),
      ...(p.brandColor !== undefined ? { brandColor: p.brandColor } : {}),
      ...(p.backColor !== undefined ? { backColor: p.backColor } : {}),
      ...(p.layColor !== undefined ? { layColor: p.layColor } : {}),
      ...(p.isDefault !== undefined ? { isDefault: p.isDefault ? 1 : 0 } : {}),
    })
    .where(eq(exchanges.id, exchangeId))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ exchange: updated });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (isNeonDesk()) {
    return NextResponse.json(
      { error: "Removing a shared exchange is not available on the hosted desk." },
      { status: 400 }
    );
  }
  db.delete(exchanges).where(eq(exchanges.id, Number(id))).run();
  return NextResponse.json({ ok: true });
});
