# Edgeways Product Roadmap & Execution Thinking

> **How to use this document.** This is the canonical product plan for Edgeways. It is written to be
> self-contained so it can be handed to any AI model or human collaborator with no other context.
> It records not just *what* to build but *how we reason through the hard trade-offs* (the
> "conundrums" sections). When a decision here conflicts with older docs, this document wins.
> Keep the Decision Log current.
> 
> Companion docs: `../../docs/strategy/api-dependencies-and-tiers.md` (API cost/tier detail),
> `docs/offer-command-centre.md` (offer pipeline spec), `docs/design-system.md`.

Last updated: 2026-08-12 (subscription offer locked — `docs/strategy/subscriptions.md`.
N0 matrix + Clerk/`app_users` exist; processor still EDGE-1/2.)

> **Roadmap hygiene.** This document is kept current as work ships: statuses flip in the §6 table
> the day a phase lands, and *new* feature ideas are never scheduled directly — they land in
> §9 (Future ideas) first and are only promoted into a phase after the user has reviewed them.

---

## 1. Product thesis

**Edgeways is the execution and truth layer for matched betting — not an offer-discovery tool.**

Matched bettors have three daily questions:

1. **What should I do next?** (offer ranking, next actions, time-ordered planning)
2. **Am I executing correctly?** (pipeline: Planned → Qualifying → Awaiting → Awarded → Converting → Settled; no naked exposure; no expired free bets)
3. **Did it actually pay?** (retained P&L after commission and voids; expected vs realized)

Incumbents (Outplayed \~£25/mo, OddsMonkey \~£30/mo) sell *discovery*: oddsmatchers, guides,
forums. Nobody serves *execution truth* well — most serious matched bettors run spreadsheets.
Edgeways owns that niche: **"the P&L desk for matched bettors — know your real edge."**

The north-star design principle across every feature: **surface EV and the user's edge**, and be
honest about how confident each EV number is.

### Strategic decisions (Decision Log)

| \\# | Decision                                                                                                                                                                                                              | Date       | Rationale                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Product-for-me first; business second.**                                                                                                                                                                            | 2026-07    | Personal daily value is the proving ground. Build personal-value features first; make architecture choices that don't foreclose multi-tenant later, but do NOT pay the multi-tenant tax up front.                                                   |
| D2  | **No oddsmatching at launch — possibly never.**                                                                                                                                                                       | 2026-07    | Full oddsmatching requires continuous odds polling across dozens of bookmakers (the incumbents' core cost). It only becomes viable if Edge-tier subscription revenue grows to fund it AND users demand it. See §7.3 for the staged bridge strategy. |
| D3  | **Mobile = simplified on-the-go logging + alerts, as responsive PWA.**                                                                                                                                                | 2026-07    | 70–80% of the product available on mobile, with progressive disclosure (collapse/hide) and a swipeable widget model on Home. Native app stores deferred (gambling-adjacent review friction + 15–30% cut).                                           |
| D4  | GitHub org is `Edgeways-MB` exclusively; repo `Edgeways-MB/Edgeways`.                                                                                                                                                 | 2026-07    | Standing constraint.                                                                                                                                                                                                                                |
| D5  | **`--edge` violet is the pro / Offer Edge signature.** Amber (`--warning`) is caution only. Free-bet Gift chrome stays on historical `violet-*` until a later tidy; do not conflate promo balance with modelled Edge. | 2026-07-31 | Race picks already used violet; recommended markers must not look like errors. Entitlement UI will reuse this token for Edge-tier chrome (see N0 brief).                                                                                            |
| D6  | **Architecture route: Route 1 (hosted multi-tenant) — formal.**                                                                                                                                                 | 2026-08-11 | Formalised 11 Aug (EDGE-18) after Vercel/Zoho/Resend stack stood up; confirms 2 Aug lean. Unlocks auth (EDGE-19) and Neon (EDGE-47). Privacy policy §1 needs hosted-controller rewrite.                                                              |
| D7  | **Renamed EdgeDesk → Edgeways** (lowercase "edgeways" wordmark). Chamfered-bolt placeholder mark; push titles lead with ⚡. "Offer Edge" tier + `--edge` violet unchanged.                                        | 2026-08-04 | Trademark clash forced a clean break from the EdgeDesk mark. "Edgeways" keeps the Edge language, owns the British idiom form, and the bolt gives notifications a native brand mark. Domain: edgeways.app (Sam handles). GitHub org/repo rename to follow. |

> D1 gate reviewed 2026-08-02: stays closed. Finalisation workstreams F0–F3 (land, brand, QA,
> entitlements) run first; the gate is revisited before F4.

### Current architecture snapshot (context for AI agents)

- Next.js 16 App Router, TypeScript, SQLite (better-sqlite3 + Drizzle), local-first single-user.
- Git root is the PARENT directory (`MB app build/`); all npm commands run from `edgeways/`.
- Key modules:
  - `src/lib/calc/ev.ts` — no-vig fair odds, expected value, edge % (pure, tested).
  - `src/lib/offers/advantage.ts` — remaining-EV estimator + advantage score (heuristic today).
  - `src/lib/offers/do-next.ts` — unified "Do next" queue (priority + edge sorts).
  - `src/lib/offers/pipeline.ts` — offer stage machine (Planned → … → Settled).
  - `src/lib/calc/ep/` — Early-Payout (2UP) engine, Poisson goal model, live P&L. Spec-locked; do not refactor without re-running test vectors.
  - `src/lib/services/racing-desk.ts` + `src/lib/racing-desk/types.ts` — Racing Desk with live/estimated exchange lays, `confidence: "live" | "mixed" | "estimate"` and `oddsSource` provenance.
  - `src/lib/offers/parse-offer-text.ts` — free-text offer T&C parser (large, tested).
  - Free-bet lots ledger in balances services (award → convert → retained cash).
- External feeds: The Racing API (racecards/results, tiered), API-Football (fixtures), Betfair exchange (lay prices). All keyed per-user today.

---

## 2. Track A — Sharpen the EV core (current features)

Theme: **the app estimates where it could measure, and shows EV without showing confidence.**
These are ordered; each unlocks the next.

### A1. Measured free-bet retention (replaces hardcoded 0.8) ✅ DONE

- **What:** `advantage.ts` uses `DEFAULT_FREE_BET_RETENTION = 0.8` and a `0.35` pre-qualification
  fudge. Compute the user's *actual* retention from settled free-bet conversions (award amount vs
  realized return, from the lots ledger + settled bets).
