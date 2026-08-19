# Hosting, database & environments — the infrastructure map

> 10 Aug 2026. The methodical companion to `live-readiness.md`: what runs
> where, which tools we need accounts for, and the go-live hygiene gates.
> PWA-first is confirmed; native apps are a later wrapper, not a rewrite.

## 1. Target shape

**The product is a PWA.** The app already ships a service worker
(`public/sw.js`), push notifications and install chrome — hosting it is
hosting a Next.js app over HTTPS. Nothing about Vercel/Neon changes for PWA;
the requirements (HTTPS, manifest, SW headers) are satisfied by default.

**Later native path (parked, zero throwaway):** Android via TWA (Trusted Web
Activity wraps the PWA at the same origin — Play Store listing, no new
codebase); iOS via Capacitor or PWABuilder wrapping the same PWA. Decision
point is post-launch; the only rule until then is don't build anything that
assumes a browser tab (e.g. keep push + auth flows PWA-compatible).

## 2. Environments

| | **Development** | **Staging** | **Live** |
|---|---|---|---|
| Where | This Mac, `npm run dev` | Vercel preview deployments | Vercel production |
| Database | Local SQLite (`data/edgeways.db`) | Neon **branch** of the live DB | Neon production branch |
| Analytics/errors | PostHog, filtered by `$host` | Same project, `$host` = preview URL | Same project, `$host` = edgeways.app |
| Trigger | Local edits | Every push/PR gets its own preview URL | Merge to `main` (or a `release` branch) |
| Purpose | Daily build | Sam clicks through before promoting | Customers |

Promotion flow: `main` → auto-deploys to production; any other branch →
preview. Vercel preview deployments can sit behind **Vercel Authentication**
(password) so staging is never publicly reachable.

Rules:
- **Never test against the live DB.** Drizzle migrations run on a Neon
  staging branch first; Neon branches are copy-on-write and instant.
- Env vars are per-environment in Vercel (Production / Preview /
  Development) — the same `NEXT_PUBLIC_POSTHOG_*` keys work everywhere
  because the proxy path (`/ingest`) is relative.

## 3. What Vercel does for us (and its limits)

**Gives us:** marketing site + app hosting from one repo; automatic preview
per push (our staging, free); production deploys on merge; per-environment
env vars; HTTPS + HTTP/2 + CDN; the `/ingest` PostHog reverse proxy works
unchanged (it's just `next.config.ts` rewrites); serverless API routes (our
existing `app/api/*` run as-is); Vercel Cron for the future feed-proxy pollers;
Web Analytics (leave off — PostHog covers it, don't double-track).

**Limits to design around:**
- Serverless functions have execution time limits — fine for API routes,
  but the **feed proxy's long pollers** (Betfair Stream API websockets
  especially) will eventually want a small always-on worker (Railway/Fly)
  rather than Vercel functions. Not a launch blocker; feeds are Edge-tier.
- No persistent connections from serverless — same websocket point.
- Hobby (free) tier is non-commercial — a paid launch needs **Vercel Pro
  (~£20/mo)**. Budget it in launch COGS.

## 4. Database

**Today:** SQLite-per-install with bootstrap `CREATE TABLE IF NOT EXISTS` +
additive `ALTER` migrations in `src/lib/db/index.ts`. Right for local-first.

**Hosted (Route 1, post-D6):** managed Postgres. Recommendation: **Neon** —
serverless Postgres, scale-to-zero (cheap at waitlist scale), instant
copy-on-write **branches** (that *is* our staging database), point-in-time
recovery on paid tiers. Turso is the alternative (SQLite semantics, embedded
replicas — the Route 2 fallback). Drizzle ORM supports both; the schema is
already Drizzle.

**Migration discipline (new, required for hosted):**
1. `drizzle-kit generate` produces versioned SQL migration files (replaces
   bootstrap-as-migration for the hosted DB).
2. Migrations run as a deploy step (Vercel build command or GitHub Action),
   never by hand against production.
3. Every migration is forward-only and additive where possible; destructive
   changes ship in two deploys (expand, then contract).

**Health & backups:**
- `/api/health` endpoint (db ping + version) — uptime monitor hits this.
- Neon PITR for the live branch; a **restore drill** (restore to a branch,
  verify, discard) once before launch and quarterly after.
