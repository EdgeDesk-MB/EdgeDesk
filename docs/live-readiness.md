# Live readiness — Edgeways

> Launch ops: automation, payments, legal, and the checklist that got us live.
> Strategy lives in `edgeways/docs/roadmap/product-roadmap.md` (§7 business path);
> this file is the operational wrapper. **Daily checklist:** `docs/follow-this-plan.md`.
> Folder rules: `docs/repo-layout.md`. Production is live (4 Sep 2026); the
> cycle dates below are the original plan, not the current surface.
>
> Infrastructure (hosting, database, environments, go-live hygiene):
> `docs/hosting-and-environments.md`. Architecture decision brief:
> `docs/decisions/d6-architecture-route.md` (EDGE-18). Feeds:
> `docs/decisions/d7-operator-held-feeds.md` (customers bring money only).

**Status snapshot (2026-09-04):** https://edgeways.app is the **live app**,
not a waitlist. Homepage is the launch variant (`LANDING_VARIANT=launch`):
"Start free: matched betting without the faff", H1 "Know what's next. See
what paid.", public pricing, Try the desk / Log in / Start free trial. No
waitlist form. Desk is open (`SITE_SURFACE=app`): `/desk` HTTP 200, not
bounced to `/`. Clerk at `clerk.edgeways.app`. Waitlist code remains as
fail-closed fallback (EDGE-109), Founding eligibility, and admin metrics;
Privacy still names waitlist email because those rows exist.

Clerk auth, Neon `app_users`, Stripe Checkout + slip + portal, and Settings →
Subscription (EDGE-58) are in. Webhooks write the tier (EDGE-5); real
entitlement enforcement replaced the preview (EDGE-22) with server-side feed
guards (EDGE-83). `/terms` + `/privacy` published (EDGE-61). Billing rehearsal
automated and green in test mode (EDGE-7); checkout blocks second
subscriptions (EDGE-82). Neon desk cutover done (EDGE-47, restore drill
verified). Operator-held pooled feeds serve customer-tracked events (EDGE-81,
D7); admin panel live at `/admin` (EDGE-80). Keyboard chords + `?` sheet
(EDGE-78) and keyboard settle (EDGE-79) shipped; mobile polish round landed
(EDGE-84/85/86). EDGE-45 resolved 25 Aug: D8 staged licensing. Remaining:
EDGE-37 checklist pass, EDGE-33 stranger test, EDGE-67 referral codes.
Do **not** flip production back to waitlist.
The D1 gate was opened for launch-path work on
10 Aug 2026 — evidence tracked as Linear EDGE-36. Work is in Linear: initiative
**[Live Readiness](https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c)**
(team `Edgeways`, key `EDGE`), six projects, milestones M1 Gate-ready (6 Sep) →
M2 Beta (4 Oct) → M3 Launch (2 Nov).

## 1. The path, in order

Original cycle (written Aug 2026). Production launched ahead of M3: live
homepage and desk are already open (verified 4 Sep). Treat steps 1–3 as
history.

1. **Now → M1 (6 Sep):** foundation decisions and cheap legal: N0 matrix, D6 formal
   decision, processor acceptance, solicitor, ICO, trademark search, domain/hosting,
   feedback triage dogfooded. (Cycle 1 issues are in Linear.)
2. **M1 → M2 (4 Oct):** auth + sign-in, billing in test mode, ToS/Privacy
   **published** on `/terms` and `/privacy` with signup consent
   (EDGE-61), 18+ gate, E3/G2/onboarding done. Waitlist + countdown were the
   interim public surface; they are no longer production `/`.
3. **M2 → M3 (2 Nov):** real entitlement enforcement, live charges, solicitor
   sign-off of the published legal pages, a11y sweep, full pre-launch checklist
   pass.
4. **Post-launch (now):** §7.3 oddsmatching bridge stays staged; Elite tier (§7.5) only
   once Edge revenue funds it.

## 2. Automation setup

