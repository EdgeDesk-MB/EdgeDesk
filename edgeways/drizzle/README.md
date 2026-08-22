# Hosted Postgres (Neon) — EDGE-47

Local Mac: SQLite via `src/lib/db/index.ts` (unchanged).
Hosted: `schema.pg.ts` + `drizzle/` migrations + `neon.ts` client.
Waitlist (`waitlist_signups`) and Clerk-keyed accounts (`app_users`) use Neon
when `DATABASE_URL` is set.

Desk bets use Neon only when `EDGEWAYS_DESK_BACKEND=neon` **and**
`DATABASE_URL` is set (Vercel Preview first). Localhost stays on the Mac file
even if `DATABASE_URL` is present for the waitlist.

Desk settings (including 18+ confirmation) live on `app_users.desk_settings`
when the hosted desk flag is on. Next: offers, wallets, history; restore drill.

Commands:
  npm run db:migrate      — apply drizzle/ to DATABASE_URL
  npm run db:neon-smoke   — SELECT 1 against DATABASE_URL
  npm run db:generate     — regenerate SQL from schema.pg.ts
