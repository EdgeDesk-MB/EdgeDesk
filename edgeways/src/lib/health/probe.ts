/**
 * Uptime probe (EDGE-48). Hosted waitlist pings Neon. Local desk pings SQLite.
 * Dynamic import keeps better-sqlite3 off the Vercel health function.
 */
import { smokeNeonConnection } from "@/lib/db/neon";

export type HealthDbStatus = "up" | "down";

export function healthDatabaseKind(
  databaseUrl: string | undefined = process.env.DATABASE_URL
): "neon" | "sqlite" {
  return databaseUrl?.trim() ? "neon" : "sqlite";
}

export async function pingAppDatabase(): Promise<HealthDbStatus> {
  try {
    if (healthDatabaseKind() === "neon") {
      await smokeNeonConnection();
      return "up";
    }
    const { db } = await import("@/lib/db");
    const { sql } = await import("drizzle-orm");
    db.all(sql`SELECT 1`);
    return "up";
  } catch {
    return "down";
  }
}
