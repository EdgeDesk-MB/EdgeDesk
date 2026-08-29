import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, mugPlans } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { deleteNeonMugPlan } from "@/lib/db/neon-desk-mug-plans";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (isNeonDesk()) {
    const ok = await deleteNeonMugPlan(Number(id));
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  db.delete(mugPlans).where(eq(mugPlans.id, Number(id))).run();
  return NextResponse.json({ ok: true });
});
