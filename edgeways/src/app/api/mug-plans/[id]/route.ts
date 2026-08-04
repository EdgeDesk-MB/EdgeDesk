import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, mugPlans } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db.delete(mugPlans).where(eq(mugPlans.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
