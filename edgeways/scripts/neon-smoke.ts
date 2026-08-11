/**
 * Neon connection smoke test (EDGE-47).
 * Usage: npm run db:neon-smoke  (loads .env.local)
 *    or: DATABASE_URL=... npx tsx scripts/neon-smoke.ts
 *
 * Speaks to Neon directly (does not import server-only modules).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL missing. Add Neon pooled URL to .env.local, then re-run.",
    );
    process.exit(1);
  }

  const sql = neon(url);
  const rows = await sql`SELECT 1::int AS n`;
  const n = Number(rows[0]?.n);
  if (n !== 1) {
    throw new Error(`Unexpected smoke result: ${JSON.stringify(rows)}`);
  }
  console.log("Neon smoke OK:", { ok: true, result: n });
}

main().catch((err) => {
  console.error("Neon smoke failed:", err);
  process.exit(1);
});
