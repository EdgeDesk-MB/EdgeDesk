import { NextResponse } from "next/server";
import { warmFootballCompetitionCatalog } from "@/lib/services/football-competition-store";
import { warmFixtureStore } from "@/lib/services/fixture-store";
import { warmRacecardStore } from "@/lib/services/racecard-store";

export const dynamic = "force-dynamic";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Keep durable day-card stores fresh (racing + football) so desk loads are
 * database reads, not upstream fetches. Each store's freshness window makes
 * most runs a cheap no-op.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const [racing, football, competitions] = await Promise.all([
      warmRacecardStore(),
      warmFixtureStore(),
      warmFootballCompetitionCatalog(),
    ]);
    return NextResponse.json({ ok: true, racing, football, competitions });
  } catch (error) {
    console.error("[cron/warm-racecards] warm failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
