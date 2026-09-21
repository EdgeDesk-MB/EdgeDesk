# Strategy digest (for automated ticket triage)

last_reviewed: 2026-09-21
status: DRAFT, awaiting Sam's review

This is a compact, citable index of Edgeways strategy, built for the n8n alignment gate. It is not a source of truth. When it disagrees with a source file, the source wins and this file is stale. Cite entry IDs (V1, NG3, D7 and so on). Status entries (BT and RK) go stale fastest: check their review_by date and verify against `edgeways/docs/roadmap/product-roadmap.md` section 6 and Linear (team EDGE).

ID prefixes: V vision, PR principle, NG non-goal, HR hard engineering rule, D decision (same numbers as the roadmap Decision Log), T and CM commercial, GR growth, PX process rule, RT routing hint, BT current bet, RK risk. Note the roadmap also uses P1 to P19 for phases and A to L for tracks; those are not digest IDs.

## Vision

- V1: Edgeways is the execution and truth layer for matched betting, not an offer-discovery tool. Tagline: "the P&L desk for matched bettors, know your real edge." (product-roadmap.md section 1)
- V2: The product exists to answer three daily questions. Q1: what should I do next? Q2: am I executing correctly (pipeline Planned, Qualifying, Awaiting, Awarded, Converting, Settled; no naked exposure; no expired free bets)? Q3: did it actually pay (retained P&L after commission and voids, expected versus realised)?
- V3: It supplements the finders (OddsMonkey, Outplayed) and replaces the spreadsheet. North-star principle: surface EV and the user's edge, and be honest about how confident each number is. Flagship metric: EV capture rate.

## Principles

- PR1: Result-centric, not bet-centric. Record the real-world result; the app derives every market outcome and settles linked bets.
- PR2: Edge everywhere. Calculators and tracked bets show implied probability, fair (no-vig) odds, EV and edge %, with provenance and confidence.
- PR3: Live by default, manual as fallback. Anything feeds cannot cover degrades to manual entry and never blocks the workflow.
- PR4: `--edge` violet is the Offer Edge and pro signature; amber is caution only. Follow existing design tokens and shadcn patterns, no ad-hoc colours (D5).
- PR5: Mobile means simplified on-the-go logging and alerts as a responsive PWA (D3).

## Non-goals (hard no list)

- NG1: No arbitrage or Kelly criterion features.
- NG2: No web scraping of bookmakers or odds.
- NG3: No oddsmatching or offer discovery at launch, possibly never (D2). The Match Checker checks a match the user found; the moment it browses or ranks markets it is an oddsmatcher.
- NG4: No Tauri packaging yet. Native app stores are deferred (D3).
- NG5: No customer API-key fields, ever. Feeds are operator-held, never BYOK (D7).
- NG6: No heavy OCR beyond the existing bet-slip import.
- NG7: No new dependencies without flagging them first.
- NG8: Customer-facing copy never names a data provider. Feeds are "racing feed", "football feed", "exchange feed" (D8).
- NG9: No new paid provider account or sport adapter before its phase trigger (D9). No stacked per-sport subscriptions pre-revenue.
- NG10: No live pooled Betfair prices, and no personal Betfair key ever fanned out. Delayed data only until a funded licence exists (D8).
- NG11: Do not revert production to waitlist mode (`SITE_SURFACE=app`, `LANDING_VARIANT=launch`).
- NG12: No second public price on the homepage. Founding terms and feedback credits stay off public cards (subscriptions.md).

## Hard engineering rules

- HR1: The hosted desk is Neon. Never ship a customer mutation that writes SQLite when `isNeonDesk()`; dual-path it or return 400. `hosted-desk-cutover.test.ts` must stay green.
- HR2: Never weaken or delete a passing calc or settlement test to make code pass. Changing calc output requires adding or adjusting a test.
- HR3: Money maths is exact. No floating-point shortcuts in stake, lay or commission logic.
- HR4: Do not refactor `src/lib/calc/ep/engine.ts` (spec-locked). Adding consumers is fine.
- HR5: Sport day-cards are store-first. Cron warms shared rows; desks read Edgeways, never the provider. New sports copy `fixture-store` and `racecard-store`.
- HR6: Pre-flight is mandatory before code: list files and approach, read section 0 of `implementation-briefs.md`, read `offer-command-centre.md` and the calc tests for calc work, read `design-system.md` for UI work. Smallest diff that satisfies the task.
- HR7: British English. Commas, never em dashes.
- HR8: Run npm commands from `edgeways/`, not the git root.
- HR9: Derive market outcomes from the recorded result; do not hardcode them.

## Decisions (canonical in product-roadmap.md, Decision Log)

- D1 (2026-07): Product-for-me first, business second. The business gate opened 2026-07-16.
- D2 (2026-07): No oddsmatching at launch, possibly never. A staged bridge exists in roadmap section 7.3 and only moves if Edge-tier revenue funds it and users demand it.
- D3 (2026-07): Mobile is a responsive PWA. Native app stores deferred.
- D4 (2026-07): GitHub org and repo naming is a standing constraint. The roadmap names `Edgeways-MB/Edgeways`; the current git remote is `EdgeDesk-MB/EdgeDesk` and the rename is outstanding (EDGE-143).
- D5 (2026-07-31): `--edge` violet is the pro signature. D5b (2026-08-04): renamed EdgeDesk to Edgeways after a trademark clash.
- D6 (2026-08-11, EDGE-18): Route 1, hosted multi-tenant. Reverse only if privacy positioning becomes the lead marketing story.
- D7 (2026-08-22): Operator-held feeds. The customer brings money; Sam brings every provider account. BYOK is rejected and agents must never offer it.
- D8 (2026-08-23): Staged licensing, comply-on-contact. Launch pooled feeds without written redistribution permission; if a provider makes contact, comply within days and open the licensing conversation from revenue. Permission emails stay unsent. The first ~£1,000 of MRR is the licensing reserve.
- D9 (2026-08-26): Multi-sport feeds. Racing and football at launch; then tennis, golf, greyhounds, then NFL, darts, snooker, cricket, each funded by Edge revenue and shipped with a cap and a monitor. Phase 1 uses the Betfair catalogue at no extra cost (EDGE-88). Sustained Watch state (70% of cap) is the upgrade trigger.