- PostHog error-spike alert (already live, EDGE-35) covers 5xx surfacing.

## 5. Toolstack — every account the launch needs

| Tool | For | Status |
|------|-----|--------|
| Domain registrar | `edgeways.app` on **GoDaddy** | **Done** (EDGE-23) |
| Human email | Zoho Mail — `sam@edgeways.app` + `hello@` / `support@` aliases | **Done** (11 Aug) |
| GitHub | Private repo `EdgeDesk-MB/EdgeDesk`, branch protection, Actions for migration deploys | Exists — **confirm private** |
| Vercel | Hosting, previews (staging), env vars, cron — team `edgeways` (Pro trial) | **Done** (EDGE-46 — prod live at edgeways.app) |
| Neon | Managed Postgres + branches + PITR | **In progress** (EDGE-47; scaffold + migrations; app cutover open) |
| PostHog EU | Analytics + error tracking, cookieless, `/ingest` proxy | **Done** (EDGE-35) |
| Stripe | Payments (direct, L1 15 Aug). Test catalogue EDGE-3. Checkout + slip + portal + webhook tier write on localhost | **In progress** — next is EDGE-58 Settings manage |
| Transactional email (Resend) | Waitlist + auth emails; domain Verified Ireland | **Done** for waitlist (EDGE-26); auth emails later |
| Uptime monitor (Better Stack / UptimeRobot free) | Hits `/api/health`, alerts to email | Sam: point at `https://edgeways.app/api/health` (EDGE-48) |
| Linear | Planning | Done |
| **Later (native):** Google Play + TWA; Apple Developer + Capacitor/PWABuilder | App store wrappers | Post-launch |

## 6. Go-live hygiene — what's visible to customers

**The deployed app only serves built assets** — the repo's internal docs
(`docs/legal/*.draft.md`, strategy docs, the `.cursor`/`.claude` harness,
Linear IDs in comments) never reach the browser *as long as the repo stays
private and nothing imports them into the bundle*. Gates:

- [ ] **Repo stays private** (confirm `EdgeDesk-MB/EdgeDesk` visibility).
  If it ever goes open-source, internal docs move to a private repo first.
- [ ] **Customer-facing in-app content audit** — the app *does* render
  curated content (`/roadmap`, `/release-notes`, help guides). Sweep
  `src/content/` for internal names, Linear IDs, and strategy asides before
  launch. These pages are for customers; the internal roadmap stays in docs.
- [ ] **Env var discipline** — only `NEXT_PUBLIC_*` vars reach the browser
  (by design). The PostHog *personal* API key (`phx_…`) and all provider
  secrets stay server-side / `.env.local` (git-ignored) — never commit, never
  reference in client code. Pre-launch: one `git log -p` secrets sweep.
- [ ] **Dev artifacts gated** — `src/lib/dev/*`, demo-mode affordances and
  any dev-only routes must be inert in production builds.

**PostHog, honestly:** the *fact* of analytics must not be hidden — the
privacy policy discloses it (UK GDPR/PECR). What we *can* and do minimise:
the project token is public-by-design but **write-only** (it cannot read a
byte of data back); events travel via our own `/ingest` path so no
`posthog.com` domains appear in the network tab; cookieless mode, no session
replay, no heatmaps, no console capture (all locked server-side, EDGE-35);
IPs anonymised. A customer inspecting their browser sees anonymous pageview
beacons to our own domain — exactly what the privacy policy describes.

## 7. Task map (Linear)

| Task | Ticket | Milestone |
|------|--------|-----------|
| Confirm domain control + pick Vercel | EDGE-23 | M1 |
| Provision Vercel project (previews = staging, prod on main) | EDGE-46 | M1 |
| Transactional email (Resend verified; waitlist form) | EDGE-26 | M2 |
| Hosted Postgres (Neon) + Drizzle migration pipeline | EDGE-47 (Route 1 Done — unblocked) | M2 |
| `/api/health` + uptime monitor | new — EDGE-48 | M2 |
| Go-live hygiene scrub (section 6 checklist) | new — EDGE-49 | M3 |
| DB restore drill | part of EDGE-47 done-when | M3 |
