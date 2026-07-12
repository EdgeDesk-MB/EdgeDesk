# EdgeDesk Product Roadmap & Execution Thinking

> **How to use this document.** This is the canonical product plan for EdgeDesk. It is written to be
> self-contained so it can be handed to any AI model or human collaborator with no other context.
> It records not just *what* to build but *how we reason through the hard trade-offs* (the
> "conundrums" sections). When a decision here conflicts with older docs, this document wins.
> Keep the Decision Log current.
>
> Companion docs: `docs/api-dependencies-and-tiers.md` (API cost/tier detail),
> `docs/offer-command-centre.md` (offer pipeline spec), `docs/design-system.md`.

Last updated: 2026-07-12

---

## 1. Product thesis

**EdgeDesk is the execution and truth layer for matched betting — not an offer-discovery tool.**

Matched bettors have three daily questions:

1. **What should I do next?** (offer ranking, next actions, time-ordered planning)
2. **Am I executing correctly?** (pipeline: Planned → Qualifying → Awaiting → Awarded → Converting → Settled; no naked exposure; no expired free bets)
3. **Did it actually pay?** (retained P&L after commission and voids; expected vs realized)

Incumbents (Outplayed ~£25/mo, OddsMonkey ~£30/mo) sell *discovery*: oddsmatchers, guides,
forums. Nobody serves *execution truth* well — most serious matched bettors run spreadsheets.
EdgeDesk owns that niche: **"the P&L desk for matched bettors — know your real edge."**

The north-star design principle across every feature: **surface EV and the user's edge**, and be
honest about how confident each EV number is.

### Strategic decisions (Decision Log)

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| D1 | **Product-for-me first; business second.** | 2026-07 | Personal daily value is the proving ground. Build personal-value features first; make architecture choices that don't foreclose multi-tenant later, but do NOT pay the multi-tenant tax up front. |
| D2 | **No oddsmatching at launch — possibly never.** | 2026-07 | Full oddsmatching requires continuous odds polling across dozens of bookmakers (the incumbents' core cost). It only becomes viable if Edge-tier subscription revenue grows to fund it AND users demand it. See §6.3 for the staged bridge strategy. |
| D3 | **Mobile = simplified on-the-go logging + alerts, as responsive PWA.** | 2026-07 | 70–80% of the product available on mobile, with progressive disclosure (collapse/hide) and a swipeable widget model on Home. Native app stores deferred (gambling-adjacent review friction + 15–30% cut). |
| D4 | GitHub org is `EdgeDesk-MB` exclusively; repo `EdgeDesk-MB/EdgeDesk`. | 2026-07 | Standing constraint. |

### Current architecture snapshot (context for AI agents)

- Next.js 16 App Router, TypeScript, SQLite (better-sqlite3 + Drizzle), local-first single-user.
- Git root is the PARENT directory (`MB app build/`); all npm commands run from `edgedesk/`.
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

### A1. Measured free-bet retention (replaces hardcoded 0.8)

- **What:** `advantage.ts` uses `DEFAULT_FREE_BET_RETENTION = 0.8` and a `0.35` pre-qualification
  fudge. Compute the user's *actual* retention from settled free-bet conversions (award amount vs
  realized return, from the lots ledger + settled bets).
- **Why:** Every "£ remaining edge" number in Do Next and Best Advantage becomes personally honest.
  It is also the seed of the data moat (§6.4): the longer you use EdgeDesk, the smarter it gets.
- **How:**
  1. New service `src/lib/services/retention.ts`: `realizedRetention(): { rate: number; sampleSize: number; window: "all" | "90d" }` over settled conversion bets joined to their originating lots.
  2. Fall back to 0.8 when `sampleSize < 5`; blend (Bayesian shrink toward 0.8) for 5–15 samples.
  3. Thread through `estimateOfferRemainingEv`; display "Your retention: 78% (23 conversions)" on Home and in offer detail.
- **Acceptance:** Do Next EV figures change when retention history changes; badge shows sample size; unit tests for the blend.

### A2. EV provenance badges app-wide

- **What:** Racing Desk already tags EV with `confidence` + `oddsSource`. Extend a `basis:
  "live" | "estimated" | "heuristic"` field through `OfferAdvantageScore` and `DoNextItem`; render
  a small badge (dot + tooltip) wherever a £-EV is shown.
- **Why:** Trust. "£16 retained" from live exchange odds and from a heuristic guess must not look
  identical. This is the cheapest possible "surface the edge honestly" win.
- **How:** Add the field at the estimator (`advantage.ts` knows which branch produced the number);
  UI badge component reused from the Racing Desk confidence chip.

### A3. Expected-vs-realized: the EV Capture Rate (flagship metric)

- **What:** Snapshot `expectedProfit` (and its basis) at the moment an offer transitions to
  Active — call it the **EV lock**. At Settled, diff against realized net P&L and decompose:
  commission drag, odds drift, voids, execution error. Show per-offer post-mortem line:
  *"Expected +£14.20 → Realized +£11.80 · 83% captured"*.