- **Why:** Every "£ remaining edge" number in Do Next and Best Advantage becomes personally honest.
  It is also the seed of the data moat (§7.4): the longer you use Edgeways, the smarter it gets.
- **How:**
  - New service `src/lib/services/retention.ts`: `realizedRetention(): { rate: number; sampleSize: number; window: "all" | "90d" }` over settled conversion bets joined to their originating lots.
  - Fall back to 0.8 when `sampleSize < 5`; blend (Bayesian shrink toward 0.8) for 5–15 samples.
  - Thread through `estimateOfferRemainingEv`; display "Your retention: 78% (23 conversions)" on Home and in offer detail.
- **Acceptance:** Do Next EV figures change when retention history changes; badge shows sample size; unit tests for the blend.

### A2. EV provenance badges app-wide ✅ DONE

- **What:** Racing Desk already tags EV with `confidence` + `oddsSource`. Extend a \`basis:
  "live" | "estimated" | "heuristic"`field through`OfferAdvantageScore`and`DoNextItem\`; render
  a small badge (dot + tooltip) wherever a £-EV is shown.
- **Why:** Trust. "£16 retained" from live exchange odds and from a heuristic guess must not look
  identical. This is the cheapest possible "surface the edge honestly" win.
- **How:** Add the field at the estimator (`advantage.ts` knows which branch produced the number);
  UI badge component reused from the Racing Desk confidence chip.

### A3. Expected-vs-realized: the EV Capture Rate (flagship metric) ✅ DONE

- **What:** Snapshot `expectedProfit` (and its basis) at the moment an offer transitions to
  Active — call it the **EV lock**. At Settled, diff against realized net P&L and decompose:
  commission drag, odds drift, voids, execution error. Show per-offer post-mortem line:
  *"Expected +£14.20 → Realized +£11.80 · 83% captured"*.
- **Why:** This IS question 3 ("did it actually pay") answered per-offer, and it powers every
  analytics feature downstream (A4, B7, B8). Today expectedProfit is mutable so the comparison is
  impossible — that's the gap.
- **How:**
  - Schema: `offer_ev_snapshots` table (offerId, lockedAt, expectedProfit, basis, inputsJson).
	 Write on Planned→Active transition in the pipeline service.
  - Settlement hook computes capture % and decomposition; store on the snapshot row.
  - Render in offer detail + history entry.
- **Conundrum — what counts as "expected"?** Offers evolve (user edits stake, odds move before
  placement). Rule: the lock happens at Active; edits after Active create a *new* snapshot version
  with a visible "re-locked" marker, and capture is measured against the latest lock. Never
  silently mutate.

### A4. "Edge on the table" as the Home hero ✅ DONE

- **What:** Home currently leads with balances/P&L. Lead instead with one number: \*\*"£47 of edge
  available today"\*\* = sum of `remainingEv` across actionable Do Next items, with the queue as its
  breakdown and provenance badges (A2) inline.
- **Why:** The app's promise in one glance. Also the anchor widget for the mobile swipe deck (§4).
- **How:** Mostly re-layout; the sum already exists in `do-next.ts`. Add a small sparkline of
  "edge captured this week" once A3 lands.

### A5. No-vig fair odds in the visible UI ✅ DONE

- **What:** `ev.ts#noVig()` is well-tested but invisible. Show overround/fair-odds context in the
  calculators and on Racing Desk runners ("2.5% over fair").
- **Why:** Direct edge-surfacing; the maths is already written and tested.

---

## 3. Track B — The three daily questions (future features)

### Question 1: "What should I do next?"

**B1. The Daily Plan (run-sheet, not a list). ✅ DONE**
Merge offers (expiry), racecards (off times), fixtures (kickoffs), and Do Next actions into a
single time-ordered schedule for today: "09:30 qual bet Bet365 → 13:35 Haydock race → 20:00 2UP
kickoff", each slot with expected £ and a deep link. All the data exists (offer calendar, racing
desk, fixtures); the work is a merge + a timeline view. This becomes the default mobile Home
widget in the morning.
*Conundrum — plan vs reality drift:* races get abandoned, odds move. The plan re-generates on
every state poll; completed/impossible slots collapse rather than reorder, so the user's mental
model isn't shuffled mid-session.

**B2. EV per minute (£/hr sort). ✅ DONE**
A £2 offer taking 90 seconds beats a £5 offer needing 20 minutes of racecard study. Assign rough
effort weights per `OfferNextActionKind` (config map, user-tunable later), expose "£/hr" as a
third sort in `do-next.ts` alongside priority/edge.

