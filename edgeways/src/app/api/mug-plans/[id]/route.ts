import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, mugPlans } from "@/lib/db";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { blockHostedDeskMutation } from "@/lib/db/hosted-desk-guard";

export const dynamic = "force-dynamic";

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = blockHostedDeskMutation("Mug betting plans");
  if (blocked) return blocked;
  const { id } = await ctx.params;
  db.delete(mugPlans).where(eq(mugPlans.id, Number(id))).run();
  return NextResponse.json({ ok: true });
});
