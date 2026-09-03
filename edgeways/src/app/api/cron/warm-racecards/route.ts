import { NextResponse } from "next/server";
import { warmRacecardStore } from "@/lib/services/racecard-store";

export const dynamic = "force-dynamic";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Keep the durable racecard store fresh for today and tomorrow so desk loads
 * are database reads, not upstream fetches. The store's own freshness window
 * makes most runs a cheap no-op.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const result = await warmRacecardStore();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/warm-racecards] warm failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
