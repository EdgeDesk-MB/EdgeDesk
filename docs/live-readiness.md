# Live readiness — Edgeways

> What stands between today and a paying, compliant, automated product.
> Strategy lives in `edgeways/docs/roadmap/product-roadmap.md` (§7 business path);
> this file is the operational wrapper: automation setup, payments, legal, and the
> pre-launch checklist. Nothing here overrides the D1 gate (§7.1) — most items are
> "prepare now, flip at the gate".
>
> Infrastructure (hosting, database, environments, go-live hygiene):
> `docs/hosting-and-environments.md`. Architecture decision brief:
> `docs/decisions/d6-architecture-route.md` (EDGE-18).

**Status snapshot (2026-08-10):** the D1 gate was **opened for launch-path work** by
Sam on 10 Aug 2026 — the three gate criteria (§7.1) remain tracked as evidence
(Linear EDGE-36), not blockers. Work is planned and tracked in Linear: initiative
**[Live Readiness](https://linear.app/samhayter/initiative/live-readiness-acfb04f89e8c)**
(team `Edgeways`, key `EDGE`), six projects, milestones M1 Gate-ready (6 Sep) →
M2 Beta (4 Oct) → M3 Launch (2 Nov), 1-week cycles from 17 Aug. Product is a single
unlocked local app; N0 entitlement scaffolding is promoted.

## 1. The path, in order

1. **Now → M1 (6 Sep):** foundation decisions and cheap legal: N0 matrix, D6 formal
   decision, processor acceptance, solicitor, ICO, trademark search, domain/hosting,
   feedback triage dogfooded. (Cycle 1 issues are in Linear.)
2. **M1 → M2 (4 Oct):** auth + sign-in, billing in test mode, ToS/Privacy drafted,
   18+ gate, waitlist + countdown live, E3/G2/onboarding done.
3. **M2 → M3 (2 Nov):** real entitlement enforcement, live charges, legal sign-off,
   a11y sweep, full pre-launch checklist pass.
4. **Post-launch:** §7.3 oddsmatching bridge stays staged; Elite tier (§7.5) only
   once Edge revenue funds it.

## 2. Automation setup

Harness reference: `docs/cursor-daily-guide.md` §"Automations". Repo is on GitHub
(`EdgeDesk-MB/EdgeDesk` — note D4/D7: org rename to Edgeways-MB pending), so
cloud Cursor Automations are available once MCPs are authed.

### 2.1 Feedback → Linear (first automation to build)

The pipeline already exists in-app: `/feedback` → `src/app/api/feedback/route.ts`
→ `feedback_reports` table (kind = bug/idea/other, summary, details, diagnostics,
created_at). What is missing, in order:

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
- [ ] **Promote when boring.** Once draft quality is consistently right, move to a
      local script on launchd/cron calling the Linear API directly (data is local
      SQLite — a cloud automation cannot reach it). Cloud webhook automation only
      becomes possible if feedback gains a hosted endpoint post-D6. → **EDGE-43**

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

Pricing intent already drafted in §7.5 (Free £0 / Core ~£9.99 / Edge ~£24.99,
annual ≈ 2 months free, 14-day Edge trial). What the roadmap does not yet cover:

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
- [ ] **Solicitor confirmation that no gambling licence is needed** (§7.6 — the
      product never takes a wager; confirm anyway, in writing).
- [~] **Terms of Service** — drafted 10 Aug (`docs/legal/terms-of-service.draft.md`,
      EDGE-11): subscription terms (renewal, cancellation, refund, trial),
      no-guarantee-of-profit disclaimer, "not gambling advice", user
      responsible for bookmaker/exchange ToS compliance, limitation of
      liability. Awaits Sam's read, then solicitor (EDGE-8). Placeholders:
      entity, contacts, VAT wording (depends on EDGE-2).
- [~] **Privacy Policy + UK GDPR** — drafted 10 Aug
      (`docs/legal/privacy-policy.draft.md`, EDGE-12), leading with local-first
      ("betting records never leave your device"). Lawful bases, retention,
      subject rights, processor table. Awaits Sam's read, then solicitor
      (EDGE-8). Placeholders: entity, ICO number (EDGE-9), processor details
      (EDGE-2/23/35).
- [ ] **ICO registration** — data-protection fee (~£40/yr) for a UK sole trader
      processing personal data. Cheap, mandatory, easy to forget.
- [ ] **Company form** — sole trader is fine to start; Ltd when revenue or
      liability justifies. Affects contracts, banking, and tax.
- [ ] **Trademark** — D7 renamed EdgeDesk → Edgeways after a clash. Before launch:
      UK IPO search + consider registering "Edgeways"; confirm edgeways.app and
      social handles are secured (Sam handles, per D7).
- [x] **API ToS re-reads** (§7.6) — done 10 Aug (EDGE-16 + EDGE-14):
      `docs/legal/api-terms-review.md`. Personal own-key use is clear for all
      three providers; pooled subscriber feeds need written permission
      (EDGE-45, post-D6); Betfair exchange integration in hosted software
      points at the Software Vendor Licence (£1,499 + certification), BYOK
      recommended.

*Not legal advice — the solicitor conversation is a checklist item, not a
replacement for one.*

## 5. Pre-launch readiness checklist

Product-side items that must be true before charging strangers, mapped to the
roadmap items that deliver them:

- [x] **Data custody (E3)** — shipped: WAL-safe backup, staged restore with
      pre-restore safety copy, CSV import (Settings → Data & API). Verified
      against brief E3 during the 10 Aug reconciliation; EDGE-30 closed.
- [x] **Demo mode (G2)** — shipped: separate `edgeways-demo.db` behind a marker
      file, atomic seed, DEMO DATA watermark, Settings card. EDGE-31 closed.
- [~] **Access & keyboard polish (G4)** — shipped scoped (switch names, reduced
      motion, keyboard guide). Remaining: measured contrast audit in both
      themes → EDGE-32 (M3).
- [ ] **Support channel** — feedback form exists; decide the public support
      surface (email / Discord / Linear triage cadence).
- [ ] **Status & comms** — release notes page exists; add an incident/comms norm
      once the feed proxy (§7.2) makes you responsible for other people's data.
- [x] **Error tracking** — live 10 Aug (EDGE-35): PostHog EU (org `Edgeways`,
      project `Edgeways app`), `src/instrumentation-client.ts` with cookieless
      `always`, autocapture off, exception capture on, events proxied through
      `/ingest` (ad-blocker safe). Server-side lock-down: replay, heatmaps,
      console capture and autocapture all off; IPs anonymised. MCP connected
      via OAuth. Spiking issues auto-file to Linear (PostHog-native alert);
      new-issue triage via the MCP loop per §2.2.
- [~] **Onboarding** — G2 setup wizard shipped and verified on a fresh DB.
      Remaining: validate with first external users during beta → EDGE-33 (M2).

## 6. Linear structure (created 10 Aug 2026)

Initiative: **Live Readiness** (target 2 Nov 2026). Team `Edgeways` (key EDGE).
Milestones in every project: M1 Gate-ready (6 Sep) · M2 Beta (4 Oct) · M3 Launch
(2 Nov). Cycles: 1 week + 1 week cooldown from 17 Aug, 6 auto-created.

| Project | Scope | Issues |
|---------|-------|--------|
| Payments & Billing | Acceptance → L1 → checkout/webhooks → live | EDGE-1…7 |
| Compliance & Legal | Solicitor, ICO, trademark, ToS, privacy, 18+, API ToS | EDGE-8…16 |
| Entitlements & Accounts | N0 matrix, D6, auth, sign-in, enforcement | EDGE-17…22 |
| Marketing Site & Waitlist | Domain/hosting, landing, waitlist, countdown, SEO, beta | EDGE-23…29 |
| Launch QA & Polish | E3, G2, G4, onboarding, support, evidence, checklist | EDGE-30…37 |
| Feedback & Automations | Migration, triage loop, hooks, sweeps, errors → Linear | EDGE-38…43 |

Cycle 1 (17–23 Aug): EDGE-1, 2, 8, 9, 17, 18, 23, 24, 38, 39, 40.

## 7. Decisions log (open, oldest first)

| # | Decision | Options | Due |
|---|----------|---------|-----|
| L1 | Processor | Stripe direct / Paddle / Lemon Squeezy / Polar — after written acceptance | Before F4 build (EDGE-1, EDGE-2) |
| L2 | Architecture route | Route 1 hosted (D6 lean) / Route 2 local-first + paid sync | Formal at F4 (EDGE-18) |
| L3 | Linear structure | **Decided 10 Aug 2026:** initiative + 6 projects, M1–M3, 1-week cycles | — |
| L4 | Support surface | Email / Discord / in-app only | Pre-launch (EDGE-34) |
| L5 | Trademark registration | Register "Edgeways" (UK IPO) or rely on use | Pre-launch (EDGE-10) |
| L6 | D1 gate | **Opened for launch-path work 10 Aug 2026**; criteria tracked as evidence (EDGE-36) | — |

---

*Feeds into: `product-roadmap.md` §7 (business path), N0 brief, F0–F4 phases.
Review this file whenever the D1 gate is revisited.*
