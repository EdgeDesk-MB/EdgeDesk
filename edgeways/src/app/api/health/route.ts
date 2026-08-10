import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { APP_VERSION } from "@/lib/app-version";

export const dynamic = "force-dynamic";

/**
 * Uptime probe (EDGE-48): db ping + version, no auth, no sensitive data.
 * 200 = app and database up; 503 = app up, database unreachable.
 */
export function GET() {
  const payload = {
    version: APP_VERSION,
    time: new Date().toISOString(),
  };
  try {
    db.all(sql`SELECT 1`);
    return NextResponse.json({ ok: true, db: "up", ...payload });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", ...payload },
      { status: 503 }
    );
  }
}
