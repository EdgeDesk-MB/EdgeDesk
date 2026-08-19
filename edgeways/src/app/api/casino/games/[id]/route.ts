import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, casinoGames } from "@/lib/db";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const DELETE = withDeskScope(async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gameId = Number(id);
  const existing = db.select().from(casinoGames).where(eq(casinoGames.id, gameId)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.delete(casinoGames).where(eq(casinoGames.id, gameId)).run();
  return NextResponse.json({ ok: true });
});
