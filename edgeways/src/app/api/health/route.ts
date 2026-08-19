import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-version";
import { pingAppDatabase } from "@/lib/health/probe";

export const dynamic = "force-dynamic";

/**
 * Uptime probe (EDGE-48): db ping + version, no auth, no sensitive data.
 * 200 = app and database up; 503 = app up, database unreachable.
 */
export async function GET() {
  const payload = {
    version: APP_VERSION,
    time: new Date().toISOString(),
  };
  const db = await pingAppDatabase();
  if (db === "up") {
    return NextResponse.json({ ok: true, db, ...payload });
  }
  return NextResponse.json({ ok: false, db, ...payload }, { status: 503 });
}
