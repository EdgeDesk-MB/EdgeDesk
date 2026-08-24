# Follow this plan — Edgeways launch path

> **Start here each morning.** Operational checklist for Sam.
> Strategy detail: `docs/live-readiness.md`. Linear:
> [Live Readiness](https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c).
> Repo layout rules: `docs/repo-layout.md`.
>
> Last updated: **23 Aug 2026** (EDGE-47 **done** — full Neon desk cutover proven
on preview: onboarding, wallets, offers, bets, history + restore drill;
EDGE-37 interim checklist pass done; final pass stays C6).

---

## 👇 You are here

The billing and first-run path is in. [EDGE-4](https://linear.app/samhayter/issue/EDGE-4),
[EDGE-5](https://linear.app/samhayter/issue/EDGE-5),
[EDGE-58](https://linear.app/samhayter/issue/EDGE-58),
[EDGE-20](https://linear.app/samhayter/issue/EDGE-20),
[EDGE-21](https://linear.app/samhayter/issue/EDGE-21),
[EDGE-61](https://linear.app/samhayter/issue/EDGE-61) are **Done**.
Paying still does **not** lock desk features ([EDGE-22](https://linear.app/samhayter/issue/EDGE-22)).

**Done 23 Aug:** [EDGE-47](https://linear.app/samhayter/issue/EDGE-47)
Neon desk cutover — offers, wallets, history and bets all read/write Neon on
the preview, user-scoped by Clerk id; hosted JSON backup/restore drill works;
Sam proved onboarding → offer → bet → refresh on the preview.

**Done 23 Aug:** [EDGE-45](https://linear.app/samhayter/issue/EDGE-45)
reframed by [D8](decisions/d8-staged-licensing.md) — staged licensing:
launch quietly on operator-held feeds, no permission emails sent; reply
templates on file (`docs/legal/provider-permission-emails.md`) for
comply-fast-and-licence if a provider ever makes contact. Customer-facing
copy no longer names data providers (Settings, Racing Desk, EP Desk, Help,
roadmap all say "racing/football/exchange feed"). Betfair stays delayed-only.

**Scoped 23 Aug:** [EDGE-80](https://linear.app/samhayter/issue/EDGE-80)
admin control panel (`/admin`: payments, subscribers, **user management**,
activity, feed health, release flags). Same desk styling plus a top-right
**ADMIN** chip (same tag as demo-mode **DEMO**). Bootstrap admin:
`samhayter.design@gmail.com`; further admins granted in-app with an access
prompt. Keep Clerk (do not switch to Better Auth in this ticket). Hide
customer Settings → Data & API at go-live.
[EDGE-81](https://linear.app/samhayter/issue/EDGE-81) pooled feeds: Sam's
operator keys must serve all customer-tracked events within provider
budgets (football live-score polling is the pinch).

**Next session (pick one, do not mix in the same day):**
- [EDGE-7](https://linear.app/samhayter/issue/EDGE-7) Sam clicks the billing
  rehearsal in test mode — webhook backbone already automated
  (`npm run billing:rehearsal`, 11/11 PASS 24 Aug); Sam's 15-min click list
  is in `docs/stripe-test-rehearsal.md`
- Flip `SITE_SURFACE=app` only when Neon desk + checklist + Sam says so

**Done 24 Aug:** [EDGE-80](https://linear.app/samhayter/issue/EDGE-80) admin
control panel shipped to preview (full review + 10 fixes folded in; migration
0013 applied). [EDGE-81](https://linear.app/samhayter/issue/EDGE-81) pooled
feeds verified on live Neon via `npm run db:feeds-smoke` (budget counter,
sync lease, events) — no manual clicks needed. EDGE-7 prep: test catalogue
audited against app config (all 5 prices match), automated webhook drill
(trial → paid → downgrade → upgrade → cancel → refund) green against Neon.

[EDGE-37](https://linear.app/samhayter/issue/EDGE-37) interim pass done 22 Aug:
every §5 box ticked or consciously deferred with a dated note in
`docs/live-readiness.md`. Final full pass stays in C6 (launch week).

Production is still waitlist-only: signed-in users hit `/desk` then bounce
home until `SITE_SURFACE=app`. Do not promote `LANDING_VARIANT=launch` on
production until that flip.

[EDGE-78](https://linear.app/samhayter/issue/EDGE-78) keyboard slice is Done.
Settle-focused-bet leftover is [EDGE-79](https://linear.app/samhayter/issue/EDGE-79).

---

## Where we are right now

| Thing | Status |
|-------|--------|
| Live marketing site | **https://edgeways.app** — waitlist only |
| Desk app on production | **Blocked** — `proxy.ts` redirects `/desk` etc. → `/` when `SITE_SURFACE=waitlist` |
| Local desk | Full app on `:3000`; `/login`, `/sign-up`, `/subscribe` live |
| Neon | Waitlist + `app_users` (Clerk `userId` PK). Preview desk: bets, offers, wallets, history + settings on Neon behind `EDGEWAYS_DESK_BACKEND=neon` (EDGE-47 done 23 Aug). Localhost stays SQLite |
| Auth / SSO | **Clerk** — EDGE-19 done. `/login` + `/sign-up` live. Neon `app_users` upserts on sign-in. Google consent still says “Clerk” until a custom Google OAuth client |
| Waitlist owner alert | Resend sends; **Zoho `sam@` bounces** (`554 ContentRejected`). `WAITLIST_NOTIFY_TO` is Gmail (local + Vercel) |
| In-app feedback | Resend notify + Neon `feedback_reports` (not the user's desk). Same Gmail notify list unless `FEEDBACK_NOTIFY_TO` is set. Linear filing still later (EDGE-43) |
| Billing | **Stripe** (L1). Test catalogue ✓. Checkout + slip + portal ✓. Webhooks write tier ✓. Settings → Subscription ✓ (EDGE-58). Rehearsal is [EDGE-7](https://linear.app/samhayter/issue/EDGE-7) |
| Legal (customer-facing) | **Published 17 Aug.** `/terms` + `/privacy`, waitlist Privacy notice, signup ToS/Privacy checkbox. ICO fee later (retake when trading). Solicitor before charging strangers. [EDGE-61](https://linear.app/samhayter/issue/EDGE-61) |

Closed recently: EDGE-4, 5, 19, 20, 21, **47**, 49, 58, 61–66, **78**. **EDGE-37** interim pass done; final pass in C6.

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

### 1. Admin / Sam only (~45 min) — do before or between sessions

- [x] **[EDGE-1](https://linear.app/samhayter/issue/EDGE-1)** — Cancelled 15 Aug. Not a gambling site; no pre-approval emails. Residual review risk accepted.
- [x] **Waitlist smoke** — Join on https://edgeways.app works; thanks email delivers. Owner alert delivers to Gmail. Unsubscribe still worth one click when you next join. (Zoho `sam@` is a dead end for Resend.)
- [x] **[EDGE-48](https://linear.app/samhayter/issue/EDGE-48)** — Better Stack on `https://edgeways.app/api/health`. Android On-Call push confirmed 19 Aug.
- [x] **Domains** — Canonical is apex `https://edgeways.app`. `www` already 307s to apex (paths preserved). Do not flip to www.
- [x] **[EDGE-8](https://linear.app/samhayter/issue/EDGE-8)** — Memo stands. GC email skipped 19 Aug. Solicitor only if a §7 trigger fires.
- [x] **[EDGE-11](https://linear.app/samhayter/issue/EDGE-11)** — ToS draft read 16 Aug. Placeholders (entity, contact, VAT) fill at publish.
- [x] **[EDGE-12](https://linear.app/samhayter/issue/EDGE-12)** — Privacy draft read 16 Aug. Published 17 Aug (EDGE-61).
- [ ] **[EDGE-9](https://linear.app/samhayter/issue/EDGE-9)** — ICO fee: not due until trading. Parked in Cycle 6.
- [x] **[EDGE-10](https://linear.app/samhayter/issue/EDGE-10)** — UK IPO search 19 Aug. Filing on hold (Flutter EDGEWAYS hit).

### 2. Decisions (~20 min) — unblock agents

- [x] **[EDGE-19](https://linear.app/samhayter/issue/EDGE-19)** — Clerk (Google + email now; Apple when Developer account ready).
- [x] **[EDGE-2](https://linear.app/samhayter/issue/EDGE-2)** — L1 Stripe direct. VAT later; homepage stays “Prices in GBP”.

### 3. Agent sessions (pick one thread per day)

| Thread | Tickets | Outcome |
|--------|---------|---------|
| **D — Billing** | EDGE-3 ✓ → 4 ✓ → 5 ✓ → 58 ✓ | Tier writes. Settings → Subscription |
| **A — Auth / first-run** | EDGE-19 ✓ → 20 ✓ → 21 ✓ + 59 ✓ + 60 ✓ | Try the desk, public `/demo`, full-page `/setup` |
| **B — Neon slice** | EDGE-47 ✓ | Waitlist + `app_users` + full desk (bets, offers, wallets, history) on Neon for hosted; localhost stays SQLite |
| 👇 **C — Checklist** | EDGE-49 ✓ → **37** | §5 boxes ticked or deferred before charging strangers |

Do **not** run A + full Neon cutover + billing in the same day.

### 4. Later M2 (Sep–Oct)

- [EDGE-33](https://linear.app/samhayter/issue/EDGE-33) stranger test
- Referral codes (EDGE-67, confirm the 50% / £9.99 offer)
- [EDGE-68](https://linear.app/samhayter/issue/EDGE-68) Import from Oddsmonkey
  (then Outplayed). Spec: `docs/strategy/platform-import.md`. Needs Sam’s enum dump.
- Solicitor (EDGE-8) before charging strangers
- Flip `SITE_SURFACE=app` only when Neon desk (EDGE-47) + EDGE-37 + Sam says so

Shipped 19–22 Aug: EDGE-4 leftovers, 62–66, 78.

### 5. M3 Launch (Nov)

- EDGE-22 real entitlement enforcement
- EDGE-7 billing rehearsal (recreate catalogue in **live** mode; you click every path)
- EDGE-8 solicitor sign-off of the published `/terms` + `/privacy` pages
- EDGE-37 full pre-launch checklist (in progress 22 Aug)
- EDGE-49 go-live hygiene ✓

---

## SSO / payments / onboarding (remembered intent)

**SSO (chosen): Clerk** — Google + email now; Apple when Developer account ready.
- Login UI lives at **`/login`** (sign-up at `/sign-up`). Launch landing (EDGE-21)
  is the homepage CTA; waitlist `/` stays default until promoted.
- Waitlist mode still allows `/login` so auth can be tested without opening the desk.
- After sign-in, redirect target is `/desk` (on production waitlist, middleware
  still bounces desk → `/` until `SITE_SURFACE=app`).

**Subscriptions (locked 12 Aug 2026 — `docs/strategy/subscriptions.md`):**
1. EDGE-1 skipped 15 Aug → EDGE-2 Stripe vs MoR (does not change prices)
2. Clerk `userId` is the account key in Neon
3. Public: Free £0 / Core £9.99 · £99.90/yr / Edge £24.99 · £249.90/yr
4. 14-day Edge trial (one per person), then list price
5. Founding (waitlist/beta, not on public cards): 3 months Edge at Core price after trial
6. Feedback thank-you: one extra month, once, granted not automated
7. Checkout (EDGE-4) creates/updates the processor customer linked to that `userId` — **done in test**
8. Webhooks write entitlement tier (and trial/founding window) on the user row — **EDGE-5, done locally**
8a. Settings → Subscription opens the Stripe portal (cancel, card, invoices) — **EDGE-58, go-live must**
9. Desk features read tier from DB (EDGE-22), not from Clerk alone
10. Clerk Billing is optional later — prefer our own Stripe webhooks so
    entitlement stays in Neon with the rest of the product
11. **Success UX (EDGE-4):** still thermal slip on `/subscribe/success` (not a
    printer-machine animation). Hosted Stripe Checkout stays the payment screen.

**Onboarding:** Empty and post-pay users land on full-page `/setup` (EDGE-60),
not a modal over a blank desk. Filled desk + `?onboard=1` still opens the
modal. Public `/demo` (EDGE-59) is a read-only fixture with a Core/Edge bar.
Hosted copy scrub (no `.env.local`) then one external user (EDGE-33).

**Oddsmonkey research (16 Aug, not a copy job):** they find offers; we run the
day. Take the *questions* (experience, why here, attribution, monthly target
slider) and a named empty-desk welcome. Do not take Gibraltar, live chat, or
“earn your first £100”. Plan:
`docs/strategy/oddsmonkey-onboarding-research.md`. Tickets: EDGE-62…68.
Landing must say we do not supply bookie offers (EDGE-64) before beta.
Empty Home import from Oddsmonkey is EDGE-68 (needs enum dump).

**Pre-launch QA:** Thorough pass on Settings, Help, and any localhost-era copy before real users (EDGE-37 / EDGE-49).

---

## Critical path (simple)

```text
EDGE-1 skipped ──► EDGE-2 Stripe ✓ ──► EDGE-3 catalogue ✓ ──► EDGE-4 user path ✓ ──► EDGE-5 webhooks ✓ ──► 👇 EDGE-58 Settings manage
EDGE-19 Clerk ✓ ──► EDGE-20 /login + Neon user ✓ ──► EDGE-21 + 59 /demo + 60 /setup ✓
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
| Legal drafts | `docs/legal/` (ToS, Privacy, GC assessment) |
| Oddsmonkey research → first-run | `docs/strategy/oddsmonkey-onboarding-research.md` (EDGE-62…68) |
| Platform CSV import | `docs/strategy/platform-import.md` (EDGE-68) |
| Legal pages | `/terms` and `/privacy` (EDGE-61, 17 Aug) |
| Stripe test cards + listen | `docs/stripe-test-rehearsal.md` |
| Repo layout | `docs/repo-layout.md` |

When something on this list finishes, tick it here **and** close/comment the Linear ticket.
