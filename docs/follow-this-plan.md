# Follow this plan — Edgeways launch path

> **Start here each morning.** Operational checklist for Sam.
> Strategy detail: `docs/live-readiness.md`. Linear:
> [Live Readiness](https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c).
> Repo layout rules: `docs/repo-layout.md`.
>
> Last updated: **4 Sep 2026** (production is the **live app**, not a waitlist.
> Verified against https://edgeways.app: launch homepage, `/desk` HTTP 200,
> no waitlist form. `SITE_SURFACE=app`, `LANDING_VARIANT=launch`.)

---

## Current live status

**https://edgeways.app is live.** Sign-up, login, pricing, trial checkout and
the hosted desk are open. Do not treat production as waitlist-only. Do not
flip `SITE_SURFACE` or `LANDING_VARIANT` back to waitlist.

Verified 4 Sep 2026 (live HTML + route probes):

| Surface | What is true now |
|---------|------------------|
| Homepage | Launch variant. Title: "Start free: matched betting without the faff". H1: "Know what's next. See what paid." Lead: command centre, one desk for the day. No waitlist form. Nav: Try the desk, Log in, Start free trial. Hero: See plans, Try the desk. |
| Positioning | Not an oddsmatcher. Does not send bookie offers. Supplements finders. Free / Core £9.99/mo / Edge £24.99/mo / 14-day Edge trial. |
| Desk | Open. `SITE_SURFACE=app`. `/desk` returns 200 (no bounce to `/`). Unsigned visitors still hit Clerk. |
| Auth / billing | Clerk at `clerk.edgeways.app`. `/login` and `/sign-up` 200. Unsigned `/subscribe` 307s to `/#pricing`. |
| Waitlist | Off the public homepage (closer stripped 2 Sep: `8bec22b`). Code stays as fail-closed fallback (EDGE-109), Founding eligibility (EDGE-93), and admin metrics. Privacy still discloses waitlist email because those rows exist. |

## How we got here