**B3. Bankroll-aware ranking. ✅ DONE**
Balances per bookmaker/exchange are tracked. Flag Do Next items the user cannot fund ("needs £25
in Betfair — £14 short"), and synthesize the transfer/deposit as its own queue item with the
downstream EV attached ("unlocks £11 edge").

**B4. Paste-to-plan (extend the parser). ✅ DONE**
`parse-offer-text.ts` already turns pasted T&Cs into structured offers. Extend the same pattern to
bet-confirmation text pasted from bookie apps → prefilled bet log. This is the backbone of mobile
quick-logging (§4): on the phone, you paste, confirm, done — three taps.

### Question 2: "Am I executing correctly?"

**B5. Naked-exposure sentinel.**
The most expensive matched-betting mistake is a back with no lay. Generalize the racing guide's
back→lay step tracking: any open back bet with no corresponding lay/hedge after a threshold
(default 10 min, tighter as the event start approaches) raises a prominent Home + push alert.
No competitor does this well.
*Conundrum — false positives:* some strategies are intentionally unhedged (e.g. SNR free bet on a
longshot). Bets carry a betType; only qualifying/risk-free backs trigger the sentinel, and any
alert can be muted per-bet with one tap ("intentional").

**B6. Live 2UP sentinel (the feature people would pay for).**
The EP engine's live model already computes in-play state. Add alerting: "Arsenal 2–0 up — early
payout triggered. Lay the draw at \~4.2 to lock +£8." Delivery: web push (PWA, iOS ≥16.4) with a
local-notification fallback while single-user.
*Conundrum — polling cost vs latency:* goals need ≤60s detection. Poll API-Football only during
windows where the user has an open 2UP position (the app knows this from open bets), not all day.
Cost stays near zero for a single user; at multi-tenant scale one poller serves all users watching
the same match (§7.2).

**B7. Mistake ledger.**
When A3 shows realized \< expected, prompt one tag: "laid late" / "wrong market" / "odds moved" /
"bookie voided" / "other". Aggregate into "where my leak is" — £ lost per mistake category per
month. This converts the app from tracker to coach.

### Question 3: "Did it actually pay?"

**B8. Monthly Edge Report.**
One chart: cumulative *expected* EV (from A3 locks) vs cumulative *realized* net P&L. Tracking
together = you're capturing your edge; diverging = a leak (commission, errors, optimism) — and B7
tells you which. This is the single chart that justifies the product. Include: capture rate,
retention rate trend (A1), commission drag total, £/hr realized.

**B9. Bookmaker league table + account health.**
Per bookmaker: realized ROI, retention rate, offer frequency, days since last offer, stake
restrictions log (manual entry first). A soft "health" state (Healthy / Cooling / Gubbed) feeds
back into ranking: a gubbed account's future EV ≈ 0, so B1/Do Next should discount it.
*Conundrum — inferring gubbing:* automatic detection (offer drought, stake refusals) is guessy.
Ship manual marking first; add "it's been 40 days since Bet365 sent you an offer — mark as
cooling?" nudges from the data later. Never auto-mark.

**B10. Retained P&L integrity pass. ✅ DONE**
Audit that every P&L surface is net of commission and handles voids/Rule-4 identically (the calc
layer does; verify the history feed and dashboards agree). Add a "gross vs retained" toggle on the
P&L chart so the commission gap is *visible* rather than silently netted.

---

## 4. Track C — Mobile experience (D3)

Target: \*\*responsive PWA. 70–80% of the product reachable on mobile; the daily-driver 20% is
excellent.\*\* No native app initially (review friction for gambling-adjacent apps, store cut,
Next.js reuse).

### 4.1 Interaction model: the Home swipe deck

Home widgets (Edge hero, Live P&L chart, Feed, Do Next, Daily Plan) become a \*\*horizontally
swipeable deck\*\* on mobile — one widget in focus at a time, pagination dots, remembered last
position. This was chosen over tabs/sub-nav because:
- It preserves the "glanceable desk" feel: swiping is browsing, tabs are navigating.
- Each widget gets the full viewport, so charts stay legible without shrinking.
- The deck order can be **context-aware**: morning → Daily Plan first; open positions → Live P&L
  first; otherwise → Edge hero. (Deterministic rules, not ML; user can pin an order.)

Implementation notes: CSS scroll-snap on a flex row (\`overflow-x: auto; scroll-snap-type: x
mandatory`), each child`scroll-snap-align: center\`. No carousel library needed. Desktop keeps
the current grid — same components, different container; widgets must not know which mode they're
in.

### 4.2 Progressive disclosure rules

- Every desktop card gets a **collapsed mobile variant**: headline stat + one-line context,
  expanding in place (accordion) or navigating to the full page. Rule of thumb: collapsed = the
  number you'd read aloud; expanded = the table you'd study.
- Racing Desk on mobile = race strip + suggested races + offer workflow steps; the full runner
  grid is one tap deeper, never rendered by default.
- Tables (history, tracker) become card lists ≤`sm`; already partially true — audit and finish.

### 4.3 Quick-log (the killer mobile flow)

On-the-go logging must be ≤3 taps: floating "+" on every mobile screen → sheet with:
1. **Paste** (B4 parser prefills everything from bet-confirmation text), or
2. **From plan** (today's Daily Plan slots offer one-tap "log this as placed"), or
3. Manual minimal form (bookie, stake, odds — the rest defaults and can be edited later on desktop).

The philosophy: **mobile captures, desktop curates.** A bet logged roughly on the phone is
flagged "quick-logged" for later desktop review rather than forcing full data entry standing in a
queue.

### 4.4 Alerts

PWA web push (iOS ≥16.4 requires the app added to Home Screen — make this a first-run prompt).
Alert types, each individually toggleable: naked exposure (B5), 2UP trigger (B6), race off-time
approaching with unfinished workflow, offer expiring with EV unclaimed, result settled ("Haydock
13:35 settled: +£4.10"). While the product is single-user/local, a simple local scheduler +
Notification API suffices; the push service abstraction should be a thin interface so the
multi-tenant version swaps in a real push backend without touching alert logic.

---

## 5. Tracks E–G — Rounding out the personal product (pre-gate)

With the original five phases shipped, these tracks close the gap between "roadmap done" and
"gate-ready". They are still personal-value work (D1) — no multi-tenant tax — but several double
as passive business-proofing. Letters skip D because Track D is the business path (§7). New
side-nav items are allowed for mainline features (F1, F2).

### Track E — Your desk, your rules (Phase 6)

**E1. Tunable thresholds & effort weights (settings depth).**
Today a dozen behaviour-defining numbers are hardcoded by feel: naked-exposure windows (10 min /
3 min imminent), the drought nudge (40 days), the retention prior and blend weight (0.8 / 5),
effort minutes per action kind (B2's open question — "tune from own usage" has nowhere to tune),
the post-mortem tag threshold (90% capture), the Edge Report minimum (5 settled campaigns).
Expose them in a "Tuning" section on Settings, each with its default shown and a per-row reset.
*Why:* §8 explicitly lists the effort weights as guesses to be tuned; every sentinel and nudge
gets more personal when its trigger matches how the user actually operates.
*Conundrum — settings sprawl:* only numbers that changed behaviour during real use earn a
setting; every new setting defaults to today's behaviour so an untouched Settings page is a
zero-diff upgrade.

**E2. Home widget personalisation.**
User-controlled visibility and order for the Home widgets — desktop grid and mobile deck both —
with drag-to-reorder, hide/show, and the existing deck pin generalised (pin was v1 of this).
Persist in settings per mode (grid vs deck).
*Why:* the standing product philosophy is iterate/enhance with user-controlled personalisation as
the end state; Home is the surface it matters on most.
*Conundrum — personalisation vs context-awareness:* the context-aware start card (morning → plan,
open positions → P&L) stays a separate rule that operates *within* the user's chosen order;
hidden widgets must remain reachable as pages so nothing is lost, only decluttered.

**E3. Data custody: backup, restore, import.**
One-tap backup (download the SQLite file plus a versioned JSON bundle), restore with a preview
and an automatic pre-restore safety copy, per-table CSV export (bets, offers, transactions, EV
snapshots), and a guided CSV import wizard that maps a matched-betting spreadsheet (date, bookie,
stake, odds, type, profit) onto Edgeways rows.
*Why:* local-first's biggest real-world risk is a lost laptop, and "my history lives in a
spreadsheet" is the #1 objection any spreadsheet user will raise — import is the migration
ramp. Doubles as passive business-proofing (§7.1).
*Conundrum — import fidelity:* imported rows carry `source: "import"` and are excluded from
capture-rate analytics (no EV locks exist for them); the Edge Report annotates its coverage
window rather than faking EV history. Never re-derive locks retroactively.

### Track F — The workbench (Phase 7)

**F1. Match checker (the §7.3 bridge, step 2). New side-nav item.**
Paste or enter a bookie price for a selection, fetch the live Betfair lay (already integrated),
and return a verdict: qualifying loss, match rating %, SNR/SR retention at those odds, a
good/ok/poor chip with the standard provenance badge — and one tap into the prefilled calculator
or bet log. Zero new feed cost.
*Why:* this is the explicitly planned "exchange-first matcher" — the independently useful step
that turns calculators into verdicts without the incumbents' feed bill.
*Conundrum — discovery creep:* it checks the match you found; it never lists or ranks markets.
The moment it browses, it's an oddsmatcher and belongs behind the D2 decision, not here.

**F2. Alerts inbox. New side-nav item.**
A persistent alert history: every EdgeAlert lands in an inbox (new table) with read/unread, ack,
snooze and a deep link; the nav item carries an unread badge. Toasts and notifications become
*delivery*; the inbox is the source of truth.
*Why:* today an alert missed is an alert gone — and the Guardian sentinels' entire value is that
nothing slips. This also gives alerts a home on desktop where notifications are often blocked.
*Conundrum — duplication:* alert rules already emit stable dedupe keys; inbox rows key on them so
a re-firing rule updates its row rather than stacking copies.

**F3. Background web push (the Phase 4 follow-up, made first-class).**
`web-push` dependency (flagged per repo rules), VAPID keys, a `push_subscriptions` table, service
worker push handler, per-device opt-in from Settings. Alert logic is untouched — push is just a
new AlertChannel behind the existing interface.
*Why:* the sentinels fully pay off only when the phone buzzes with the app closed; this also
finally answers the §8 open question about iOS PWA push, on real hardware.
*Conundrum — local-first delivery:* the local server must be reachable from the phone (LAN /
Tailscale) for push to send; surface delivery state honestly in Settings ("last push delivered
2 min ago") and degrade visibly, never silently, to local alerts.

**F4. Command palette.**
Cmd+K (desktop): fuzzy jump to any page, offer, bookmaker or race, plus quick actions — add bet,
paste slip, new offer, mark cooling. shadcn command component; actions reuse existing providers.
*Why:* desktop is the curation surface and it should be operable at typing speed; every entity
two keystrokes away is a daily-driver multiplier.
*Conundrum — stale index:* search over live app state only (offers, accounts, races currently
loaded), no separate index to drift out of date.

### Track G — Momentum (Phase 8)

**G1. Targets & pace.**
A monthly profit target in Settings; Home hero and the Edge Report show pace against it — "£162
of £250 · on pace" / "£12/day needed". Optional per-desk breakdown later.
*Why:* matched betting is a grind; pace-vs-target is the loop that keeps the desk opened daily.
The daily-average maths already exists on Home.
*Conundrum — gamification tilt:* pace copy stays factual — no streaks, no confetti. Prefer
EV-framed pace (edge captured vs planned) over raw P&L where possible: a bad-variance week isn't
"behind plan" if the edge was captured.

**G2. Onboarding & demo mode.**
First-run wizard: bank → bookies + balances → defaults → optional spreadsheet import (E3) →
notification permission. Plus a demo-data toggle: a seeded, realistic, clearly-watermarked
dataset for screenshots and walkthroughs, one tap to wipe.
*Why:* gate criterion 2 (§7.1) requires showing Edgeways to outsiders; an empty desk undersells
it, and demo mode makes shares safe — no real balances on screen.
*Conundrum — demo bleed:* demo data never mixes with real rows. It's a separate DB file behind
the existing `EDGEWAYS_DB_PATH` switch, not a flag column that could leak into analytics.

**G3. Season summary (the annual Edge Report).**
A year view: per-month table (expected, realised, capture %, commission drag, retention),
cumulative chart, best/worst bookmaker, realised £/hr; printable and exportable.
*Why:* B8 answers the month; the year is the story — for the user first, and later it's the
marketing artefact the data moat (§7.4) promises.
*Conundrum — partial coverage:* imported rows (E3) and pre-lock history mean early months lack EV
data; the view annotates its coverage ("EV capture measured from Jul 2026") instead of showing
misleading 100%s.

**G4. Access & keyboard polish.**
Sweep the accessibility backlog (control labels on switches, focus order, contrast in both
themes, reduced motion), and add documented keyboard shortcuts for the daily actions (log bet,
settle, switch desks) surfaced in Help.
*Why:* a daily driver earns its keep in seconds saved and in never fighting its user; this is
also where the known a11y debt gets paid down deliberately rather than incidentally.

---

## 6. Sequencing

Personal-product-first (D1) ordering. Each phase is shippable and personally useful.

| Phase                                                                                                   | Contents                                                                                                                                                                                                                                                                                                                                                                   | Status                                                         | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. EV truth**                                                                                         | ✅ A1 retention, ✅ A2 provenance, ✅ A3 EV lock + capture, ✅ A4 hero, ✅ A5 no-vig UI                                                                                                                                                                                                                                                                                         | **Done**                                                       | Every £-EV on screen has a basis badge; settled offers show capture %; Home leads with edge-on-the-table                                                                                                                                                                                                                                                                                                                        |
| **2. Daily driver**                                                                                     | ✅ B1 Daily Plan, ✅ B2 £/hr, ✅ B3 bankroll-aware, ✅ B4 paste-to-log, ✅ B10 retained-P&L audit                                                                                                                                                                                                                                                                               | **Done**                                                       | A full offer day can be run start-to-finish from the plan view alone                                                                                                                                                                                                                                                                                                                                                            |
| **3. Mobile**                                                                                           | ✅ §4 swipe deck, ✅ quick-log (+B4 parser), ✅ collapsed variants, ✅ PWA install + local alerts                                                                                                                                                                                                                                                                              | **Done**                                                       | Log a bet in ≤3 taps on a phone; Home usable one-handed                                                                                                                                                                                                                                                                                                                                                                         |
| **4. Guardian**                                                                                         | ✅ B5 naked-exposure, ✅ B6 2UP sentinel, ✅ push delivery (local AlertChannel; true background web push delivered by F3)                                                                                                                                                                                                                                                     | **Done**                                                       | A deliberately-left-unhedged test bet alerts within threshold; a live 2UP fires a push                                                                                                                                                                                                                                                                                                                                          |
| **5. Coach**                                                                                            | ✅ B7 mistake ledger, ✅ B8 Edge Report, ✅ B9 league table                                                                                                                                                                                                                                                                                                                   | **Done**                                                       | Monthly report renders from ≥1 month of real captured data                                                                                                                                                                                                                                                                                                                                                                      |
| **6. Your rules**                                                                                       | ✅ E1 tunable thresholds, ✅ E2 widget personalisation, ✅ E3 data custody                                                                                                                                                                                                                                                                                                    | **Done**                                                       | Every behaviour-defining number is user-tunable; Home arranged to taste; backup → restore round-trips a real DB; a spreadsheet imports cleanly                                                                                                                                                                                                                                                                                  |
| **7. Workbench**                                                                                        | ✅ F1 match checker, ✅ F2 alerts inbox, ✅ F3 background web push (verified on Sam's Android 2026-07-14), ✅ F4 command palette                                                                                                                                                                                                                                               | **Done**                                                       | A found match gets a verdict in \<10s; no alert is ever lost; the phone buzzes with the app closed; any entity is two keystrokes away                                                                                                                                                                                                                                                                                           |
| **8. Momentum**                                                                                         | ✅ G1 targets & pace, ✅ G2 onboarding + demo mode, ✅ G3 season summary, ✅ G4 access & keyboard (contrast audit deferred)                                                                                                                                                                                                                                                    | **Done**                                                       | Home answers "am I on pace?" at a glance; a stranger reaches a working desk in \<10 min; the year renders honestly                                                                                                                                                                                                                                                                                                              |
| **9. Business gate**                                                                                    | §7 — only if gate criteria met                                                                                                                                                                                                                                                                                                                                             | **✅ Done 2026-07-16**                                          | See §7.1                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **10. New desks**                                                                                       | ✅ H1 weekly digest, ✅ H2 casino desk (promoted from §9, 2026-07-15)                                                                                                                                                                                                                                                                                                        | **Done**                                                       | Monday digest lands as a push from real data; a casino offer gets an honest wagering-EV verdict with variance warnings — pre-gate scope, does NOT require the Phase 9 gate                                                                                                                                                                                                                                                      |
| **11. Execution edge** (promoted from §9, 2026-07-16 — COMPLETE same day; see `../../docs/strategy/competitive-landscape.md`) | **W1:** ✅ J1 measured £/hr, ✅ J2 Boosts page (boost + bet-builder checkers, boost diary), ✅ J3 lock-in advisor. **W2:** ✅ J4 casino variance simulator, ✅ J5 mug-bet scheduler, ✅ J6 offer email ingestion (.eml/paste + IMAP folder pull). **W3:** ✅ J7 acca desk (sequential lock + both insurance methods), ✅ J8 household account sets, ✅ J9 betslip prefill extension | **Done**                                                       | £/hr uses measured minutes once samples exist; a boost gets a fair-price verdict in \<10s and the diary sums EV captured; any open position shows its lock-out; a casino offer shows bust % and a distribution; mug spend is a visible per-bookie cost outside edge metrics; a forwarded offer email becomes a prefilled campaign; an acca runs leg-by-leg with lay alerts; P&L splits by owner; one click fills a betslip      |
| **12. Casino reward parity** (promoted from §9, 2026-07-21)                                             | ✅ K1 casino reward-type parity. ✅ K2 combined-campaign Monte Carlo simulation, shipped bundled with a Casino Calendar/Campaigns nav split (mirrors Offers) and an Expires date on campaigns. ✅ K3 recurring casino offers (mirrors sports `offer_series`)                                                                                                                  | **Done**                                                       | A casino offer is a campaign that can carry any combination of a qualifying wager and one or more rewards, each with its own correct EV, summed to a campaign total; Simulate carries the whole campaign's risk, not just one component; the Casino desk has its own Calendar/Campaigns split the way Offers does; a daily/weekly casino offer materialises itself the way a recurring sports offer already does                |
| **13. Acca Desk grows up** (promoted from §9, 2026-07-22)                                               | ✅ Styling pass, ✅ L1 outcome-probability calc, ✅ L2 history/richer-columns view (built-then-screenshotted, design-first per standing convention), ✅ L3 boosted odds (winnings-only convention, confirmed by Sam) - all shipped same day                                                                                                                                    | **Done**                                                       | A run's header shows real Campaign P&L and a leg that will never be laid again reads as finished, not pending; a run card shows its ALL WIN / 1 LOSE / 1+ LOSE odds; live and finished runs are visually and structurally separated (collapsible history cards) with a per-leg £ contribution figure; a boosted acca's final-leg lock and Campaign P&L use the true boosted price end to end, not a hand-reverse-engineered one |
| **14. Offer Edge** (promoted from §9, 2026-07-31)                                                       | ✅ M0–M3 + M3d; ✅ `--edge` violet signature for recommended / Race picks / Best plays (D5). Entitlements → N0 (gated)                                                                                                                                                                                                                                                       | **In progress** (engine + surfaces + chrome landed 2026-08-02; soak next) | Place-refund offers answer "which race, which horse, why" from a real model; Race picks and Offer Workflow share the play; qualifies (success) vs recommended (edge violet); maths behind the curtain, confidence chip visible                                                                                                                                                                                                  |
| **15. Boosts money path** (promoted from §9, 2026-08-03)                                               | ✅ J2b — diary ↔ Add bet (`betType: boost`) ↔ Tracker / In-bets / History Boosts tab; no paper-trade settle                                                                                                                                                                                                                                                                | **Done** (2026-08-03)                                           | A logged boost can be placed via Add bet; open boost bets show in Tracker Open and In-bets; settle once from Boosts or Tracker; History has a Boosts tab                                                                                                                                                                                                                                                                       |
| **16. Acca offer bridge** (promoted from §9, 2026-08-05)                                               | ✅ L4 — qualifier shape on offers + Place qualifying → global Acca New run (pro/entitled); Add bet fallback                                                                                                                                                                                                                                                              | **Done** (2026-08-05)                                           | An ACCA bet&get campaign routes the qualifier into Acca Desk with stake/bookie/offerId and requirements visible; singles stay on Add bet; bet builder captured for later                                                                                                                                                                                                                                                       |

Phases 1–2 are pure lib/UI work on existing data — ideal for local-model iteration (small,
well-tested pure functions). Phase 3 is UI-heavy. Phases 4+ touch polling/notifications.
Phases 6–8 are pre-gate personal-value work; E3 and G2 double as passive business-proofing.

---

## 7. Track D — The business path (if/when)

### 7.1 The gate (D1: product-first)

Do **zero** multi-tenant work until all of:
1. You personally run Edgeways daily for ≥2 months (Phases 1–4 shipped and sticky for you).
2. ≥5 external matched bettors ask to use it after seeing it (share screenshots in
   r/MatchedBettingUK / MB Discords — this doubles as demand testing).
3. The Edge Report (B8) shows the product measurably improves capture rate — that's the sales pitch,
   generated by the product itself.

Until then, the only business-proofing allowed is *passive*: keep feeds behind service interfaces,
keep user-scoped data keyed by account, don't hardcode "the user" into new schema.

### 7.2 Architecture evolution (when the gate opens)

Two viable routes; the recommendation is the hybrid:

- **Route 1 — hosted multi-tenant:** Drizzle → Postgres/Turso, auth, Stripe. Conventional, most
  work, easiest ops story.
- **Route 2 — local-first + paid sync/feeds (recommended):** keep SQLite-per-user (Turso embedded
  replicas or CR-SQLite sync), sell (a) sync across devices and (b) **server-side feed proxy**.
  Privacy is a real differentiator in this niche ("your betting records never leave your device")
  and it matches the existing codebase almost exactly.
- Either way, the **feed proxy is the first server component**: one Racing API + API-Football +
  Betfair poller fans out to all subscribers (cache per race/match, not per user). This is what
  collapses per-user API cost from £50–100/mo (everyone brings keys) to £2–6/mo COGS at even
  50–100 subscribers. The 2UP goal poller (B6) especially: one match watched = all watchers served.
- \*\*Betfair commercial data licensing needs a proper legal read before any paid tier ships live
  exchange prices.\*\* Cache aggressively; gate live-lay polling to the top tier.

### 7.3 The oddsmatching conundrum (D2)

Full oddsmatching = continuous multi-bookmaker odds feeds — the incumbents' moat and their main
cost. Edgeways should **not** attempt it until Edge-tier revenue can fund it and demand is proven.
The staged bridge, each step independently useful:

1. **Now:** No oddsmatching. Racing Desk already does *scoped* matching (exchange lays vs bookie
   prices for racing offers) — that's the niche version and it's differentiated.
2. **Exchange-first matcher:** Betfair data (already integrated) + manually-entered or pasted
   bookie prices → "is this a good match?" checker. Zero new feed cost; turns the calculator into
   a verdict.
3. **Tracked-bookmaker matcher:** if/when an odds-feed aggregator subscription (single vendor,
   fixed cost) is affordable from revenue, match only the user's *own* active offers/bookmakers —
   orders of magnitude fewer markets than a full oddsmatcher, aligned with "execution layer".
4. **Full oddsmatcher:** only if Edge-tier subscriptions demonstrably fund the feed contracts and
   users are churning for lack of it. Revisit; possibly never (D2). Partnering/affiliating with an
   incumbent for discovery while owning execution remains a legitimate permanent answer.

### 7.4 The data moat

Every month of use makes the product more personal and harder to leave: measured retention (A1),
capture rate history (A3), mistake taxonomy (B7), bookmaker health (B9). None of this is
replicable by an incumbent bolting on a tracker, because it requires the execution loop to run
*through* the product. Marketing writes itself from B8: "I captured 91% of my theoretical edge
this month."

### 7.5 Tiers & pricing (locked 12 Aug 2026)

Commercial terms (trial, Founding, feedback credit, annual pence): **`docs/strategy/subscriptions.md`**
(repo root). Do not invent a second public price on the homepage.

| Tier | Price | Contents (intent) | Logic |
| ---- | ----- | ----------------- | ----- |
| Free | £0 | Calculators, manual bet logging, basic P&L, demo Racing Desk | Funnel + community trust |
| Core | £9.99/mo · £99.90/yr | Offers pipeline, Do Next / Daily Plan, EV capture analytics, Edge Report, tracker, free-bet lots | All-lib features, near-zero COGS |
| Edge | £24.99/mo · £249.90/yr | **Offer Edge** (modelled race/horse picks + recommended desk chrome), Racing Desk live/delayed feeds, 2UP sentinel + push, exchange integration | Carries API cost + the pro differentiator; signature `--edge` violet chrome |

**Public mechanics:** 14-day Edge trial (one per person), then Core or Edge at list.
Annual ≈ 2 months free (10× monthly). **Founding** (waitlist/beta, not on public cards):
three months of Edge at Core price after the trial. Gate by *data cost and edge delivered*.

**Readiness (12 Aug 2026):** N0 matrix + Settings plan preview exist. Clerk + `app_users`
exist. Processor (EDGE-1/2) still open. Landing shows this table on the **launch variant**
(EDGE-21); live `/` stays waitlist until `LANDING_VARIANT=launch`.

A fourth tier is under consideration (2026-08-02): an **Elite** level bundling direct exchange
connections (e.g. Betdaq partner API) once Edge-tier revenue funds the integration and data
licensing. Exchanges welcome matched-betting liquidity, so partner terms may be favourable — but
it only makes sense once subscriptions already cover the base tiers.

### 7.6 Compliance & go-to-market checklist (at gate)

- 18+ gating, BeGambleAware messaging, UK ad-standards review for gambling-adjacent products.
- No gambling licence needed (the product never takes a wager) — confirm with a solicitor anyway.
- Betfair/Racing API/API-Football ToS re-read for redistribution once proxying (§7.2).
- Beta via r/MatchedBettingUK + MB Discords; these communities make or break tools in this niche.
- Content/SEO on "matched betting tracker / spreadsheet / EV" terms — high intent, weak incumbents.
- App stores: revisit only after PWA push proves insufficient; expect gambling-category friction.

---

## 8. Open questions & risks

| Item                                                           | Status                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Betfair commercial data licence terms for a paid product       | Unresolved — blocks Edge tier live lays, not personal use                 |
| iOS PWA push reliability in practice (backgrounded Safari)     | Test during Phase 3; fallback is timeline-visible alerts + email          |
| Racing API rate limits vs multi-race live polling on race days | Measure during Phase 4; may force snapshot cadence tiers                  |
| Effort weights for £/hr (B2) — initial values are guesses      | Resolved: user-tunable in Settings → Tuning (E1, 2026-07-14)              |
| When does expectedProfit get re-locked vs versioned (A3)       | Decided: version on post-Active edits, never mutate; UI shows "re-locked" |
| Multi-tenant route choice (hosted vs local-first sync)         | **Route 1 formal** 11 Aug 2026 (D6 / EDGE-18) |

---

## 9. Future ideas (parking lot)

Unscheduled, unreviewed, deliberately outside Phases 6–8. Ideas land here first — with a one-line
case and the reason they are parked — and are only promoted into a phase after user review. If an
idea is rejected, record that too (a decided "no" is as valuable as a "yes").

Reviewed in full with Sam on 2026-07-15: two ideas promoted to Phase 10 (H1 digest, H2
casino desk), one decided no, the rest stay parked with their reasons confirmed.

| Idea                                             | The case                                                                                                                                                                                                                                                                                                                                                                                                      | Status                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Casino offer EV module**                       | Wagering-EV maths (slot RTP, playthrough, variance warnings) — the other half of what incumbents cover, and many matched bettors do both                                                                                                                                                                                                                                                                      | **PROMOTED → H2 (2026-07-15).** Sam: dedicated "Casino" side-nav section; build in line with the app's existing layouts/stylings; straight to development, no design phase                                                                                                                                           |
| **Weekly digest**                                | A Monday summary (edge captured, leaks, drought nudges) delivered via the alert channel                                                                                                                                                                                                                                                                                                                       | **PROMOTED → H1 (2026-07-15).** F2/F3 plumbing shipped and push verified on Sam's Android; opt-in only                                                                                                                                                                                                               |
| **Telegram/Discord alert delivery**              | A bot channel delivers alerts with zero VAPID/server-reachability pain, works on any device                                                                                                                                                                                                                                                                                                                   | **REJECTED (2026-07-15).** F3 web push verified on Sam's Android; one background channel, decided — a second is maintenance without capability                                                                                                                                                                       |
| **Exchange auto-import**                         | Pull placed/settled lays from the Betfair account API straight into the tracker — kills manual logging for the lay side of every bet                                                                                                                                                                                                                                                                          | Parked (confirmed 2026-07-15). Betfair API auth scope + ToS need a proper read; also weakens the deliberate "log it consciously" execution loop — decide with care                                                                                                                                                   |
| **Each-way matcher (Racing Desk)**               | EW / Extra place: desk → calculator modal (dual lays) → tracker → race-result settle; active bets + place-zone visual                                                                                                                                                                                                                                                                                          | **Unparked as L7** (2026-08-06). Not OM discovery EV. Multi-dutch later. See `implementation-briefs.md` L7.                                                                                                                                                                                                           |
| **Odds drift capture**                           | Snapshot the market price at log time and at settlement, feeding a richer A3 capture decomposition ("odds moved" measured, not tagged)                                                                                                                                                                                                                                                                        | Parked (confirmed 2026-07-15). Let a month of B7 mistake tags prove drift is the leak before building price polling                                                                                                                                                                                                  |
| **Tauri desktop packaging**                      | Single .app, dock icon, menubar quick-log; no terminal to start the server                                                                                                                                                                                                                                                                                                                                    | Parked (confirmed 2026-07-15). A launchd auto-start script is the cheap interim if the terminal grates                                                                                                                                                                                                               |
| **Multi-device sync (local-first)**              | CR-SQLite/Turso embedded replicas — phone and desktop share one desk without a hosted backend                                                                                                                                                                                                                                                                                                                 | Parked (confirmed 2026-07-15). Gate-adjacent (§7.2 Route 2); Tailscale to the Mac Studio covers phone access today                                                                                                                                                                                                   |
| **"Ask your desk" (local AI)**                   | Natural-language questions over your own data via the local Ollama backbone ("commission paid at Betfair in June?") — privacy-preserving by construction                                                                                                                                                                                                                                                      | Parked (confirmed 2026-07-15). Toy risk: answers must come from the same tested calc layer as the UI, never a model's arithmetic; needs a query-plan design first                                                                                                                                                    |
| **Dutching / multi-way lock calculator**         | Generalise the 2UP equalising-lock maths to n-way books (dutching, arb-close-outs)                                                                                                                                                                                                                                                                                                                            | Parked (confirmed 2026-07-15). Needs its own spec + test vectors before any code, beside the spec-locked EP engine                                                                                                                                                                                                   |
| **Shared offer templates**                       | Export/import an offer definition (T&Cs, rules, stake plan) as a link or file — friends seed each other's calendars                                                                                                                                                                                                                                                                                           | Parked (confirmed 2026-07-15). First taste of network value, but distribution/moderation questions belong at the gate; E3 export plumbing makes it cheap later                                                                                                                                                       |
| **Acca desk (leg-by-leg lay workflow)**          | Acca offers run over days; track each leg, compute the lay-on-loss stake as legs settle, alert "lay leg 3 now". Outplayed's Acca Catcher proves demand — but their tracker needs their finder; ours works from any acca the user logs. Pure execution workflow, zero discovery                                                                                                                                | **PROMOTED → J7 (2026-07-16).** Both offer types in v1 (Sam's call)                                                                                                                                                                                                                                                  |
| **Mug-bet scheduler**                            | Plan and budget camouflage bets per bookie (cadence, spend as a deliberate cost against that account's EV earned); feeds B9 health. Nobody does this systematically                                                                                                                                                                                                                                           | **PROMOTED → J5 (2026-07-16)**                                                                                                                                                                                                                                                                                       |
| **Measured effort — real £/hr**                  | Time the actual open→logged span per offer so B2's £/hr uses measured minutes, not estimates. The purest execution-truth feature; no competitor measures execution                                                                                                                                                                                                                                            | **PROMOTED → J1 (2026-07-16).** Hybrid capture: automatic with edit-after                                                                                                                                                                                                                                            |
| **Casino variance simulator**                    | Local Monte Carlo over a wagering offer: bust probability, median outcome, distribution chart — extends H2's variance tiers into honest distributions. Incumbents publish static EV lists only                                                                                                                                                                                                                | **PROMOTED → J4 (2026-07-16).** Volatility-preset model                                                                                                                                                                                                                                                              |
| **Lock-in advisor (any open position)**          | Generalise the 2UP equalise maths: any open back+lay shows "close now for £X guaranteed" from user-entered current odds                                                                                                                                                                                                                                                                                       | **PROMOTED → J3 (2026-07-16)**                                                                                                                                                                                                                                                                                       |
| **Price boost & bet builder checkers**           | Manual-entry fair-price verdicts (extends F1 Match Checker): log a boost or builder price vs exchange fair odds → EV verdict + a "boost diary" of EV captured. The incumbents' finders are D2; the checkers are not                                                                                                                                                                                           | **PROMOTED → J2 (2026-07-16).** Separate Boosts page (Sam's call). Money-path follow-up → **J2b / Phase 15**                                                                                                                                                                                                          |
| **Boosts money path (diary → real bets)**        | Wire Boosts into balances, In-bets, Profit Tracker, and History like other sports bets. Diary stays the Boosts desk (entry + ledger); Place bet opens Add bet prefilled as `betType: "boost"`. Logged vs placed tabs. Settle is one record, two surfaces (Boosts or Tracker).                                                                                                                             | **PROMOTED → J2b / Phase 15 (2026-08-03).** Sam: two buttons Log for later / Place bet; Add bet is the commit step; no paper-trade settle on Logged-only rows                                                                                                                                                         |
| **Paper-trading EV (settle before committing)**  | Let a Logged boost diary row (no linked bet) be marked Won/Lost/Void for EV review only, without touching balances, In-bets, or Tracker. Nice for reviewing boost EV before committing cash.                                                                                                                                                                                                                | **Parked (2026-08-03).** Sam: across the app, settlement only affects committed money. Keep as a future benefit to revisit; do not ship with J2b. See J2b brief "Out of scope".                                                                                                                                      |
| **Offer email ingestion**                        | Forward/drag bookie promo emails into the desk; the existing parse pipeline prefills the offer. Kills the daily-calendar gap without any scraping                                                                                                                                                                                                                                                             | **PROMOTED → J6 (2026-07-16).** Staged: drop/paste first, IMAP forward-folder pull is the destination                                                                                                                                                                                                                |
| **Betslip prefill extension**                    | Betwatch-style browser extension: one click in Edgeways fills the exchange/bookie slip with selection + stake. Execution automation, not discovery                                                                                                                                                                                                                                                            | **PROMOTED → J9 (2026-07-16).** Last in the order deliberately (new surface)                                                                                                                                                                                                                                         |
| **Household account sets**                       | Track a partner's separately-operated accounts as a second set (owner tag on accounts, per-owner P&L). Long-standing community practice the incumbents support                                                                                                                                                                                                                                                | **PROMOTED → J8 (2026-07-16).** Owner-tag model; compliance-sensitive framing stands                                                                                                                                                                                                                                 |
| **Casino reward-type parity**                    | H2's casino desk only models Bonus/Cash as ONE reward per offer (a £ amount + wagering multiplier); Sam flagged (2026-07-21, against Outplayed's EV calculator) that Free Spins, Golden Chips and Cashback aren't representable, and — crucially — that real promos bundle multiple reward types in a single offer (e.g. "wager £100, get 20 free spins"), which a single-reward-type model can never express | **PROMOTED → K1 (2026-07-21).** Full parity via a multi-component campaign model mirroring the sports offer/bet pattern: Qualifying wager, Cash, Bonus, Free Spins, Golden Chips, Cashback, any combination on one offer (Sam's call)                                                                                |
| **Combined-campaign casino simulation**          | K1 shipped Simulate scoped to a single Bonus component; Sam asked (2026-07-21) whether a whole campaign (e.g. qualifying wager + free spins) could get one combined distribution instead of eyeballing each component's simulation separately                                                                                                                                                                 | **PROMOTED → K2 (2026-07-21). ✅ DONE same day.** Composed the existing wagering-cycle session engine per component (new spins-summing model for Free Spins, new Bernoulli model for Golden Chips), one histogram per campaign not per component; the old per-Bonus-only simulator was retired, not kept alongside it |
| **Recurring casino offers**                      | Sports offers materialise daily/weekly instances from an `offer_series` template; casino has no equivalent, so a genuinely recurring reload/spins promo has to be re-logged by hand every occurrence. Sam asked (2026-07-21) "we do this for Bet offers"                                                                                                                                                      | **PROMOTED → K3 (2026-07-21). ✅ DONE 2026-07-28.** Mirrors `offer_series`/`offer-recurrence.ts` with a `casino_offer_series` template that also carries a component template, so each materialised instance gets the same components fresh                                                                           |
| **Acca outcome-probability readout**             | Oddsmonkey shows an ALL WIN / 1 LOSE / 1+ LOSE probability bar per acca campaign, derived from each leg's odds. Sam asked (2026-07-22) for the Acca Desk to take inspiration from Oddsmonkey's informative pieces                                                                                                                                                                                             | **PROMOTED → L1 (2026-07-22). ✅ DONE same day.** Pure calc + a three-segment status-coloured meter on the run card, behind the existing heuristic EV-basis badge                                                                                                                                                     |
| **Acca Desk history & richer per-leg view**      | Sam asked (2026-07-22) for the Acca Desk to "be a full feature with informative pieces displayed clearly" - a clear Active/History split and denser, Oddsmonkey-inspired per-leg detail, reshaped into Edgeways' own design language rather than cloned                                                                                                                                                      | **PROMOTED → L2 (2026-07-22). ✅ DONE same day.** Built-then-screenshotted rather than mock-first (standing convention); segmented Active/History tabs, collapsible history cards, per-leg £ contribution figure                                                                                                      |
| **Boosted acca odds**                            | Bookmakers commonly boost an acca's final combined price (Sam's real example: 50% boost on a 2-leg acca, manually reverse-engineered into per-leg odds to use the desk today). Sam asked (2026-07-22) for the desk to handle a boost % natively                                                                                                                                                               | **PROMOTED → L3 (2026-07-22). ✅ DONE same day.** Winnings-only convention (Sam's call), run-level %, recomputes on void - threaded end to end into real settlement, not just display                                                                                                                                 |
| **Offer qualifier shape → Acca Desk**            | ACCA / Build-a-bet qualifiers currently only live in offer titles; Place qualifying always opens Add bet. Need structured capture + Acca Desk handoff for entitled users                                                                                                                                                                                                                                   | **PROMOTED → L4 / Phase 16 (2026-08-05).** Sam: 1A structured Qualifier shape + paste suggest; 2B global New run dialog (not nav). Thin `canUseAccaDesk` stub until N0; bet_builder enum only in v1                                                                                                                  |
| **Offer Edge (modelled runner targeting)**       | The Racing Desk tells the user *that* a race qualifies for a place-refund offer, but picks the target horse from a hand-tuned rank heuristic…                                                                                                                                                                                                                                                                 | **PROMOTED → M0–M3 + M3d (2026-07-31).** Model + three surfaces + desk cohesion. Recommended chrome uses `--edge` violet (D5), not amber.                                                                                                                                                                            |
| **Entitlement scaffolding (Free / Core / Edge)** | Product is one unlocked local app; §7.5 tiers are draft only. Sam asked (2026-07-31) whether offerings can be split by subscription tier today, and for a measured plan in the roadmap                                                                                                                                                                                                                        | **PROMOTED → N0 (2026-07-31), gated on D1.** Matrix + feature flags + optional "preview as" Settings switch first; no Stripe/auth until the business gate. See implementation brief N0                                                                                                                               |