- **Why:** This IS question 3 ("did it actually pay") answered per-offer, and it powers every
  analytics feature downstream (A4, B7, B8). Today expectedProfit is mutable so the comparison is
  impossible — that's the gap.
- **How:**
  1. Schema: `offer_ev_snapshots` table (offerId, lockedAt, expectedProfit, basis, inputsJson).
     Write on Planned→Active transition in the pipeline service.
  2. Settlement hook computes capture % and decomposition; store on the snapshot row.
  3. Render in offer detail + history entry.
- **Conundrum — what counts as "expected"?** Offers evolve (user edits stake, odds move before
  placement). Rule: the lock happens at Active; edits after Active create a *new* snapshot version
  with a visible "re-locked" marker, and capture is measured against the latest lock. Never
  silently mutate.

### A4. "Edge on the table" as the Home hero

- **What:** Home currently leads with balances/P&L. Lead instead with one number: **"£47 of edge
  available today"** = sum of `remainingEv` across actionable Do Next items, with the queue as its
  breakdown and provenance badges (A2) inline.
- **Why:** The app's promise in one glance. Also the anchor widget for the mobile swipe deck (§4).
- **How:** Mostly re-layout; the sum already exists in `do-next.ts`. Add a small sparkline of
  "edge captured this week" once A3 lands.

### A5. No-vig fair odds in the visible UI

- **What:** `ev.ts#noVig()` is well-tested but invisible. Show overround/fair-odds context in the
  calculators and on Racing Desk runners ("2.5% over fair").
- **Why:** Direct edge-surfacing; the maths is already written and tested.

---

## 3. Track B — The three daily questions (future features)

### Question 1: "What should I do next?"

**B1. The Daily Plan (run-sheet, not a list).**
Merge offers (expiry), racecards (off times), fixtures (kickoffs), and Do Next actions into a
single time-ordered schedule for today: "09:30 qual bet Bet365 → 13:35 Haydock race → 20:00 2UP
kickoff", each slot with expected £ and a deep link. All the data exists (offer calendar, racing
desk, fixtures); the work is a merge + a timeline view. This becomes the default mobile Home
widget in the morning.
*Conundrum — plan vs reality drift:* races get abandoned, odds move. The plan re-generates on
every state poll; completed/impossible slots collapse rather than reorder, so the user's mental
model isn't shuffled mid-session.

**B2. EV per minute (£/hr sort).**
A £2 offer taking 90 seconds beats a £5 offer needing 20 minutes of racecard study. Assign rough
effort weights per `OfferNextActionKind` (config map, user-tunable later), expose "£/hr" as a
third sort in `do-next.ts` alongside priority/edge.