## Commercial model

- T1: Tiers locked 2026-08-12. Free £0 (calculators, manual log, basic P&L, demo Racing Desk). Core £9.99/month or £99.90/year (pipeline, Do Next, Edge Report, tracker, free-bet lots). Edge £24.99/month or £249.90/year (Offer Edge, live Racing Desk feeds, football live card, 2UP sentinel with push, exchange integration). 14-day Edge trial, one per person. Gate features by data cost and edge delivered. Stripe direct.
- T2: An Elite tier with direct exchange connections is only under consideration, and only once Edge revenue funds it.
- CM1: Pooled feeds keep COGS around £2 to £6 a month at 50 to 100 subscribers. Cost scales with distinct events tracked, not users.

## Growth and positioning

- GR1: Never compete with finders on "we find offers". Win on "your day, run properly, with proof it paid".
- GR2: Paid acquisition is effectively unavailable for gambling-adjacent products. Word of mouth in r/MatchedBettingUK and Discord communities is the channel, supported by referrals (EDGE-67, double-sided, one-time, non-cash) and content on "matched betting tracker, spreadsheet, EV" terms. Targets are the first 10, 100 and 1,000 paying customers.
- GR3: Platform CSV import (OddsMonkey first, then Outplayed, EDGE-68) is a launch feature so finder users can bring their history.

## Process rules

- PX1: `product-roadmap.md` is canonical and wins over older docs. `docs/PLAN.md` is superseded origin context.
- PX2: New feature ideas are never scheduled directly. They land in roadmap section 9 (Future ideas) first and are promoted into a phase only after Sam has reviewed them. A decided no is recorded too.
- PX3: Product scope or roadmap tasks are planning work. Agents stop and defer to the planning flow; no code.
- PX4: Statuses flip in roadmap section 6 the day a phase lands. Work is tracked in Linear (team EDGE; Live Readiness initiative; Post-Launch Desk and Live Sport project).

## Routing hints for executors (from AGENTS.md and docs/Local-vs-Cloud-Model-Strategy.md)

- RT1: Calc or settlement changes need a frontier model plus `/calc-change` plus audit, never local-unreviewed.
- RT2: Bounded, mechanical edits suit the local model or `/delegate-local`.
- RT3: Routine cloud agent work uses the Cursor Models lane; serious multi-file runs use the volume frontier lane; architecture, hard bugs, calc review and prose use the peak lane; long autonomous loops use Claude Code.
- RT4: UI work reads `design-system.md` first, and `design/AGENTS.md` is binding before any design or canvas work.

## Current status and open items (review_by 2026-10-05)

- BT1: Production is the live app since 2026-09-04 (edgeways.app; Clerk auth, Stripe billing, per-user Neon desk). Roadmap phases 1 to 19 are marked done except the remainder of Phase 19.
- BT2: Football live card (Phase 19). Phase 1 shipped 2026-09-11 (EDGE-128). Phase 1b HT/FT auto-settle (EDGE-141, needs `/calc-change`), Phase 2 and Phase 3 are outstanding.
- BT3: Tennis and golf via the Betfair catalogue at no extra cost (D9 Phase 1, EDGE-88).
- BT4: GitHub org and repo rename outstanding (EDGE-143).
- RK1: The Betfair commercial data licence is unresolved and blocks Edge-tier live lays.
- RK2: iOS PWA push has never been tested on real hardware. Android was verified 2026-07-14.
- RK3: Launching feeds without redistribution permission is an accepted risk under D8. Worst case is a cease-and-desist and account closure, mitigated by degrade paths and the licensing reserve.

## Source map (read on demand, by section; do not load whole)

| Topic | File |
| --- | --- |
| Canonical plan, decision log, sequencing, tiers | `edgeways/docs/roadmap/product-roadmap.md` (about 87 KB) |
| Implementation briefs and repo conventions (section 0) | `edgeways/docs/roadmap/implementation-briefs.md` (about 191 KB) |
| Agent rules and pre-flight | `edgeways/AGENTS.md`, `AGENTS.md` |
| Decision briefs | `docs/decisions/d6` to `d9` |
| Commercial terms | `docs/strategy/subscriptions.md` |
| Growth, referrals, platform import | `docs/strategy/growth-playbook.md`, `referrals.md`, `platform-import.md` |
| Competitive landscape | `docs/strategy/competitive-landscape.md` |
| Data feeds and API cost | `docs/strategy/api-dependencies-and-tiers.md` |
| Launch ops and hosting | `docs/live-readiness.md`, `docs/hosting-and-environments.md` |
| Legal | `docs/legal/` |
| Model routing | `docs/Local-vs-Cloud-Model-Strategy.md`, `docs/ai-playbook.md` |
| Design system | `edgeways/docs/design-system.md`, `edgeways/design/AGENTS.md` |