The August tickets below are **Done**. [EDGE-4](https://linear.app/samhayter/issue/EDGE-4),
[EDGE-5](https://linear.app/samhayter/issue/EDGE-5),
[EDGE-58](https://linear.app/samhayter/issue/EDGE-58),
[EDGE-20](https://linear.app/samhayter/issue/EDGE-20),
[EDGE-21](https://linear.app/samhayter/issue/EDGE-21),
[EDGE-61](https://linear.app/samhayter/issue/EDGE-61) are **Done**.
[EDGE-22](https://linear.app/samhayter/issue/EDGE-22) is **Done** (25 Aug) —
paying now locks desk features: the desk gates on the webhook-fed plan from
`app_users`, the Settings preview can only step down, and `/api/offers/edge`
is guarded server-side.
[EDGE-83](https://linear.app/samhayter/issue/EDGE-83) is **Done** (25 Aug) —
Core/Free billing rows get 403 on live racing feeds and exchange prices
(same fail-open pattern as Offer Edge). Demo and unsigned localhost still
load.

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

**Done 25 Aug:** [EDGE-7](https://linear.app/samhayter/issue/EDGE-7) test-mode
billing rehearsal — automated drill (20 checks: trial → paid → downgrade →
upgrade → scheduled cancel → resume → cancel → refund → stacked-sub fallback)
+ Sam's click-through all green. Findings shipped: scheduled-cancel visibility
in Settings (`cancel_at` → Cancelling badge + access-end date), success-slip
copy + setup-aware CTA.
[EDGE-82](https://linear.app/samhayter/issue/EDGE-82) also **done** 25 Aug —
checkout can no longer stack a second subscription: `/subscribe` redirects
existing subscribers to the portal, the webhook falls back to a still-live
sub when an old one dies, and pricing CTAs read "Manage subscription" for
subscribers. Live-mode rerun stays M3.

**Done 25 Aug:** [EDGE-83](https://linear.app/samhayter/issue/EDGE-83) —
server 403 on racing desk/racecards/results/test and exchange football-odds/test
when the billing row is not Edge. Runners skip the live enrichment path.
`api()` treats a `source: "locked"` 403 as a safe fallback (demo desk, empty
cards, unmatched prices).

**Done:** production flipped to `SITE_SURFACE=app` and `LANDING_VARIANT=launch`
(waitlist closer removed from the live homepage 2 Sep). Do not reverse that.

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

[EDGE-78](https://linear.app/samhayter/issue/EDGE-78) keyboard slice is Done.
Settle-focused-bet leftover is [EDGE-79](https://linear.app/samhayter/issue/EDGE-79).

---

## Where we are right now

| Thing | Status |
|-------|--------|
| Live marketing site | **https://edgeways.app** — launch homepage (not waitlist) |
| Desk app on production | **Open** — `SITE_SURFACE=app`. `/desk` 200. Waitlist gate is only the fail-closed fallback if that env is unset |
| Local desk | Full app on `:3000`; `/login`, `/sign-up`, `/subscribe` live |
| Neon | `app_users` (Clerk `userId` PK) plus hosted desk: bets, offers, wallets, history, settings behind `EDGEWAYS_DESK_BACKEND=neon` (EDGE-47). Localhost stays SQLite. Waitlist table still holds founding/admin rows |
| Auth / SSO | **Clerk** — EDGE-19 done. `/login` + `/sign-up` live. Neon `app_users` upserts on sign-in. Google consent still says “Clerk” until a custom Google OAuth client |
| Waitlist owner alert | Historical list still emails; **Zoho `sam@` bounces** (`554 ContentRejected`). `WAITLIST_NOTIFY_TO` is Gmail (local + Vercel). New-account notify also ships (27 Aug) |
| In-app feedback | Resend notify + Neon `feedback_reports` (not the user's desk). Same Gmail notify list unless `FEEDBACK_NOTIFY_TO` is set. Linear filing still later (EDGE-43) |
| Billing | **Stripe** (L1). Catalogue, Checkout, slip, portal, webhooks, Settings → Subscription. Test-mode rehearsal [EDGE-7](https://linear.app/samhayter/issue/EDGE-7) green 25 Aug |
| Legal (customer-facing) | **Published 17 Aug.** `/terms` + `/privacy`, signup ToS/Privacy checkbox. Privacy still names waitlist email (those rows remain). ICO fee later (retake when trading). [EDGE-61](https://linear.app/samhayter/issue/EDGE-61) |

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
- [x] **Waitlist smoke** — Done while `/` was still the waitlist. Public homepage no longer collects waitlist joins (2 Sep). Historical rows remain on Neon.
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
| **B — Neon slice** | EDGE-47 ✓ | `app_users` + full desk (bets, offers, wallets, history) on Neon for hosted; localhost stays SQLite |
| 👇 **C — Checklist** | EDGE-49 ✓ → **37** | §5 boxes ticked or deferred before charging strangers |

Do **not** run A + full Neon cutover + billing in the same day.

### 4. Later M2 (Sep–Oct)

- [EDGE-33](https://linear.app/samhayter/issue/EDGE-33) stranger test
- Referral codes (EDGE-67, confirm the 50% / £9.99 offer)
- [EDGE-68](https://linear.app/samhayter/issue/EDGE-68) Import from Oddsmonkey
  (then Outplayed). Spec: `docs/strategy/platform-import.md`. Needs Sam’s enum dump.
- Solicitor (EDGE-8) if a trigger fires
- [x] `SITE_SURFACE=app` + `LANDING_VARIANT=launch` on production (verified 4 Sep)

Shipped 19–22 Aug: EDGE-4 leftovers, 62–66, 78.

### 5. M3 leftovers (original target Nov; production already live)

- [x] EDGE-22 real entitlement enforcement (25 Aug)
- EDGE-7 live-mode billing rerun (test-mode rehearsal already green)
- EDGE-8 solicitor sign-off of the published `/terms` + `/privacy` pages (only if a trigger fires)
- EDGE-37 full checklist pass
- [x] EDGE-49 go-live hygiene

---

## SSO / payments / onboarding (remembered intent)

**SSO (chosen): Clerk** — Google + email now; Apple when Developer account ready.
- Login UI lives at **`/login`** (sign-up at `/sign-up`). Launch landing (EDGE-21)
  is production `/`. Waitlist homepage is only the fail-closed fallback when
  `LANDING_VARIANT` is not `launch`.
- After sign-in, redirect target is `/desk`. Production is `SITE_SURFACE=app`,
  so the waitlist gate does not bounce desk home.

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
Landing says we do not supply bookie offers (EDGE-64, live FAQ).
Empty Home import from Oddsmonkey is EDGE-68 (needs enum dump).

**Pre-launch QA:** Thorough pass on Settings, Help, and any localhost-era copy before real users (EDGE-37 / EDGE-49).

---

## Critical path (simple)

```text
EDGE-1 skipped ──► EDGE-2 Stripe ✓ ──► EDGE-3 catalogue ✓ ──► EDGE-4 user path ✓ ──► EDGE-5 webhooks ✓ ──► EDGE-58 Settings manage ✓
EDGE-19 Clerk ✓ ──► EDGE-20 /login + Neon user ✓ ──► EDGE-21 + 59 /demo + 60 /setup ✓
EDGE-47 Neon app_users + hosted desk ✓
SITE_SURFACE=app · LANDING_VARIANT=launch (production, verified 4 Sep 2026)
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
