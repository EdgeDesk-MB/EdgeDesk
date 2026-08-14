# Hosted Postgres (Neon) — EDGE-47 tonight slice
#
# Local Mac: SQLite via src/lib/db/index.ts (unchanged).
# Hosted: schema.pg.ts + drizzle/ migrations + neon.ts client.
# Waitlist (`waitlist_signups`) and Clerk-keyed accounts (`app_users`) use Neon
# when DATABASE_URL is set. Desk getDb() stays SQLite until the async cutover.
#
# Next session: async getDb() cutover, migrate hot paths, deploy-step migrate.
#
# Commands:
#   npm run db:generate     — regenerate SQL from schema.pg.ts
#   npm run db:neon-smoke   — SELECT 1 against DATABASE_URL
#   npx drizzle-kit migrate — apply migrations (needs DATABASE_URL)
