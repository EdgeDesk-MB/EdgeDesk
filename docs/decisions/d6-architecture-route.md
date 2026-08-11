# D6 — Architecture route decision brief

> Prepared for EDGE-18, 10 Aug 2026. Decision owner: Sam. Record the outcome
> in `product-roadmap.md` D6 with the date. One read, one decision.

## The decision is narrower than it looks

Both routes need the **same server components**: accounts, billing,
entitlement enforcement, and the feed proxy (§7.2: one poller fanning out to
subscribers is what collapses API COGS from £50–100/user/mo to £2–6 total).
The only real question is: **where do users' betting records live?**

| | **Route 1 — hosted multi-tenant** | **Route 2 — local-first + paid sync** |
|---|---|---|
| Records live | Our Postgres/Turso | User's device (SQLite), sync via embedded replicas |
| Build delta from today | DB migration + tenant-scoping every table (touches everything) | Sync layer (contained) + thin accounts/billing server (greenfield, small) |
| Onboarding | A URL. Waitlist → countdown → sign up → in | Install/run step before any value (Tauri packaging needed for consumers) |
| Ops for a solo dev | One deployment, instant updates, one DB to back up | Per-user install support (the dev-server fragility we already manage), release-channel updates |
| Privacy story | "Never leaves your device" **dies**; fallback is EU hosting + export/delete + no data sale | Fully intact — and it's a genuine differentiator in this niche |
| UK GDPR surface | We become controller of gambling-adjacent financial records: DSARs, security, breach liability | Minimal — we never hold betting records (privacy policy draft §1 already written around this) |
| Feed proxy / BYOK | Identical either way (EDGE-45 permissions still required for pooled feeds; Betfair vendor licence either way) | Identical |
| Fits the launch motion | Yes — waitlist, countdown and "sign in from the website" all assume a URL | The CTA has to sell an install, not a login |

## What each choice changes downstream

**If Route 1:** EDGE-19 (auth provider) proceeds conventionally; privacy
policy §1 gets rewritten (hosted controller wording — solicitor pack, EDGE-8);
marketing drops "never leaves your device"; app hosting folds into the EDGE-23
hosting pick.

**If Route 2:** EDGE-19 becomes "accounts for sync/billing only" (smaller);
privacy policy stands as drafted; marketing leans hard on privacy; consumer
packaging (Tauri/signing) joins the critical path.

## Recommendation

**Route 1 (hosted)** — confirms the 2 Aug lean. The launch motion you're
building towards (waiting list, countdown timer, subscription tiers on a
website) is a URL-shaped funnel, and for a solo developer one hosted app is
cheaper to operate than hundreds of local installs. The privacy cost is real
but partially recoverable (EU hosting, self-serve export/delete, no data
sale), and the GDPR burden is manageable at waiting-list scale.

Reverse to Route 2 only if the privacy positioning is the marketing story you
want to lead with — it's the stronger differentiator and the smaller build,
but it makes the waitlist sell an install.

## Decision

- [x] **Route 1 — hosted multi-tenant** (recommended; confirms lean) — **decided 11 Aug 2026** (EDGE-18)
- [ ] **Route 2 — local-first + paid sync** (privacy-first fallback)

*Recorded in `product-roadmap.md` D6 and on EDGE-18. Unlocks EDGE-19 (auth) and EDGE-47 (Neon).*
