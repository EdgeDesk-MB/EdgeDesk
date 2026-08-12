# Follow this plan — Edgeways launch path

> **Start here each morning.** Operational checklist for Sam.
> Strategy detail: `docs/live-readiness.md`. Linear:
> [Live Readiness](https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c).
> Repo layout rules: `docs/repo-layout.md`.
>
> Last updated: **12 Aug 2026** (post waitlist deploy).

---

## Where we are right now

| Thing | Status |
|-------|--------|
| Live marketing site | **https://edgeways.app** — waitlist only |
| Desk app on production | **Blocked** — middleware redirects `/desk` etc. → `/` when `SITE_SURFACE=waitlist` |
| Local desk | Still full app on `:3000` (no waitlist lock unless you set the env) |
| Neon | Project + migrations exist; app still uses **SQLite locally**; hosted desk not wired yet |
| Auth / SSO | Not started — pick provider first ([EDGE-19](https://linear.app/samhayter/issue/EDGE-19)) |
| Billing | Blocked on processor acceptance emails ([EDGE-1](https://linear.app/samhayter/issue/EDGE-1)) |

Closed recently: EDGE-24, 25, 26, 34, 46 (see Linear comments).

---

## The one rule for folders (read once)

| Folder | What belongs there | Who sees it |
|--------|--------------------|-------------|
| **`edgeways/`** | The Next.js app: `src/`, `public/`, engineering docs agents need while coding (`design-system`, offer docs, roadmap briefs) | GitHub (private) + Vercel build root |
| **Repo root `docs/`** | Launch plans, legal drafts, hosting, AI harness notes, strategy, Sam handoffs | GitHub only — **outside** Vercel Root Directory |
| **Never commit** | `.env.local`, `edgeways/data/*.db`, API keys, real Neon URLs in chat | Your Mac + Vercel env UI |

Full rules: `docs/repo-layout.md`.

---

## Do this week (in order)

### 1. Admin / Sam only (~45 min) — do before building

- [ ] **[EDGE-1](https://linear.app/samhayter/issue/EDGE-1)** — Send processor acceptance emails (Stripe + Paddle + Lemon Squeezy). Draft is on the ticket. Highest leverage of anything on the board.
- [ ] **Waitlist smoke** — Submit your own email on https://edgeways.app; confirm Resend delivery + unsubscribe works.
- [ ] **[EDGE-48](https://linear.app/samhayter/issue/EDGE-48)** — Point Better Stack or UptimeRobot at `https://edgeways.app/api/health`.
- [ ] **Domains** — Add `www.edgeways.app` in Vercel; redirect apex → www (or www → apex — pick one canonical).
- [ ] **[EDGE-8](https://linear.app/samhayter/issue/EDGE-8)** — Read `docs/legal/gambling-licence-assessment.md`; send GC email or skip consciously; mark Done.
- [ ] **[EDGE-9](https://linear.app/samhayter/issue/EDGE-9)** / **[EDGE-10](https://linear.app/samhayter/issue/EDGE-10)** — ICO fee + UK IPO trademark search (can be later this week).

### 2. Decisions (~20 min) — unblock agents

- [ ] **[EDGE-19](https://linear.app/samhayter/issue/EDGE-19)** — Choose auth: recommended **Clerk** (Google + Apple + email). Alternatives: Auth.js (more DIY), Supabase Auth (less natural with Neon).
- [ ] **[EDGE-2](https://linear.app/samhayter/issue/EDGE-2)** — Stripe direct vs MoR — wait for EDGE-1 replies if you can; default lean MoR for VAT if solo UK.

### 3. Agent sessions (pick one thread per day)

| Thread | Tickets | Outcome |
|--------|---------|---------|
| **A — Auth** | EDGE-19 → 20 → 21 | Sign-in with Google (+ Apple when Apple Developer ready); protect desk routes |
| **B — Neon slice** | EDGE-47 | Waitlist + users on Neon in production; full SQLite→Postgres cutover is multi-session |
| **C — QA scrub** | EDGE-49 / EDGE-37 slice | Settings/Help copy: strip `.env.local` / localhost / SQLite developer language for hosted |

Do **not** run A + full Neon cutover + billing in the same day.

### 4. Later M2 (Sep–Oct) — after auth + EDGE-1

- Billing: EDGE-3 → 4 → 5 (products, checkout, webhooks)
- Onboarding v2 for hosted users + [EDGE-33](https://linear.app/samhayter/issue/EDGE-33) stranger test
- Legal drafts: EDGE-11, EDGE-12
- Flip `SITE_SURFACE=app` only when auth + desk are ready for beta invitees

### 5. M3 Launch (Nov)

- EDGE-22 real entitlement enforcement
- EDGE-7 billing rehearsal (you click every path in test mode)
- EDGE-37 full pre-launch checklist
- EDGE-49 go-live hygiene

---

## SSO / payments / onboarding (remembered intent)

**SSO (chosen): Clerk** — Google + email now; Apple when Developer account ready.
- Login UI lives at **`/login`** (sign-up at `/sign-up`) — not linked from the waitlist
  landing yet; wire a CTA when the future landing state is ready.
- Waitlist mode still allows `/login` so auth can be tested without opening the desk.
- After sign-in, redirect target is `/desk` (on production waitlist, middleware
  still bounces desk → `/` until `SITE_SURFACE=app`).

**Subscriptions (factored, not built):**
1. EDGE-1 processor acceptance → EDGE-2 Stripe vs MoR
2. Clerk `userId` is the account key in Neon
3. Checkout creates/updates Stripe (or MoR) customer linked to that `userId`
4. Webhooks write entitlement tier (Free / Core / Edge) on the user row
5. Desk features read tier from DB (EDGE-22), not from Clerk alone
6. Clerk Billing is optional later — prefer our own Stripe/MoR webhooks so
   entitlement stays in Neon with the rest of the product

**Onboarding:** Existing 4-step wizard stays; after auth, rewrite welcome/settings copy for hosted (no `.env.local`), then validate with one external user (EDGE-33).

**Pre-launch QA:** Thorough pass on Settings, Help, and any localhost-era copy before real users (EDGE-37 / EDGE-49).

---

## Critical path (simple)

```text
EDGE-1 emails ──► EDGE-2 stack ──► EDGE-3…5 billing (Clerk userId → customer → tier)
EDGE-19 Clerk ✓ ──► EDGE-20 /login live ──► EDGE-21 landing CTA ──► onboarding v2
EDGE-47 Neon wire ──► hosted waitlist/users durable
SITE_SURFACE=waitlist until beta desk is ready
```

---

## Links

| Need | Link |
|------|------|
| Production | https://edgeways.app |
| Vercel project | https://vercel.com/edgeways/edgeways |
| Linear initiative | https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c |
| Hosting map | `docs/hosting-and-environments.md` |
| Live readiness (long form) | `docs/live-readiness.md` |
| Repo layout | `docs/repo-layout.md` |

When something on this list finishes, tick it here **and** close/comment the Linear ticket.
