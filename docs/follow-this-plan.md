# Follow this plan — Edgeways launch path

> **Start here each morning.** Operational checklist for Sam.
> Strategy detail: `docs/live-readiness.md`. Linear:
> [Live Readiness](https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c).
> Repo layout rules: `docs/repo-layout.md`.
>
> Last updated: **12 Aug 2026, evening** (subscription offer locked; launch
> landing is a variant, waitlist stays default `/`).

---

## 👇 You are here

**Thread A — Auth, [EDGE-20](https://linear.app/samhayter/issue/EDGE-20) accounts
row done; next is [EDGE-21](https://linear.app/samhayter/issue/EDGE-21).**

Clerk is chosen and wired. `/login` and `/sign-up` work (Google + email, 18+
step on sign-up, Edgeways branding). Production is still waitlist-only: signed-in
users hit `/desk` then bounce home until `SITE_SURFACE=app`.

**Next on this thread (do not skip ahead to billing):**
1. ~~Desk Logout chrome.~~ Done (desktop last/right meta tab; mobile Log out at burger bottom). Login stays on the .app homepage (EDGE-21).
2. ~~Neon user row keyed by Clerk `userId`.~~ Done (`app_users` upsert on sign-in).
3. 👇 [EDGE-21](https://linear.app/samhayter/issue/EDGE-21) — launch landing
   **variant** (Login + public pricing table). Waitlist stays on production `/`
   until `LANDING_VARIANT=launch`. Offer: `docs/strategy/subscriptions.md`.

**Meanwhile (Sam admin, not this agent thread):** EDGE-1 processor emails.

---

## Where we are right now

| Thing | Status |
|-------|--------|
| Live marketing site | **https://edgeways.app** — waitlist only |
| Desk app on production | **Blocked** — `proxy.ts` redirects `/desk` etc. → `/` when `SITE_SURFACE=waitlist` |
| Local desk | Full app on `:3000`; `/login` and `/sign-up` live |
| Neon | Waitlist + `app_users` (Clerk `userId` PK). Desk data still **SQLite locally**; full SQLite→Postgres cutover is later |
| Auth / SSO | **Clerk** — EDGE-19 done. `/login` + `/sign-up` live. Neon `app_users` upserts on sign-in. Google consent still says “Clerk” until a custom Google OAuth client |
| Waitlist owner alert | Resend sends; **Zoho `sam@` bounces** (`554 ContentRejected`). `WAITLIST_NOTIFY_TO` is Gmail (local + Vercel) |
| Billing | Blocked on processor acceptance emails ([EDGE-1](https://linear.app/samhayter/issue/EDGE-1)) |

Closed recently: EDGE-24, 25, 26, 34, 46, **19**. EDGE-20 in progress.

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
- [x] **Waitlist smoke** — Join on https://edgeways.app works; thanks email delivers. Owner alert delivers to Gmail. Unsubscribe still worth one click when you next join. (Zoho `sam@` is a dead end for Resend.)
- [ ] **[EDGE-48](https://linear.app/samhayter/issue/EDGE-48)** — Point Better Stack or UptimeRobot at `https://edgeways.app/api/health`.
- [ ] **Domains** — Add `www.edgeways.app` in Vercel; redirect apex → www (or www → apex — pick one canonical).
- [ ] **[EDGE-8](https://linear.app/samhayter/issue/EDGE-8)** — Read `docs/legal/gambling-licence-assessment.md`; send GC email or skip consciously; mark Done.
- [ ] **[EDGE-9](https://linear.app/samhayter/issue/EDGE-9)** / **[EDGE-10](https://linear.app/samhayter/issue/EDGE-10)** — ICO fee + UK IPO trademark search (can be later this week).

### 2. Decisions (~20 min) — unblock agents

- [x] **[EDGE-19](https://linear.app/samhayter/issue/EDGE-19)** — Clerk (Google + email now; Apple when Developer account ready).
- [ ] **[EDGE-2](https://linear.app/samhayter/issue/EDGE-2)** — Stripe direct vs MoR — wait for EDGE-1 replies if you can; default lean MoR for VAT if solo UK.

### 3. Agent sessions (pick one thread per day)

| Thread | Tickets | Outcome |
|--------|---------|---------|
| 👇 **A — Auth** | EDGE-19 ✓ → **20 in progress** → 21 | `/login` live. Neon `app_users` done. Offer locked. Remaining: launch landing variant (EDGE-21) |
| **B — Neon slice** | EDGE-47 | Waitlist + `app_users` on Neon. Full SQLite→Postgres cutover is multi-session |
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

**Subscriptions (locked 12 Aug 2026 — `docs/strategy/subscriptions.md`):**
1. EDGE-1 processor acceptance → EDGE-2 Stripe vs MoR (does not change prices)
2. Clerk `userId` is the account key in Neon
3. Public: Free £0 / Core £9.99 · £99.90/yr / Edge £24.99 · £249.90/yr
4. 14-day Edge trial (one per person), then list price
5. Founding (waitlist/beta, not on public cards): 3 months Edge at Core price after trial
6. Feedback thank-you: one extra month, once, granted not automated
7. Checkout (EDGE-4) creates/updates the processor customer linked to that `userId`
8. Webhooks write entitlement tier (and trial/founding window) on the user row
9. Desk features read tier from DB (EDGE-22), not from Clerk alone
10. Clerk Billing is optional later — prefer our own Stripe/MoR webhooks so
    entitlement stays in Neon with the rest of the product
11. **Success UX (EDGE-4):** after pay, a tactile receipt printer — paper slides
    out of the checkout card (plan, tax, total, order id). Spec + clip on
    [EDGE-4](https://linear.app/samhayter/issue/EDGE-4). Ref:
    https://x.com/i/status/2087184765765943533

**Onboarding:** Existing 4-step wizard stays; after auth, rewrite welcome/settings copy for hosted (no `.env.local`), then validate with one external user (EDGE-33).

**Pre-launch QA:** Thorough pass on Settings, Help, and any localhost-era copy before real users (EDGE-37 / EDGE-49).

---

## Critical path (simple)

```text
EDGE-1 emails ──► EDGE-2 stack ──► EDGE-3…5 billing (Clerk userId → customer → tier)
EDGE-19 Clerk ✓ ──► EDGE-20 /login + Neon user ✓ ──► 👇 EDGE-21 landing CTA ──► onboarding v2
EDGE-47 Neon waitlist + app_users ✓ ──► full desk cutover later
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
