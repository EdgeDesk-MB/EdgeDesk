/**
 * Apply drizzle/ migrations to Neon (EDGE-47).
 * drizzle-kit migrate needs WebSockets for Neon — this script sets that up.
 *
 * Usage: npm run db:migrate
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

neonConfig.webSocketConstructor = ws;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL missing; skip migrate");
    process.exit(0);
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    console.log("Migrations applied OK");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migrate failed:", err);
  process.exit(1);
});