Harness reference: `docs/cursor-daily-guide.md` §"Automations". Repo is on GitHub
(`EdgeDesk-MB/EdgeDesk` — note D4/D7: org rename to Edgeways-MB pending), so
cloud Cursor Automations are available once MCPs are authed.

### 2.1 Feedback → Linear (first automation to build)

The pipeline is: `/feedback` → `src/app/api/feedback/route.ts` → hosted Neon
`feedback_reports` (not the user's desk SQLite) plus a Resend owner email
(`FEEDBACK_NOTIFY_TO`, else `WAITLIST_NOTIFY_TO`). Do not send To Zoho
`sam@` / `hello@` via Resend (554 ContentRejected). Linear filing is still
deliberate. What is missing, in order:

- [x] **Linear workspace setup.** Team `Edgeways` (key EDGE) created 10 Aug 2026;
      Live Readiness initiative + six projects + M1–M3 milestones done. Labels:
      Legal, Payments, Automation, Feedback, Marketing (+ workspace Bug/Feature/
      Improvement/Beta/Research).
- [x] **Authenticate the Linear MCP** — done 10 Aug 2026.
- [x] **Idempotency column.** `linear_issue_id` (text, nullable) added to
      `feedback_reports` — done 10 Aug 2026 (**EDGE-38**): schema, bootstrap
      `CREATE TABLE` + `addColumn`, service helpers
      (`listUntriagedFeedbackReports`, `markFeedbackReportFiled`), tests green.
- [x] **Triage loop, draft-and-approve.** Proven end to end 10 Aug 2026
      (**EDGE-39**): smoke-test row filed as EDGE-44, id written back, issue
      closed. Runs as an in-session `/loop 1d` — read rows where
      `linear_issue_id IS NULL`, dedupe against existing Linear issues, draft a
      ticket per new row (kind → label, summary → title, details + diagnostics →
      body), present drafts, create on approval, write back the issue id.
- [ ] **Promote when boring.** Hosted inbox is in (Neon + Resend notify). Next is
      auto-drafting Linear issues from those rows once volume exists. → **EDGE-43**

### 2.2 Other automations (setup cost vs payoff)

| Automation | Surface | Setup needed | When |
|-----------|---------|--------------|------|
| Calc/UI edit reminders | Project hooks (`.cursor/hooks.json`) | None — ask in chat | Now, cheap |
| Nightly drift sweep (consistency-checker) | Cloud cron automation | Repo pushed; nothing else | When committing daily |
| Weekly UX audit digest → Linear | Cloud cron + Linear MCP | Linear auth | Post-launch |
| Errors → tickets | PostHog-native spiking alert → Linear (live 10 Aug, EDGE-35); new-issue triage via PostHog MCP + Linear MCP | Spiking alert done; triage cadence is EDGE-42 | Triage post-launch |
| PR gates (calc-auditor / design-reviewer on PRs) | Git-triggered automation | PR-based workflow | When PRs enter the flow |

Principles (from the daily guide): gates read-only, human approval first,
idempotent always, budget-aware models, every run logged.

## 3. Payments

Offer **locked 12 Aug 2026** in `docs/strategy/subscriptions.md` (Free £0 /
Core £9.99 · £99.90/yr / Edge £24.99 · £249.90/yr, 14-day Edge trial, Founding
= 3 months Edge at Core price after trial). Feature matrix remains §7.5.
What that doc does not cover:

### 3.1 The first task is not code — it is processor acceptance

Matched-betting software is **gambling-adjacent**, and processors review it:

- **Stripe** classifies gambling and some betting-adjacent services as restricted
  — software that facilitates betting can need pre-approval, and accounts do get
  refused in this niche. **Get written acceptance before building F4 billing.**
- **Merchant-of-Record alternatives** (Paddle, Lemon Squeezy) review the same
  question but also solve §3.2. Polar is another MoR worth checking.
- Have the one-line product description ready and honest: "subscription software
  that tracks and analyses the user's own betting activity; never takes a wager."

### 3.2 MoR vs Stripe direct (the VAT question)

| | Stripe direct | Merchant of Record (Paddle / Lemon Squeezy / Polar) |
|---|---|---|
| Seller of record | You | Them |
| UK VAT | You register/report once over threshold | Their problem |
| EU/worldwide B2C digital VAT | Due from first sale (OSS registration) | Their problem |
| Fees | Lower (~1.5% + 25p UK) | Higher (~5% + 50p) |
| Admin | Real | Near zero |

For a solo UK developer selling subscriptions worldwide, MoR usually wins on time
alone. Decide before F4; it shapes the checkout and entitlement webhook design.

### 3.3 Technical prerequisites (already roadmap-shaped)

- N0 entitlement matrix + feature flags (promoted, gated on D1) — build the
  matrix and "preview as" switch now, wire real enforcement at F4.
- Auth: none today (deferred by design). D6 leans hosted; the formal decision is
  due before F4. Entitlement checks need a server either way.
- **Betfair commercial data licensing legal read** (§7.2) before any paid tier
  ships live exchange prices. Same re-read for The Racing API / API-Football
  redistribution terms (§7.6).

## 4. Legal & compliance

§7.6 covers the gambling-specific items. Full list, with owners:

- [x] **18+ gating + BeGambleAware messaging** (§7.6) — shipped 10 Aug (EDGE-13):
      non-dismissible first-run gate with decline path, persisted
      `ageConfirmedAt`; reusable `ResponsibleGamblingNote` in the gate and
      Settings → Help & about; the same component serves signup (EDGE-19+)
      and the marketing footer (EDGE-26).
- [~] **Gambling licence assessment** (§7.6) — re-scoped 11 Aug (EDGE-8):
      self-assessment evidence file drafted
      (`docs/legal/gambling-licence-assessment.md`): no operating, software or
      intermediary licence required — the GC licenses operators, not tools,
      and 15+ years of unlicensed matched betting precedent holds. Solicitor
      letter only if a trigger fires (Stripe/bank demand, server-placed bets,
      EDGE-45 pooled feeds, GC guidance, big marketing push).
- [x] **Terms of Service (draft)** — drafted 10 Aug
      (`docs/legal/terms-of-service.draft.md`, EDGE-11). Sam read 16 Aug.
      Published 17 Aug on `/terms` (EDGE-61). Solicitor only if EDGE-8
      triggers, and before charging strangers.
- [x] **Privacy Policy + UK GDPR (draft)** — drafted 10 Aug
      (`docs/legal/privacy-policy.draft.md`, EDGE-12). Sam read 16 Aug.
      Published 17 Aug on `/privacy` (EDGE-61). Processors: Clerk, Stripe,
      Vercel, PostHog EU (cookieless), Resend. ICO number when trading
      starts (EDGE-9).
- [x] **Public legal pages + signup consent** — EDGE-61 (M2, High). This is
      the OddsMonkey-shaped gap: customer-facing `/terms` and `/privacy`,
      required checkbox on `/sign-up` ("I have read and agree to the Terms
      of Service and Privacy Policy", both linked), marketing
      footer links, Settings → Help & about, Stripe Checkout terms URL.
      Cookie/PECR: no separate banner while PostHog stays cookieless
      (EDGE-35); fold cookies into Privacy §9. Pages are live on
      production. Solicitor sign-off stays if an EDGE-8 trigger fires. We do **not** copy OddsMonkey's
      "aggregator licensed by the GC" line: we are software, not an
      operator aggregator (see `docs/legal/gambling-licence-assessment.md`).
      Sibling: EDGE-66 public `/contact` and `/refund`. Gibraltar
      incorporation is **not** required (assessment §9, 16 Aug 2026).
- [ ] **ICO registration** — self-assessment 17 Aug: no fee until trading
      starts. Retake then (~£40/yr). Production is already live.
- [x] **Company form** — sole trader: Sam Hayter trading as Edgeways
      (EDGE-15, 17 Aug). Ltd later if revenue or liability justifies.
- [ ] **Trademark** — UK IPO search 19 Aug 2026 (EDGE-10, on hold). Hit:
      UK00004101707 EDGEWAYS, registered, Class 9 betting/gambling software,
      owner Rational Intellectual Holdings (Flutter). No filing, no rename.
      Rely on use until a letter or paid-ads / app-store scale. Not legal
      advice. Social handles: EDGE-70 / `docs/strategy/social-presence.md`.
- [x] **API ToS re-reads** (§7.6) — done 10 Aug (EDGE-16 + EDGE-14):
      `docs/legal/api-terms-review.md`. Personal own-key use is clear for
      Sam's desk. **Hosted product is operator-held keys (D7, 22 Aug 2026):**
      subscribers never bring keys. Pooled feeds need written permission
      (EDGE-45, now on the go-live path; D6 is done). Betfair live/delayed
      prices for subscribers need a Flutter commercial path, not a customer
      app-key field.

*Not legal advice — the assessment file documents our own analysis; a
solicitor reviews it if a trigger fires.*

## 5. Pre-launch readiness checklist

Product-side items that must be true before charging strangers, mapped to the
roadmap items that deliver them:

- [x] **Entitlement enforcement (EDGE-22/83)** — real server-side enforcement
      replaced the "preview as" switch; every feed route guarded server-side
      (fails closed). Verified 25 Aug.
- [x] **Billing rehearsal (EDGE-7)** — automated end-to-end test-mode
      rehearsal (`npm run billing:rehearsal`): catalogue audit, webhook drill,
      unit tests, manual click-through checklist. Fully tested 25 Aug.
- [x] **Data custody (E3)** — shipped: WAL-safe backup, staged restore with
      pre-restore safety copy, CSV import (Settings → Data & API). Verified
      against brief E3 during the 10 Aug reconciliation; EDGE-30 closed.
      22 Aug: dropped the "one local file" claim from the card copy (false on
      the hosted desk). EDGE-47 remainder **done 22 Aug**: the hosted desk
      backs up to a user-scoped JSON bundle (offers, accounts, bets, ledger,
      history — same snake_case shape as the SQLite dump, so a localhost
      export restores onto the preview and vice versa) and restores it
      insert-first / delete-old-last (`neon-http` has no interactive
      transactions; a failed insert leaves the desk untouched, a failed
      delete leaves duplicates a re-run clears). The Settings card adapts on
      `hostedDesk`: `.db` download hidden, JSON-only restore, apply re-posts
      the file body (no staged token on Vercel). Restore drill on the
      preview: Settings → Data & API → Download backup (JSON), then Restore
      from backup… with that file — preview shows per-table counts, apply
      replaces the hosted desk.
- [x] **Demo mode (G2)** — shipped: separate `edgeways-demo.db` behind a marker
      file, atomic seed, DEMO DATA watermark, Settings card. EDGE-31 closed.
- [x] **Access & keyboard polish (G4)** — switch names, reduced motion,
      keyboard guide, daily chords + `?` sheet (EDGE-78, 22 Aug), and
      measured contrast (EDGE-32, 21 Aug): `--profit`, ink focus ring,
      warning/destructive/success tokens, marketing destructive remap.
      Custom Appearance accents were not measured. Settle-focused-bet
      leftover is EDGE-79.
- [x] **Legal surfaces (EDGE-61)** — `/terms` and `/privacy` live on
      production; `/sign-up` collects consent; footer and Settings link the
      same pages. Solicitor sign-off of those pages if an EDGE-8 trigger
      fires.
- [x] **Support channel** — EDGE-34 decided **email** (`support@` / `hello@`).
      Public `/contact` and `/refund` shipped (EDGE-66). In-app feedback
      remains for product bugs. No live-chat widget before launch.
- [x] **Settings → Data & API tab (EDGE-80)** — done: the split shipped. Feed
      diagnostics and test buttons live on the **Integrations** tab, gated
      server-side by `/api/admin/session` (fails closed: non-admins and fetch
      errors both get `admin: false`, and the tab never renders). Backup/restore
      is a separate customer-visible **Data & backup** tab. Verified in code
      25 Aug (`settings/page.tsx`, `use-admin-session.ts`).
- [~] **Status & comms** — release notes page exists (`/roadmap` in-app:
      "What's shipped, what's in progress"). Incident/comms norm consciously
      deferred 22 Aug: it only becomes owed once the feed proxy (§7.2,
      post-EDGE-45) makes us responsible for other people's data. Revisit at
      Edge tier build, not before launch.
- [x] **Error tracking** — live 10 Aug (EDGE-35): PostHog EU (org `Edgeways`,
      project `Edgeways app`), `src/instrumentation-client.ts` with cookieless
      `always`, autocapture off, exception capture on, events proxied through
      `/ingest` (ad-blocker safe). Server-side lock-down: replay, heatmaps,
      console capture and autocapture all off; IPs anonymised. MCP connected
      via OAuth. Spiking issues auto-file to Linear (PostHog-native alert);
      new-issue triage via the MCP loop per §2.2.
- [~] **Onboarding** — G2 setup wizard shipped (bank → bookies → defaults →
      alerts). Oddsmonkey research (16 Aug) adds profile questions + monthly
      target slider (EDGE-62 ✓), empty-desk welcome (EDGE-63 ✓), landing honesty
      (EDGE-64 ✓). 22 Aug: hosted first-run path verified end to end on the
      preview (sign-in → 18+ gate → setup). Remaining, both M2 not launch
      blockers: Oddsmonkey/Outplayed profit import (EDGE-68, needs a real CSV)
      and one stranger click-through (EDGE-33). Plan:
      `docs/strategy/oddsmonkey-onboarding-research.md`. Import spec:
      `docs/strategy/platform-import.md`.

### 5.1 Offer inbox go-live (email forwarding)

Phase 1 shipped 4 Sep 2026: per-desk `offers+<token>@<inbox-domain>`
addresses, `/api/offers/inbound` webhook (Svix signature verify, Message-ID +
content-fingerprint dedup, 50/day cap, 12-month receipt-log retention),
Settings → Automation card, privacy policy updated. Verified end to end on
localhost against the Neon desk. **Admin-gated rollout (5 Sep):** the card,
settings API and webhook ingest all require an operator admin account on
hosted desks (`offerInboxAvailable` / `isOfferInboxAllowed`); Admin → Users
is the control surface, non-admin addresses drop silently. Relax the gate
when the feature opens to everyone. To take it live:

- [ ] **Resend: enable receiving** — Domains → the verified edgeways.app
      domain → Receiving → enable. Resend shows the MX record to add.
- [ ] **DNS: one MX record** on the inbound subdomain (e.g.
      `in.edgeways.app`, priority 10, value from the Resend dashboard). A
      subdomain keeps existing email untouched. Back in Resend: "I've added
      the record" → wait for verified.
- [ ] **Resend: add webhook** — Webhooks → Add → URL
      `https://<prod-host>/api/offers/inbound`, event `email.received`. Copy
      the signing secret (`whsec_…`).
- [ ] **Vercel env (production):** `EDGEWAYS_INBOUND_DOMAIN=in.edgeways.app`
      (must match the MX subdomain), `EDGEWAYS_INBOUND_WEBHOOK_SECRET=whsec_…`.
      `RESEND_API_KEY` is already set and is reused — the webhook is metadata
      only, so the route fetches the body from the Resend Receiving API.
      Without the secret, production refuses inbound mail (503).
- [ ] **Smoke test:** enable the inbox on a hosted desk (Settings →
      Automation), forward a real bookmaker offer email to the address,
      confirm a Planned draft lands on Offers with the alert + push.
- [ ] **Local tunnel test (optional):** ngrok → `http://localhost:3000`, add
      the tunnel URL as a second webhook endpoint in Resend to rehearse
      against the local desk.

Phase 2 (zero-tap) started 4 Sep 2026: PWA Share Target shipped — installed
app appears in the OS share sheet, shared text lands on `/share`, parses
through `parseOfferFromText` and saves as Planned with `source: "share"`.
Remaining Phase 2: auto-forward wizard, Gmail verification-link
auto-confirm. Phase 3 (intelligence) not started.

## 6. Linear structure (created 10 Aug 2026)

Initiative: **Live Readiness** (target 2 Nov 2026). Team `Edgeways` (key EDGE).
Milestones in every project: M1 Gate-ready (6 Sep) · M2 Beta (4 Oct) · M3 Launch
(2 Nov). Cycles: 1 week + 1 week cooldown from 17 Aug, 6 auto-created.

Cycle plan (assigned 10 Aug; every open ticket now sits in a cycle except
EDGE-43, deliberately deferred until feedback volume exists):

> **Progress note (4 Sep 2026):** production is the live app (launch homepage
> + open desk), ahead of the original M3 date. 25 Aug note still holds for
> the build tickets. Do not plan a `SITE_SURFACE=app` flip; it already happened.

| Cycle | Dates | Theme | Tickets |
|-------|-------|-------|---------|
| C1 | 17–24 Aug | Sam's foundation week: decisions, accounts, legal emails | EDGE-1, 2, 8, 9, 10, 18, 23, 24, 46 |
| C2 | 31 Aug–6 Sep | M1 buffer — processor/solicitor replies land | (spillover from C1) |
| C3 | 14–20 Sep | M2 build 1: Neon+migrations, auth provider, landing build, provider emails, legal drafts finalised + public pages | EDGE-11, 12, 15, 19, 25, 45, 47, 48, **61** |
| C4 | 28 Sep–4 Oct | M2 build 2: sign-in, handoff, billing build, waitlist+countdown+SEO, beta community, gate evidence, nightly sweep | EDGE-3, 4, 5, 20, 21, 26, 27, 28, 29, 33, 36, 41 |
| C5 | 12–18 Oct | Launch prep: dunning, billing rehearsal, enforcement, contrast audit, support surface, hygiene scrub | EDGE-6, 7, 22, 32, 34, 49 |
| C6 | 26 Oct–2 Nov | Launch week: full checklist pass | EDGE-37 |

| Project | Scope | Issues |
|---------|-------|--------|
| Payments & Billing | Acceptance → L1 → checkout/webhooks → live | EDGE-1…7 |
| Compliance & Legal | Solicitor, ICO, trademark, ToS, privacy, 18+, API ToS, provider permissions, public legal pages + signup consent | EDGE-8…16, 45, 61 |
| Entitlements & Accounts | N0 matrix, D6, auth, sign-in, enforcement, hosted DB | EDGE-17…22, 47 |
| Marketing Site & Waitlist | Domain/hosting, landing, waitlist, countdown, SEO, beta, Vercel | EDGE-23…29, 46 |
| Launch QA & Polish | E3, G2, G4, onboarding, support, evidence, checklist, health, hygiene | EDGE-30…37, 48, 49 |

## 7. Anticipated costs (11 Aug 2026)

Confirmed figures where known, honest ranges elsewhere. Processing fees are
per-sale, not fixed costs. API feed COGS only starts when the Edge tier ships
(post-EDGE-45) and is designed to be covered by Edge revenue (§7.2).

### One-off, pre-launch

| Item | Cost | Ticket | Notes |
|------|------|--------|-------|
| Domain `edgeways.app` (year 1) | **paid ✓** | EDGE-23 | GoDaddy registrar; DNS may use Cloudflare |
| ICO data protection fee | ~£40/yr | EDGE-9 | Self-assessment 17 Aug: not due until trading starts |
| Solicitor (only if triggered) | £0 now · £150–750 if triggered | EDGE-8 | Re-scoped 11 Aug: evidence file drafted; letter only if Stripe/bank or EDGE-45 trigger fires |
| Trademark "Edgeways" (UK IPO) | £170 (+£50 per extra class) | EDGE-10 | Classes 9 + 42 = £220; optional but cheaper than a second forced rename |
| **Pre-launch total** | **~£270** | | ICO + trademark + domain, all near-certain; +£150–750 only if a solicitor trigger fires |

### Monthly run-rate at launch

| Item | Cost | Ticket | Notes |
|------|------|--------|-------|
| Vercel Pro | ~£20/mo | EDGE-46 | Team `edgeways` on Pro trial (11 Aug); ~$20/seat after trial |
| Neon Postgres | £0 → ~£15–19/mo | EDGE-47 | Free tier covers beta; Route 1 unlocked 11 Aug |
| PostHog EU | £0 | done | Free allowance covers launch scale (1M events/mo) |
| Transactional email (Resend) | £0 | EDGE-26 | Domain verified Ireland eu-west-1 (11 Aug); form still M2 |
| Uptime monitor | £0 | EDGE-48 | Free tier |
| Auth (Clerk/Supabase/Auth.js) | £0 | EDGE-19 | Free tiers cover 10k+ MAU; Auth.js is £0 self-hosted |
| Support / human email | ~£3.20/mo | EDGE-34 | Zoho Mail Standard — `sam@` + aliases `hello@`, `support@` |
| **Run-rate** | **~£20–39/mo** | | Before processing fees |

### Per-sale (only when money moves)

| Stack | Fee | On a £9.99 Core month |
|-------|-----|----------------------|
| Stripe direct | ~1.5% + 25p (UK) | ~£0.40 |
| Merchant of Record | ~5% + 50p | ~£1.00 (but absorbs all VAT admin) |

### Edge-tier COGS (post-launch, permission-gated)

| Item | Cost | Ticket |
|------|------|--------|
| The Racing API (Basic/Standard) | ~£25+/mo | EDGE-45 |
| API-Football Pro | ~£15/mo | EDGE-45 |
| Betfair Software Vendor Licence | £1,499 one-off + security certification | EDGE-14 — only if exchange integration ships hosted |
| Pooled-feed target | £2–6/mo total at 50–100 subscribers (§7.2) | design goal |

### Parked (native apps, post-launch)

Apple Developer $99/yr · Google Play $25 one-off — only when the TWA/Capacitor
wrappers happen.

**Bottom line:** ~£270 to the launch gate (+£150–750 only if a solicitor
trigger fires), then ~£20–39/mo before
per-sale fees. The first Core subscriber (£9.99/mo) covers a third to a half
of the monthly run-rate; three subscribers cover it all.
| Feedback & Automations | Migration, triage loop, hooks, sweeps, errors → Linear | EDGE-38…43 |

Cycle 1 (17–23 Aug): EDGE-1, 2, 8, 9, 17, 18, 23, 24, 38, 39, 40.

## 7. Decisions log (open, oldest first)

| # | Decision | Options | Due |
|---|----------|---------|-----|
| L1 | Processor | **Decided 15 Aug 2026: Stripe direct** (EDGE-2). EDGE-1 emails skipped. VAT not included on homepage until registered. Test catalogue live 15 Aug (EDGE-3). | — |
| L2 | Architecture route | Route 1 hosted (D6 lean) / Route 2 local-first + paid sync | Formal at F4 (EDGE-18) |
| L3 | Linear structure | **Decided 10 Aug 2026:** initiative + 6 projects, M1–M3, 1-week cycles | — |
| L4 | Support surface | **Decided 12 Aug 2026: email** (`support@` / `hello@`, EDGE-34). Public `/contact` page is EDGE-66. No live chat at launch. | — |
| L5 | Trademark registration | **19 Aug 2026: rely on use for now.** Search found UK00004101707 EDGEWAYS (Flutter IP). No DIY filing. Revisit if a letter arrives or before paid scale (EDGE-10, Backlog). | On hold |
| L6 | D1 gate | **Opened for launch-path work 10 Aug 2026**; criteria tracked as evidence (EDGE-36) | — |

---

*Feeds into: `product-roadmap.md` §7 (business path), N0 brief, F0–F4 phases.
Review this file whenever the D1 gate is revisited.*
