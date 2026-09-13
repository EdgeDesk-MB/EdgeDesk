# Edgeways, product vision

> **Status: superseded as a plan, kept as origin context.**
> Last corrected 13 September 2026 during an organisation audit.
>
> The canonical product plan is **`edgeways/docs/roadmap/product-roadmap.md`**.
> It wins over this file on every point. Implementation detail lives in
> `edgeways/docs/roadmap/implementation-briefs.md`; launch and ops in
> `docs/live-readiness.md`; the daily checklist in `docs/follow-this-plan.md`.
>
> This file previously described the original MVP build and still listed
> long-shipped features as "Phase 2 planned next". Agents were being pointed
> here for product vision and reading a plan that was roughly a year out of
> date, including two items the repo explicitly forbids. That has been removed.

## What Edgeways is

**The execution and truth layer for matched betting, not an offer-discovery tool.**

Matched bettors have three daily questions, and the product exists to answer them:

1. **What should I do next?** Offer ranking, next actions, time-ordered planning.
2. **Am I executing correctly?** The pipeline (Planned → Qualifying → Awaiting →
   Awarded → Converting → Settled), no naked exposure, no expired free bets.
3. **Did it actually pay?** Retained P&L after commission and voids, expected
   versus realised.

Incumbents (Outplayed, OddsMonkey) sell *discovery*. Nobody serves *execution
truth* well, and most serious matched bettors run spreadsheets. Edgeways owns
that niche: **"the P&L desk for matched bettors, know your real edge."**

## Product principles (unchanged since the first build)

1. **Result-centric, not bet-centric.** You record what happened in the real
   world (a 2-1 score), and the app derives every market outcome from it
   (BTTS = Yes, Over 2.5 = No, Home Win, 2UP triggered) and settles all linked
   bets automatically.
2. **Edge everywhere.** Every calculator and every tracked bet shows implied
   probability, fair (no-vig) odds, expected value and edge % against the
   exchange, and is honest about how confident each number is.
3. **Live by default, manual as fallback.** Events come from live feeds where
   possible; anything the feeds cannot cover degrades gracefully to manual
   entry, never blocking the workflow.

## Where the product actually got to

The original five phases plus Tracks E to G are shipped, and the business gate
opened. Production has been the live app since 4 September 2026:
`SITE_SURFACE=app`, `LANDING_VARIANT=launch` on https://edgeways.app, with
Clerk auth, Stripe billing, a hosted Neon desk per user, and Free / Core / Edge
tiers enforced server-side.

For what is done, in progress and next, read the roadmap §6 sequencing table.
Do not infer status from this file.

## Things this file used to get wrong

Recorded so the same mistakes are not reintroduced from an old copy:

- It called Edgeways a "working title". The name is settled (D5b rename, 4 Aug
  2026), the domain is owned, and the trademark position is documented.
- It listed **arbitrage and Kelly criterion** as planned work. `edgeways/AGENTS.md`
  forbids both by design. They are not coming.
- It listed Rule 4, the accumulator and multiples family, Refund-If, racing live
  results, the live in-play probability model and the full design-system pass as
  "Phase 2 planned next". All shipped.
- It described SQLite as the persistence story. That is true for the local desk
  only. The hosted desk is Neon Postgres, per-user, and shipping a customer
  mutation that writes SQLite on `isNeonDesk()` is a hard rule violation.
- It described Tauri packaging as planned. Still parked, deliberately.

## Architecture, current

See the roadmap's "Current architecture snapshot" for the maintained version.
In short: Next.js 16 App Router, TypeScript, shadcn/ui with NumberFlow and
Liveline, a pure Vitest-tested calc engine in `edgeways/src/lib/calc`, dual-mode
data (local SQLite, hosted Neon), and operator-held pooled feeds (D7) for racing,
football and the exchange.
