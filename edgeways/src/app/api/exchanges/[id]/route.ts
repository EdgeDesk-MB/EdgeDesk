import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, exchanges } from "@/lib/db";
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
    .where(eq(exchanges.id, Number(id)))
    .returning()
    .get();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ exchange: updated });
});

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db.delete(exchanges).where(eq(exchanges.id, Number(id))).run();
  return NextResponse.json({ ok: true });
});
