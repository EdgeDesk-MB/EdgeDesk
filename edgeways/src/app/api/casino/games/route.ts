import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, casinoGames } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  listNeonDeskCasinoGames,
  seedNeonCasinoGamesIfEmpty,
  upsertNeonDeskCasinoGame,
} from "@/lib/db/neon-desk-casino";
import { SEED_GAMES } from "@/lib/casino/game-library";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** Seed once: reference rows land only when the library is empty, so user
 *  edits and deletions are never resurrected. */
function seedIfEmpty(): void {
  const existing = db.select({ id: casinoGames.id }).from(casinoGames).limit(1).all();
  if (existing.length > 0) return;
  const now = Date.now();
  for (const g of SEED_GAMES) {
    db.insert(casinoGames)
      .values({ name: g.name, provider: g.provider, rtp: g.rtp, source: "seed", updatedAt: now })
      .onConflictDoNothing()
      .run();
  }
}

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    await seedNeonCasinoGamesIfEmpty();
    return NextResponse.json({ games: await listNeonDeskCasinoGames() });
  }
  seedIfEmpty();
  // RTP order, highest first - the whole point of the library is "which
  // eligible game should I play", so lead with the answer everywhere it's
  // consumed, not alphabetically.
  const games = db.select().from(casinoGames).orderBy(desc(casinoGames.rtp)).all();
  return NextResponse.json({ games });
});

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  provider: z.string().max(120).nullable().optional(),
  /** Fraction 0-1 */
  rtp: z.number().min(0.5).max(1),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (isNeonDesk()) {
    const row = await upsertNeonDeskCasinoGame({
      name: input.name.trim(),
      provider: input.provider?.trim() || null,
      rtp: input.rtp,
    });
    return NextResponse.json({ game: row });
  }

  const row = db
    .insert(casinoGames)
    .values({
      name: input.name.trim(),
      provider: input.provider?.trim() || null,
      rtp: input.rtp,
      source: "user",
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: casinoGames.name,
      set: {
        provider: input.provider?.trim() || null,
        rtp: input.rtp,
        source: "user",
        updatedAt: Date.now(),
      },
    })
    .returning()
    .get();
  return NextResponse.json({ game: row });
});
