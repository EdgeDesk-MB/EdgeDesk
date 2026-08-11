import { defineConfig } from "drizzle-kit";

/**
 * Hosted Postgres (Neon) migrations — EDGE-47.
 * Local SQLite continues to use bootstrap in src/lib/db/index.ts.
 *
 * Generate: npm run db:generate
 * Apply (when DATABASE_URL set): npx drizzle-kit migrate
 */
export default defineConfig({
  schema: "./src/lib/db/schema.pg.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/edgeways",
  },
  strict: true,
  verbose: true,
});
