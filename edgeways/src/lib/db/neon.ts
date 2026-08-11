import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.pg";

/**
 * Thin Neon client for hosted Postgres (EDGE-47).
 * Not wired into app getDb() yet — local Mac stays on SQLite until async cutover.
 * Set DATABASE_URL to the Neon pooled connection string.
 */
export function getNeonSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon project and add the pooled connection string to .env.local.",
    );
  }
  return neon(url);
}

export function getNeonDb() {
  return drizzle(getNeonSql(), { schema });
}

/** Smoke: SELECT 1. Returns true on success. */
export async function smokeNeonConnection(): Promise<{
  ok: true;
  result: number;
}> {
  const sql = getNeonSql();
  const rows = await sql`SELECT 1::int AS n`;
  const n = Number(rows[0]?.n);
  if (n !== 1) {
    throw new Error(`Unexpected smoke result: ${JSON.stringify(rows)}`);
  }
  return { ok: true, result: n };
}