**B3. Bankroll-aware ranking.**
Balances per bookmaker/exchange are tracked. Flag Do Next items the user cannot fund ("needs £25
in Betfair — £14 short"), and synthesize the transfer/deposit as its own queue item with the
downstream EV attached ("unlocks £11 edge").

**B4. Paste-to-plan (extend the parser).**
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
payout triggered. Lay the draw at ~4.2 to lock +£8." Delivery: web push (PWA, iOS ≥16.4) with a
local-notification fallback while single-user.
*Conundrum — polling cost vs latency:* goals need ≤60s detection. Poll API-Football only during
windows where the user has an open 2UP position (the app knows this from open bets), not all day.
Cost stays near zero for a single user; at multi-tenant scale one poller serves all users watching
the same match (§6.2).

**B7. Mistake ledger.**
When A3 shows realized < expected, prompt one tag: "laid late" / "wrong market" / "odds moved" /
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

**B10. Retained P&L integrity pass.**
Audit that every P&L surface is net of commission and handles voids/Rule-4 identically (the calc
layer does; verify the history feed and dashboards agree). Add a "gross vs retained" toggle on the
P&L chart so the commission gap is *visible* rather than silently netted.

---

## 4. Track C — Mobile experience (D3)

Target: **responsive PWA. 70–80% of the product reachable on mobile; the daily-driver 20% is
excellent.** No native app initially (review friction for gambling-adjacent apps, store cut,
Next.js reuse).

### 4.1 Interaction model: the Home swipe deck

Home widgets (Edge hero, Live P&L chart, Feed, Do Next, Daily Plan) become a **horizontally
swipeable deck** on mobile — one widget in focus at a time, pagination dots, remembered last
position. This was chosen over tabs/sub-nav because:
- It preserves the "glanceable desk" feel: swiping is browsing, tabs are navigating.
- Each widget gets the full viewport, so charts stay legible without shrinking.
- The deck order can be **context-aware**: morning → Daily Plan first; open positions → Live P&L
  first; otherwise → Edge hero. (Deterministic rules, not ML; user can pin an order.)

Implementation notes: CSS scroll-snap on a flex row (`overflow-x: auto; scroll-snap-type: x
mandatory`), each child `scroll-snap-align: center`. No carousel library needed. Desktop keeps
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

## 5. Sequencing

Personal-product-first (D1) ordering. Each phase is shippable and personally useful.

| Phase | Contents | Exit criteria |
|-------|----------|---------------|
| **1. EV truth** | A1 retention, A2 provenance, A3 EV lock + capture, A4 hero, A5 no-vig UI | Every £-EV on screen has a basis badge; settled offers show capture %; Home leads with edge-on-the-table |
| **2. Daily driver** | B1 Daily Plan, B2 £/hr, B3 bankroll-aware, B10 retained-P&L audit | A full offer day can be run start-to-finish from the plan view alone |
| **3. Mobile** | §4 swipe deck, quick-log (+B4 parser), collapsed variants, PWA install + local alerts | Log a bet in ≤3 taps on a phone; Home usable one-handed |
| **4. Guardian** | B5 naked-exposure, B6 2UP sentinel, push alerts | A deliberately-left-unhedged test bet alerts within threshold; a live 2UP fires a push |
| **5. Coach** | B7 mistake ledger, B8 Edge Report, B9 league table | Monthly report renders from ≥1 month of real captured data |
| **6. Business gate** | §6 — only if gate criteria met | See §6.1 |

Phases 1–2 are pure lib/UI work on existing data — ideal for local-model iteration (small,
well-tested pure functions). Phase 3 is UI-heavy. Phases 4+ touch polling/notifications.

---

## 6. Track D — The business path (if/when)

### 6.1 The gate (D1: product-first)

Do **zero** multi-tenant work until all of:
1. You personally run EdgeDesk daily for ≥2 months (Phases 1–4 shipped and sticky for you).
2. ≥5 external matched bettors ask to use it after seeing it (share screenshots in
   r/MatchedBettingUK / MB Discords — this doubles as demand testing).
3. The Edge Report (B8) shows the product measurably improves capture rate — that's the sales pitch,
   generated by the product itself.

Until then, the only business-proofing allowed is *passive*: keep feeds behind service interfaces,
keep user-scoped data keyed by account, don't hardcode "the user" into new schema.

### 6.2 Architecture evolution (when the gate opens)

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
- **Betfair commercial data licensing needs a proper legal read before any paid tier ships live
  exchange prices.** Cache aggressively; gate live-lay polling to the top tier.

### 6.3 The oddsmatching conundrum (D2)

Full oddsmatching = continuous multi-bookmaker odds feeds — the incumbents' moat and their main
cost. EdgeDesk should **not** attempt it until Edge-tier revenue can fund it and demand is proven.
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

### 6.4 The data moat

Every month of use makes the product more personal and harder to leave: measured retention (A1),
capture rate history (A3), mistake taxonomy (B7), bookmaker health (B9). None of this is
replicable by an incumbent bolting on a tracker, because it requires the execution loop to run
*through* the product. Marketing writes itself from B8: "I captured 91% of my theoretical edge
this month."

### 6.5 Tiers & pricing (draft, revisit at gate)

| Tier | Price | Contents | Logic |
|------|-------|----------|-------|
| Free | £0 | Calculators, manual tracking, basic P&L | Funnel + community trust |
| Core | ~£9.99/mo | Pipeline, Do Next, Daily Plan, EV capture analytics, Edge Report | All-lib features, near-zero COGS |
| Edge | ~£24.99/mo | Racing Desk live feeds, 2UP sentinel + push, exchange integration, league table | Carries the API costs; anchored just under Outplayed |

Annual ≈ 2 months free. 14-day Edge trial. Gate by *data cost and edge delivered* — which maps
cleanly onto the existing desks.

### 6.6 Compliance & go-to-market checklist (at gate)

- 18+ gating, BeGambleAware messaging, UK ad-standards review for gambling-adjacent products.
- No gambling licence needed (the product never takes a wager) — confirm with a solicitor anyway.
- Betfair/Racing API/API-Football ToS re-read for redistribution once proxying (§6.2).
- Beta via r/MatchedBettingUK + MB Discords; these communities make or break tools in this niche.
- Content/SEO on "matched betting tracker / spreadsheet / EV" terms — high intent, weak incumbents.
- App stores: revisit only after PWA push proves insufficient; expect gambling-category friction.

---

## 7. Open questions & risks

| Item | Status |
|------|--------|
| Betfair commercial data licence terms for a paid product | Unresolved — blocks Edge tier live lays, not personal use |
| iOS PWA push reliability in practice (backgrounded Safari) | Test during Phase 3; fallback is timeline-visible alerts + email |
| Racing API rate limits vs multi-race live polling on race days | Measure during Phase 4; may force snapshot cadence tiers |
| Effort weights for £/hr (B2) — initial values are guesses | Ship with config map; tune from own usage |
| When does expectedProfit get re-locked vs versioned (A3) | Decided: version on post-Active edits, never mutate; UI shows "re-locked" |
| Multi-tenant route choice (hosted vs local-first sync) | Deferred to gate; leaning Route 2 (local-first + feed proxy) |
