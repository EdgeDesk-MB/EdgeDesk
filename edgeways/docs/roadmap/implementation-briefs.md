# Edgeways Implementation Briefs

> **How to use this document.** Each brief below is a self-contained work order for a developer or
> AI coding agent. Briefs assume NO memory of prior conversations — everything needed is stated.
> They map 1:1 to the features in `docs/roadmap/product-roadmap.md` (IDs A1–A5, B1–B10, C1–C4)
> and are grouped by roadmap phase. Do briefs in order within a phase; cross-brief dependencies
> are called out explicitly.
>
> **Sizing tags:** `[local]` = suits a small local model (pure functions, isolated UI, strong
> existing test coverage). `[strong]` = use a stronger agent (schema, cross-cutting, or judgment-
> heavy). `[design-first]` = wait for a mock/wireframe from Sam before building UI.

Last updated: 2026-08-05 (L4 Offer qualifier shape → Acca Desk routing briefed. Phase 14 Offer
Edge in progress; N0 entitlement scaffolding ⏸ gated — L4 ships a thin `acca_desk` can() stub
that folds into N0 later.)

---

## 0. Repo conventions every agent must know

- **Git root is the PARENT directory** `MB app build/`, not `edgeways/`. Git paths are prefixed
  `edgeways/`. Run all npm commands from `edgeways/`.
- **This is Next.js 16** — APIs may differ from training data. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing App Router / server code (per `AGENTS.md`).
- **Tests:** `npx vitest run` from `edgeways/`. 1,102 tests / 130 files must stay green.
  `vitest.setup.ts` gives each test process an isolated temp SQLite DB via `EDGEWAYS_DB_PATH`.
  `server-only` is stubbed via alias in `vitest.config.ts` — server modules are importable in tests.
- **DB migrations:** there is NO drizzle-kit migration tooling. `src/lib/db/index.ts` runs an
  idempotent bootstrap: `CREATE TABLE IF NOT EXISTS ...` for new tables, plus an additive
  `ALTER TABLE ... ADD COLUMN` helper (see ~line 178) for new columns on existing tables. A new
  table therefore needs BOTH: (1) a Drizzle table in `src/lib/db/schema.ts`, (2) a matching
  `CREATE TABLE IF NOT EXISTS` block in `src/lib/db/index.ts`.
- **Times:** all stored times are epoch ms or canonical 24h `HH:mm` strings. Render times of day
  ONLY via `formatClockTime` / `formatClockString` from `src/lib/time-format.ts` (respects the
  user's 12h/24h preference). Never `toLocaleTimeString` directly.
- **Money display:** follow existing patterns (NumberFlow on dashboard, `£x.toFixed(2)` in libs).
- **Do NOT refactor `src/lib/calc/ep/engine.ts`** (spec-locked; header comment says why). Adding
  consumers is fine; changing combinatorics/normalisation is not.
- **Key data shapes** (verified 2026-07-12):
  - `OfferSummary` (`src/lib/services/offers.types.ts`): `OfferRow` + `betCount`, `openBets`,
    `actualProfit`, `expectedFromBets`, `profit: OfferProfitBreakdown`, `recurrence?`.
  - `OfferProfitBreakdown`: `qualifyingProfit/SettledCount/OpenCount`, `freeBetAwarded`,
    `freeBetAwardAmount`, `freeBetStage` (`none | awaiting_result | not_awarded | awarded | in_use | settled`),
    `freeBetProfit`, `freeBetOpenCount/SettledCount`, `openExpectedProfit`, `totalProfit`.
  - `offers` table: `expectedProfit`, `status` enum `planned|active|completed|expired`,
    `expiresAt`, `rules` (JSON text), `seriesId`, `instanceDate`, racing scope fields.
  - `bets` table: `betType` (text, e.g. `qualifying|free_snr|free_sr|risk_free`), `backStake`,
    `backOdds`, `layStake`, `layOdds`, `commission` (default 0.02), `legs` (dutch JSON), `status`
    enum `open|won|lost|void|early_payout|half_win|half_lose|push`, `expectedProfit`,
    `actualProfit`, `settledAt`, `offerId`, `eventId`.
  - Pipeline stage is **derived, not stored**: `deriveOfferPipelineStage(offer)` in
    `src/lib/offers/pipeline.ts` maps status + profit breakdown → stage.
  - Settings are key-value rows in `app_settings`, accessed via `readRaw`/`writeRaw` in
    `src/lib/services/settings.ts`; client-safe shape `AppSettings` + `DEFAULT_SETTINGS` in
    `src/lib/services/settings-shared.ts`. New settings need: interface field, default, read in
    `getAppSettings()`, write branch in `patchAppSettings()`, body handling in
    `src/app/api/settings/route.ts`, and UI in `src/app/settings/page.tsx`.
  - App state polling: `src/components/app-state-provider.tsx` fetches `/api/state` every
    `dashboardPollMs` (default 3000). `AppState` (`src/lib/services/state.types.ts`) already
    carries `bets`, `events`, `livePositions`, `liveEventModels`, `history`, `settledProfit`, etc.
  - Free-bet lots: `src/lib/accounts/free-bet-lot-balance.ts` (`FreeBetLot`, `listFreeBetLots`,
    `sumFreeBetLotBalance`, `targetedLotId`) and `src/lib/accounts/free-bet-lots.ts`
    (`listAllOpenFreeBetLots`, `removeFreeBetLot`). Ledgering lives in
    `src/lib/services/balances.ts` (`ledgerBetSettlement`, `ledgerPromoAward`,
    `syncCasinoOfferBalance`, …).
  - P&L buckets (`src/lib/pnl/pnl-buckets.ts`): `bettingProfit` (settled bets) +
    `casinoProfit` (completed `casino_offers.actualProfit`) + manual affectPnl
    adjustments = `settledProfit`. Casino ledger: `balance_transactions.category =
    casino_settlement` (wallet) + `history.kind = casino_settlement` (History/Home
    feed). Do not also set `affectPnl` on the wallet row (would double-count).

---

# PHASE 1 — EV TRUTH

## A1. Measured free-bet retention `[strong]` ✅ DONE

**Objective.** Replace the hardcoded `DEFAULT_FREE_BET_RETENTION = 0.8`
(`src/lib/offers/advantage.ts:7`) with the user's measured conversion retention, with a Bayesian
blend for small samples. Surface the measured rate in the UI.

**Why.** Every "£ remaining edge" figure in Do Next / Best Advantage inherits this constant.
Measuring it makes all EV honest and personal, and seeds the data moat.

**Definition of retention.** For each settled conversion bet
(`betType IN ('free_snr','free_sr')`, `status NOT IN ('open','void')`): retained cash ≈ realized
return of the conversion. Numerator = sum of `actualProfit` for `free_snr` (SNR: stake not
returned, so actualProfit ≈ retained cash) and `actualProfit` for `free_sr` where meaningful;
denominator = the free-bet face value. Face value resolution order:
1. the originating lot amount when the bet's `notes` carry a lot marker (`targetedLotId()` in
   `free-bet-lot-balance.ts` shows the existing marker convention);
2. else the linked offer's `profit.freeBetAwardAmount`;
3. else `backStake` (SNR free bets are logged with stake = face value).
Skip bets where no face value can be resolved; count them in `skipped`.

**Files.**
- NEW `src/lib/services/retention.ts` —
  `getRealizedRetention(): { rate: number; sampleSize: number; skipped: number }` (server;
  queries `bets` via `db`), and a pure, client-safe blend helper in
  NEW `src/lib/offers/retention-shared.ts`:
  `blendedRetention(measured: number, n: number, prior = 0.8, priorWeight = 5): number`
  → `(measured * n + prior * priorWeight) / (n + priorWeight)`. n=0 → prior; large n → measured.
- `src/lib/offers/advantage.ts` — `estimateOfferRemainingEv` and `scoreOfferAdvantage` gain an
  optional `opts?: { retention?: number }` parameter (default 0.8 so existing call sites/tests
  are unaffected). Replace both uses of `DEFAULT_FREE_BET_RETENTION` with the param.
- `src/lib/offers/do-next.ts` — `buildDoNextItems(offers, lots, now, opts?)` threads retention to
  the advantage calls.
- `src/lib/services/state.ts` + `state.types.ts` — add `retention: { rate, sampleSize }` to
  `AppState` so the client gets it each poll.
- `src/components/dashboard/dashboard-do-next.tsx` and `dashboard-best-advantage.tsx` — pass
  `state.retention.rate` through; add caption "Your retention: 78% · 23 conversions" (hide when
  `sampleSize < 5`, show "using 80% default").

**Nuance / edge cases.**
- Voids and `half_win/half_lose/push` conversion bets: exclude voids entirely; include
  half-results at face value (their actualProfit already reflects the half).
- Window: all-time for v1. Leave a `windowDays?` param on `getRealizedRetention` for later.
- Do NOT persist the rate — recompute per state build (cheap query, single user).

**Acceptance.** Unit tests for `blendedRetention` (n=0, n=5, n=100) and for face-value resolution
order; existing advantage tests still pass unchanged (default param proves backward compat);
Do Next EV visibly shifts when a conversion settles.

---

## A2. EV provenance badges `[local]` ✅ DONE

**Objective.** Every £-EV shown carries a `basis: "live" | "estimated" | "heuristic"` and the UI
shows it as a small badge.

**Why.** "£16 retained" from live exchange odds and from a fudge factor must not look identical.

**Files.**
- `src/lib/offers/advantage.ts` — `estimateOfferRemainingEv` return gains `basis`:
  - `freeBetStage === "awarded"` branch → `"estimated"` when using measured retention (A1,
    sampleSize ≥ 5), else `"heuristic"`;
  - explicit `expectedProfit` branches → `"estimated"` (user-entered);
  - the `rules && stage none` rough branch (the `* 0.35` one) → `"heuristic"`;
  - `expectedFromBets` open-legs branch → `"estimated"`.
- `src/lib/offers/do-next.ts` — add `basis` to `DoNextItem`; pass through.
- NEW `src/components/ui/ev-basis-badge.tsx` — tiny dot+tooltip component. Reuse the visual
  pattern of the Racing Desk confidence chip (see how `confidence: "live"|"mixed"|"estimate"` is
  rendered in `src/components/racing/` — match colours: live=emerald, estimated=sky,
  heuristic=amber).
- Render in `dashboard-do-next.tsx`, `dashboard-best-advantage.tsx`, offer detail
  (`src/components/offers/offer-campaign-card.tsx`).
- Racing surfaces keep their existing `confidence` chip — map `live→live`, `mixed→estimated`,
  `estimate→heuristic` if unifying visuals, but do not change racing data flow.

**Acceptance.** Every dashboard EV figure renders a badge; unit tests assert the basis per
estimator branch.

---

## A3. EV lock + capture rate `[strong]` ✅ DONE — cornerstone; B7/B8 depend on it

**Objective.** Snapshot expected profit when a campaign starts; at settlement compute
capture % and decomposition. Never mutate a lock — version it.

**Why.** `offers.expectedProfit` is freely editable, so "expected vs realized" is currently
impossible. This brief creates the immutable baseline that Phases 4–5 analytics need.

**Schema (follow §0 migration pattern — schema.ts table + CREATE TABLE IF NOT EXISTS in db/index.ts).**
```sql
CREATE TABLE IF NOT EXISTS offer_ev_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  locked_at INTEGER NOT NULL,
  expected_profit REAL NOT NULL,
  basis TEXT NOT NULL,              -- "live" | "estimated" | "heuristic" (from A2)
  inputs_json TEXT,                 -- { retentionUsed, freeBetAmount, stake, ... } for audit
  -- settlement fill-in (nullable until settled):
  realized_profit REAL,
  capture_pct REAL,
  commission_drag REAL,
  settled_at INTEGER
);
```

**Lock trigger points** (all in `src/lib/services/offers.ts`):
1. Offer created directly with `status: "active"` (see the `.values({ ... status: "active" })`
   insert around line 279) → write snapshot v1.
2. Any transition `planned → active` (the `.set({ status: "active" })` updates around lines
   490–498) → write snapshot v1 if none exists.
3. Edit to `expectedProfit` while a lock exists and the campaign is not settled → write a NEW
   version (v2, v3…) — never update v1. Capture is measured against the LATEST version.

**Settlement fill-in.** The moment `deriveOfferPipelineStage(offer)` returns `"settled"`
(detect in the same server path that assembles `OfferSummary` — where profit breakdowns are
computed in `offers.ts`): fill the latest snapshot once (`realized_profit = profit.totalProfit`,
`capture_pct = realized/expected` clamped to [−∞, 2] for display sanity, `commission_drag` = sum
of `layStake * commission` over the offer's settled winning-lay legs — reuse the commission
maths already in `src/lib/calc/settlement.ts` rather than reimplementing). Idempotent: skip if
`settled_at` already set.

**Read path.** New pure lib `src/lib/offers/ev-capture.ts`:
`captureSummary(snapshots: SnapshotRow[]): { expected, realized, capturePct, version } | null`.
Expose latest-snapshot data on `OfferSummary` as `evLock?: { expectedProfit, basis, version,
capturePct?: number }` (extend `offers.types.ts`; populate in `offers.ts` list assembly).

**UI.** Post-mortem line on the offer campaign card (`offer-campaign-card.tsx`) when settled:
"Expected +£14.20 → Realized +£11.80 · 83% captured". History entry enrichment can wait for B8.

**Nuance.**
- Offers with NO expectedProfit at activation: lock `expected_profit` from
  `estimateOfferRemainingEv(offer).remainingEv` with its basis — a heuristic lock is still a
  baseline; `inputs_json` records that it was auto-derived.
- Recurring instances (`seriesId` set) lock independently per instance row.
- Expired offers: fill the latest snapshot with realized-to-date and `capture_pct` accordingly;
  an expired unstarted offer records realized 0 (lost EV is real signal).
- Voided campaigns: `capture_pct = null` when `expected_profit ≈ 0` (avoid div-by-zero).

**Acceptance.** Vitest (server-side, uses temp DB): activation writes v1; editing expectedProfit
post-activation writes v2 and leaves v1 untouched; settling fills exactly once; capture math
tests for the div-by-zero and expired cases. UI shows the post-mortem line.

---

## A4. "Edge on the table" Home hero `[local]` ✅ DONE

**Objective.** Home leads with one number: the sum of `remainingEv` over actionable
(`isActionableOfferNext`) Do Next items, with provenance-aware styling and the queue beneath.

**Files.** `src/app/page.tsx` (composition: currently `DashboardOverviewBar` → `DashboardDoNext`
→ chart/tabs — the hero joins/replaces the top of this stack), NEW
`src/components/dashboard/dashboard-edge-hero.tsx`, sum helper added to `do-next.ts`:
`sumActionableEv(items: DoNextItem[]): { total: number; weakestBasis: "live"|"estimated"|"heuristic" }`
(weakest basis across contributors governs the hero's badge — a total built on any heuristic
input is labelled heuristic).

**Nuance.** Use NumberFlow for the figure (matches dashboard idiom). When total < £1 show the
empty/quiet state ("No edge queued — add offers") rather than £0.00. Mobile: this component
becomes deck card #1 in C1 — build it viewport-width-friendly from the start.

**Acceptance.** Unit test for `sumActionableEv` (excludes `await_result`, weakest-basis logic).
Visual check desktop + 390px width.

---

## A5. No-vig fair odds in the UI `[local]` ✅ DONE

**Objective.** Surface `noVig()` / `expectedValue()` from `src/lib/calc/ev.ts` (already tested)
in the calculators and Racing Desk runner rows.

**Files.** Calculator pages under `src/app/calculators/` (locate the odds-input components; add a
"fair odds / overround" line beneath market inputs where a full market's odds are present).
Racing: `src/components/racing/flashscore-racecard.tsx` runner rows — when a race has
`bookieDecimal` for most runners, compute market overround once per race and show each runner's
"x% over fair" delta. Compute in a pure helper NEW `src/lib/racing/fair-odds.ts`
(`raceFairOdds(runners): Map<horseId, { fair: number; overPct: number }>`) so it's testable.

**Nuance.** Only compute when ≥ 80% of non-non-runner field has prices (partial markets produce
nonsense overrounds — show nothing rather than a wrong number, matching the app's honesty
principle). Exclude `nonRunner: true`.

**Acceptance.** Unit tests: full market, partial market (returns null), non-runner exclusion.

---

# PHASE 2 — DAILY DRIVER

## B1. The Daily Plan `[strong]` `[design-first]` ✅ DONE

**Objective.** One time-ordered run-sheet for today merging: offer next-actions with deadlines
(`offer-calendar.ts` already classifies today/critical), tracked races (off times), fixture
kickoffs for open/planned 2UP bets, and untimed Do Next items (as an "anytime" bucket).

**Files.**
- NEW `src/lib/plan/daily-plan.ts` (pure): `buildDailyPlan(input: { offers: OfferSummary[];
  doNext: DoNextItem[]; races: { course, offTime epoch, workflowState }[]; fixtures: { kickoff,
  label, betId? }[]; now: number }): DailyPlanSlot[]` where `DailyPlanSlot = { at: number | null;
  kind: "offer_action" | "race" | "kickoff" | "anytime"; title; detail; ev?: number;
  basis?: ...; href; done: boolean }`. Reuse `priorityFromSignals` and the today-classification
  from `src/lib/offers/offer-calendar.ts` — do not duplicate that logic.
- NEW `src/components/dashboard/daily-plan.tsx` — timeline list; render times via
  `formatClockTime`; completed/impossible slots collapse (opacity + strikethrough) but DO NOT
  reorder (stable mental model — this is a deliberate product rule).
- Data assembly server-side in `state.ts` (races/fixtures already flow through app state and the
  racing desk payload; expose the minimal slot inputs on `AppState` rather than importing racing
  services client-side).

**Nuance.** "Done" detection per kind: offer_action → the action no longer appears in
`listOfferNextActions`; race → racing workflow logged (race `trackedEventId` + open bet) or
off-time passed; kickoff → bet settled. Regenerate every poll; slots keyed by stable ids so React
doesn't remount on refresh. Timezone: epochs only; display layer handles zone/format.

**Acceptance.** Pure-lib tests: ordering (timed asc, anytime last), done-collapse rules, stable
ids across rebuilds. Manual: a real offer day renders a coherent morning-to-night sheet.

## B2. £/hr sort `[local]` ✅ DONE

**Objective.** Third Do Next sort: EV per estimated effort-minute.

**Files.** `src/lib/offers/do-next.ts` — `DoNextSort = "priority" | "edge" | "rate"`; NEW config
map `EFFORT_MINUTES: Record<OfferNextActionKind | "orphan_free_bet", number>` initial values
`{ start_planned: 10, place_qualifying: 8, convert_free_bet: 6, review_expiry: 2,
await_result: 0, orphan_free_bet: 6 }` (guesses — tune later, keep exported for a future
settings surface). `rateScore = remainingEv / max(minutes, 1) * 60` (£/hr). Sort toggle UI in
`dashboard-do-next.tsx` follows the existing priority/edge toggle pattern.

**Acceptance.** Unit test: a £2/90-second item outranks a £5/20-minute item under "rate".

## B3. Bankroll-aware ranking `[strong]` ✅ DONE

**Objective.** Flag Do Next items the user cannot fund; synthesize a transfer/deposit item
carrying the unlocked EV.

**Files.** `src/lib/services/balances.ts` (`getBalanceSummary`, `findBookieAccount` already
exist), `do-next.ts` gains `funding?: { needed: number; available: number; short: number }` per
item, computed from the offer's stake requirement (`stakeFromOfferPrefs` in
`settings-shared.ts` resolves the intended stake) vs the matched bookie account balance.
Insufficient → item stays ranked but renders a "£14 short at Bet365" chip; additionally emit one
synthetic item per shortfall account: kind `"fund_account"`, EV = sum of EV it unlocks, href to
`/balances`.

**Nuance.** Only bookie-side stake is checked in v1 (exchange liability check needs lay odds that
may not be known yet — note as TODO in code). Accounts are matched by `findBookieAccount(name)`
normalisation; unmatched bookmaker → no funding info (never a false "short" flag).

**Acceptance.** Unit tests with a fake balance map: funded, short, unmatched-bookie cases; the
synthetic fund item sums EV across multiple blocked offers on the same account.

## B4. Paste-to-log (bet confirmations) `[strong]` ✅ DONE

**Objective.** Paste bookie bet-confirmation text → prefilled Add Bet. The mobile quick-log
backbone (C3).

**Files.** NEW `src/lib/bets/parse-bet-text.ts` (pure) — mirror the architecture of
`src/lib/offers/parse-offer-text.ts` (same repo idiom: exported `parseBetText(raw: string):
ParsedBet | null` + small composable extractors + heavy test file). Target fields: bookmaker
(match against known account names + common aliases), stake (£x), odds (fractional "5/2" and
decimal "3.5" — fractional→decimal helper may already exist in `src/lib/calc/odds.ts`; check
before writing one), selection, market hints, free-bet markers ("SNR", "free bet") → `betType`.
Wire into `src/components/add-bet-dialog.tsx` as a "Paste slip" affordance that prefills the
form (user always confirms — never auto-submit).

**Nuance.** Confidence per field: return `{ value, confident: boolean }` so the dialog can
highlight low-confidence prefills for review. Unparseable → return null, dialog shows nothing
(no error state needed). Build the test corpus from real slips (Bet365, SkyBet, Ladbrokes,
William Hill formats) — Sam to supply samples; start with 4–5 synthetic ones.

**Acceptance.** ≥ 12 parser unit tests incl. fractional odds, each-way slips, free-bet slips,
garbage input → null.

## B10. Retained P&L integrity pass `[strong]` ✅ DONE (audit, then small fixes)

**Objective.** Verify every P&L surface is net of commission and treats
voids/`half_*`/`early_payout`/Rule-4 identically; add a gross-vs-retained toggle on the P&L chart.

**Method.** Trace `actualProfit` writes (settlement paths in `src/lib/calc/settlement.ts`,
`src/lib/calc/racing-settlement.ts`, trigger engine) → `settledProfit`/`provisionalProfit`
aggregation in `state.ts` → `live-pnl-chart.tsx` and `dashboard-pnl-summaries.tsx` and
`history-feed.ts`. Document findings as comments in a short section appended to THIS file.
Fix any surface that disagrees. Then: chart toggle "Retained | Gross" where gross =
retained + commission paid (needs commission-paid accumulation exposed from settlement — add
`commissionPaid` to the series point build in `state.ts`).

**Acceptance.** Written audit trail; any fix has a regression test; toggle renders both series.

### B10 audit trail (2026-07-13)

Traced every `actualProfit` write → aggregation → display surface. Verdict: **all surfaces
agree** — every P&L figure derives from `bets.actualProfit`, which every settlement path
writes net of commission. No disagreeing surface found; no calc fix needed.

**Write paths (all commission-netted at source):**
- Auto-settle + trigger engine (`state.ts#autoSettle`/`settleTriggers`) → `settleFromOutcome`
  (`calc/settlement.ts`): winning lays credit `layStake × (1 − commission)`.
- Racing (`calc/racing-settlement.ts`): win/place via `settleFromOutcome`; EW/extra-place dual
  lays via `eachWayOutcomePnL` (`calc/each-way-outcomes.ts`) — commission netted per winning lay leg.
- Partials (`settlePartialOutcome`): half outcomes average the full win/lose P&L, so half the
  commission is embedded; push/void are £0.
- Manual settle (`bet-log-table.tsx#ManualSettleDialog`): won/lost take the user's NET figure
  (labelled so); half/push/void computed via `settlePartialOutcome`.

**Aggregation surfaces (all read stored `actualProfit`):** `state.ts` series/`settledProfit`;
`offers.ts#computeOfferProfitBreakdown`; `pnl/monthly-breakdown.ts`; history feed (via
`history-display` context). Filter nuance: `state.ts` includes `push` rows where `offers.ts`
excludes them — numerically identical since push profit is always £0.

**Documented non-findings:**
- Rule 4 is a calculator only (`calc/rule4.ts`); the result-centric engine cannot auto-apply
  deductions (results carry no withdrawal data), so Rule-4-affected bets settle via the manual
  net-P&L path. Intentional.
- Gross decomposition for manually settled EW dual-lay wins is unknowable (no settlement
  marker in notes) — `commissionPaidOnSettledBet` counts £0 commission for those, so the
  gross toggle understates gross (never retained) in that corner. Auto-settled bets are
  exact: winning-lay markers in the settlement explanation ("lay side won", "Extra place",
  "standard place") disambiguate EW paid-but-lay-won cases, and lay-only half outcomes
  carry half commission, mirroring `settlePartialOutcome`.

**Toggle implementation:** `calc/commission-paid.ts` (pure, tested) derives commission paid
per settled bet; `state.ts` accumulates it as `commissionPaid` on each series point;
`live-pnl-chart.tsx` renders a Retained | Gross pill pair (gross = value + commissionPaid).

---

# PHASE 3 — MOBILE (Track C) — all `[design-first]`, build after Sam's wireframes

## C1. Home swipe deck `[strong]` ✅ DONE

CSS scroll-snap deck replacing the vertical stack on `< sm` only: container
`overflow-x-auto snap-x snap-mandatory flex`, children `snap-center shrink-0 w-[92vw]`.
Cards: Edge hero (A4), Daily Plan (B1), Live P&L chart, Feed, Do Next. Desktop layout untouched —
same components, different container in `src/app/page.tsx`; **widgets must not know which mode
they're in**. Pagination dots + last-position memory (sessionStorage, pattern:
`racing-settle-prompt.tsx` uses the same storage idiom). Context-aware initial card
(deterministic): open `livePositions` → chart; before 12:00 with plan slots → Daily Plan; else
hero. User pin overrides (a setting, added per §0 settings checklist).

## C2. Progressive disclosure audit `[local]` ✅ DONE (primary surfaces; calculator-page tables deferred)

Every dashboard/desk card gets a collapsed `< sm` variant: headline stat + one line, expand in
place. Racing Desk mobile default = race strip + suggested races + workflow steps
(`racing-offer-guide.tsx`); full runner grid behind a tap. Tables → card lists at `< sm`
(tracker, history — partially done; finish and make consistent).

## C3. Quick-log sheet `[strong]` ✅ DONE — needs B4

Floating "+" on mobile (add to `src/components/app-nav.tsx` mobile chrome) → bottom sheet with
three paths: Paste slip (B4), From plan (today's B1 slots → one-tap "placed"), Minimal manual
(bookie/stake/odds only). Writes flag the bet `quick-logged` (new nullable text column
`quick_logged` on `bets` per §0 additive-column pattern, or reuse `notes` marker — decide with
Sam; column preferred for querying). **Decision: INTEGER epoch-ms column `quick_logged` (2026-07-13).** Desktop tracker shows a "review quick-logged" filter chip.
**Mobile captures, desktop curates** — the sheet never demands full data.

## C4. PWA + local alerts `[strong]` ✅ DONE

Manifest + service worker (read Next 16 PWA guidance in `node_modules/next/dist/docs/` first —
conventions may differ from training data). iOS install prompt on first mobile visit
(dismissible, once). Alert scheduler v1 is LOCAL (single-user): a client module watching app
state, firing Notification API notifications, each type toggleable in Settings:
offer-expiring-with-EV, race-off-time-approaching-with-unfinished-workflow, result-settled.
Define `interface AlertChannel { notify(alert: EdgeAlert): void }` so Phase-4 push and any
future server backend swap in without touching alert-rule logic.

---

# PHASE 4 — GUARDIAN

## B5. Naked-exposure sentinel `[strong]` ✅ DONE — after C4's AlertChannel

**Objective.** Alert on open back bets with no lay past a threshold.

**Detection (pure lib, NEW `src/lib/bets/naked-exposure.ts`).** A bet is naked-exposed when:
`status === "open"` AND `betType IN ("qualifying","risk_free")` AND `backStake > 0` AND
`layStake === 0` AND `legs IS NULL` (dutch bets hedge internally) AND age >
threshold. Threshold: default 10 min; if `eventId` links to an event starting < 60 min away,
tighten to 3 min. Per-bet mute: marker in `notes` (`[intentional-nohedge]`) checked by the
detector; one-tap "intentional" button on the alert writes it.

**Why these bet types only:** `free_snr`/`free_sr` are routinely and correctly unhedged
(longshot SNR strategy) — alerting on them would train the user to ignore alerts.

**Surfaces.** Home banner (amber, pattern: `racing-settle-prompt.tsx`) + AlertChannel
notification. **Acceptance:** unit tests for every clause of the predicate incl. dutch exclusion
and mute marker; manual: log an unhedged qualifying bet, alert within threshold.

## B6. Live 2UP sentinel `[strong]` ✅ DONE — after C4

> **Implementation notes (2026-07-14).** Detection rides the existing `homeLed2`/`awayLed2`
> flags on live events (no new polling). The lock suggestion deviates deliberately from the
> roadmap's "lay the draw" sketch: backing the selection in-play equalises the win / not-win
> outcomes *exactly* (a draw lay leaves draw ≠ away-win), so the alert suggests the
> commission-aware equalising back from `calc/two-up-lock.ts` using the EP live model's win
> probability as fair odds. Alert copy: "Back at ~B for £s to lock £P either way."
>
> **Web push recommendation (the remaining Phase-4 line item).** Ship-state: sentinels
> deliver via the C4 AlertChannel (Notification API + toast fallback) — full coverage while
> Edgeways is open on any device, including the installed PWA. TRUE background push (app
> closed) needs: a `web-push` dependency (must be flagged/approved per repo rules), VAPID
> keys, a subscriptions table, an SW push handler, and the local server running and
> reachable from the phone. iOS delivery is the roadmap's own top open question and is only
> provable on Sam's actual phone (Android - simpler than iOS for push). Recommendation: add push as a follow-up item once the
> sentinels have proven their value in daily use — the AlertChannel interface means it swaps
> in without touching any rule logic.

**Objective.** Push "2-0 up — early payout triggered, lay the draw at ~X for +£Y" while a 2UP
position is open.

**Existing machinery.** `AppState.liveEventModels` + `src/lib/calc/ep/live-model.ts` and
`ep/live-pnl.ts` already model in-play state for EP positions; `bets.earlyPayout` flags 2UP
bets; `src/lib/services/apifootball.ts` fetches football data. The gap is (a) polling cadence
during exposure windows and (b) alert emission.

**Implementation.** Server: in the state/poll path, when any open bet has `earlyPayout = 1` and
its event kickoff ≤ now ≤ kickoff+130min, mark the app "in exposure window" — `/api/state`
consumers may poll API-Football for that event at ≤ 60s cadence (respect `apiUsage` budget
already tracked in AppState; skip when budget exhausted and surface that). Trigger condition:
lead reaches 2 goals for the backed team (from the live model) AND bet not yet settled →
emit once per bet (dedupe key `bet:{id}:2up-triggered`) through AlertChannel, with lock-in lay
maths from `ep/live-pnl.ts` outputs. **Never auto-place anything.**

**Acceptance.** Unit test the trigger/dedupe logic with synthetic live-model states; budget-
exhausted path shows a visible "sentinel paused (API budget)" note rather than failing silently.

---

# PHASE 5 — COACH

## B7. Mistake ledger `[strong]` ✅ DONE — needs A3

When a settled offer's capture < 90%, offer one-tap tags on the post-mortem line:
`laid_late | wrong_market | odds_moved | bookie_voided | other`. Store on the EV snapshot row
(new nullable `mistake_tag TEXT` via additive column). Aggregation pure lib
`src/lib/offers/mistakes.ts`: £ lost per tag per month (`expected - realized` summed by tag).
Surface inside B8's report. Never force tagging — skippable, editable later from offer detail.

## B8. Monthly Edge Report `[strong]` `[design-first]` ✅ DONE — needs A3, A1; B7 enriches

NEW route `src/app/report/page.tsx` + pure lib `src/lib/report/edge-report.ts`:
`buildEdgeReport(snapshots, bets, month): { cumulative: { t, expected, realized }[]; captureRate;
retentionTrend; commissionDrag; realizedPerHour?; mistakes? }`. The chart is THE product chart:
cumulative expected (from A3 locks, at lock time) vs cumulative realized (at settle time) —
follow `live-pnl-chart.tsx` charting idiom (Liveline). Months with < 5 settled campaigns render
a "not enough data" state, not noisy lines.

## B9. Bookmaker league table + account health `[strong]` ✅ DONE

> **Implementation deviation (2026-07-14).** The `accounts` table already carried
> `access_status` (`available|gubbed|closed`) as the manual source of truth for gubbing, so a
> second `health` value of "gubbed" would have created two competing flags. Shipped instead:
> the additive `health` column stores ONLY the `cooling` flag (null = healthy), and
> `effectiveBookmakerHealth()` in `src/lib/accounts/bookmaker-stats.ts` derives the three-state
> health: accessStatus gubbed/closed → "gubbed", manual cooling → "cooling", else "healthy".
> Everything downstream (league table, `scoreOfferAdvantage` ×0.1 sink, Do Next chips) consumes
> the derived state. Do Next scoping switched from `availableBookieNames` (which hid gubbed
> bookies' offers, violating this brief's acceptance) to `visibleBookieNames` (hides only
> closed/archived). Cooling is informational only - it never changes a score.

Pure lib `src/lib/accounts/bookmaker-stats.ts` over bets+offers+lots grouped by bookmaker:
realized ROI, retention (A1 per-bookie variant), offer frequency, days since last offer.
Health state is **manual-first**: new nullable `health TEXT` (`healthy|cooling|gubbed`) +
`health_updated_at` on `accounts` via additive columns; UI on `src/app/accounts` page.
Nudge (not auto-mark): offer drought > 40 days → "mark as cooling?" suggestion row.
Ranking feedback: `scoreOfferAdvantage` gains `opts.bookmakerHealth` — `gubbed` multiplies score
by 0.1 (visible strikethrough-style treatment in Do Next, never hidden entirely).
**Acceptance:** stats lib unit-tested; a gubbed bookie's offers sink in Do Next but remain
visible; no automatic health writes anywhere.

---

# PHASE 6 — YOUR RULES

## E1. Tunable thresholds & effort weights `[strong]` ✅ DONE

**Objective.** Every behaviour-defining hardcoded number becomes a setting whose default exactly
reproduces today's behaviour, grouped in a "Tuning" card on Settings with per-row reset.

**The numbers.** (1) naked-exposure grace 10 min + imminent grace 3 min
(`src/lib/bets/naked-exposure.ts`); (2) drought nudge 40 days
(`src/lib/accounts/bookmaker-stats.ts`); (3) retention prior 0.8 + prior weight 5
(`src/lib/offers/retention-shared.ts` via `src/lib/services/retention.ts`); (4) effort minutes per
action kind (`EFFORT_MINUTES` in `src/lib/offers/do-next.ts` — closes the roadmap §8 open
question); (5) mistake-tag prompt threshold capture < 0.9
(`src/components/offers/offer-campaign-card.tsx`); (6) Edge Report minimum 5 settled campaigns
(`src/lib/report/edge-report.ts`).

**Implementation.** New `tuning: TuningSettings` object on `AppSettings` (single JSON settings
key, partial-merge patch): `nakedExposureMinutes`, `nakedImminentMinutes`, `droughtNudgeDays`,
`retentionPrior` (0–1), `retentionPriorWeight`, `mistakeCapturePct` (0–1),
`edgeReportMinCampaigns`, `effortMinutes` (sparse override map; empty = built-ins).
`normalizeTuning()` clamps every field and is the only path into storage. Pure libs stay pure:
each gains an optional opts/param defaulting to the current constant; callers thread
`settings.tuning` through (alert-watcher + banner, accounts page, state.ts retention call,
report route, use-do-next-items, MistakeTagRow via the shared app-state context).

**Acceptance.** An untouched Settings page is a zero-diff upgrade (all defaults = today's
constants, asserted in tests); each threshold provably changes behaviour via unit tests on the
parameterised libs; normaliser clamps garbage input; per-row reset restores the default and the
default is visible on each row.

## E2. Home widget personalisation `[strong]` `[design-first]` ✅ DONE

**Objective.** User-controlled visibility and order for the five Home widgets (`hero`, `do-next`,
`plan`, `chart`, `feed`), persisted in settings, without breaking the context-aware start card.

**Design decisions (documented deviations).** (1) The mobile deck is homogeneous, so it gets FULL
reorder + hide. The desktop Home is a bespoke composition (chart and plan/feed share a designed
two-column row), so desktop gets per-widget show/hide with the grid adapting (hidden chart → the
panel column goes full width, mirroring the existing `showActivity` behaviour) - free desktop
reordering would destroy the pairing and is deferred until real use demands it. (2) Reordering
uses dependency-free up/down controls rather than a drag library (no new dependencies without
flagging); drag can be layered on later. (3) The existing `mobileDeckPin` (start card) stays a
separate rule that operates within the user's order; a hidden pin falls back to the first
visible card.

**Implementation.** Pure lib `src/lib/ui/home-layout.ts`: `HOME_WIDGET_IDS`, labels,
`normalizeHomeLayout` (drops unknown ids, dedupes, appends missing to order, guarantees at least
one visible widget per mode), `applyDeckLayout(cards, layout)`. Settings: `homeLayout` object
(single JSON key, same partial-merge pattern as E1 tuning): `{ deckOrder, deckHidden,
desktopHidden }`. Home `page.tsx`: deck cards built in `deckOrder` minus `deckHidden` (existing
data-driven conditionals still apply); desktop sections respect `desktopHidden`. Settings UI:
"Home layout" card - one row per widget with desktop/mobile visibility switches and up/down
order controls for the deck.

**Acceptance.** Untouched settings render today's exact Home (default order/visibility asserted
in tests); hiding every widget is impossible (normaliser keeps one); hidden widgets remain
reachable as pages (chart → tracker chart, plan/do-next → offers, feed → history); layout lib
unit-tested.

## E3. Data custody: backup, restore, import `[strong]` ✅ DONE

**Objective.** Local-first needs a lost-laptop story and a spreadsheet migration ramp: one-tap
backup, validated restore with an automatic safety copy, and a CSV import wizard for bet history.

**Backup.** `GET /api/data/backup` streams a WAL-safe snapshot via better-sqlite3's online
`backup()` API (never `fs.copyFile` on a live WAL db) as
`edgeways-backup-YYYY-MM-DD.db`; `?format=json` returns a versioned JSON bundle (app version,
exportedAt, every user table dumped generically via `sqlite_master`).

**Restore.** Two-step staged flow: `POST /api/data/restore?mode=preview` writes the upload to
`data/restore-staged-<ts>.db`, validates (integrity_check, core tables present) and returns row
counts + a staging token; `mode=apply&token=` then (1) safety-copies the live DB to
`data/backups/pre-restore-<ts>.db` via the backup API, (2) runs `restoreDatabaseFrom()` - a
transactional ATTACH-copy of every user table into the LIVE connection (delete-all then
common-column insert per table). **Never swap the DB file on disk**: the dev server's parallel
module graphs can hold a second open connection whose pager a file swap corrupts
(`SQLITE_IOERR_SHORT_READ`, found during verification). ATTACH-copy goes through SQLite's own
locking, so every handle sees one consistent change, and older backups restore cleanly because
the live schema is a bootstrap-guaranteed superset. Restores are never destructive: the
pre-restore copy always exists first.

**Import.** Pure libs `src/lib/import/csv.ts` (RFC-ish CSV parser - quotes, escaped quotes,
newlines in fields; no new dependency) and `src/lib/import/bets-import.ts` (header auto-guess,
column mapping → validated settled-bet drafts; dd/mm/yyyy and ISO dates; profit sign derives
won/lost, zero → void). Imported rows: additive `source TEXT` column on `bets`
(`source = 'import'`), `balance_ledgered = 1` / `balance_settled = 1` so history import NEVER
touches live balances, and no EV snapshots are created - imported history can never fake
capture-rate data (the Edge Report only reads locks). UI: "Data custody" card on Settings →
Data & API with backup/export/restore, plus an import wizard dialog (map columns → preview →
import).

**Acceptance.** backup → restore round-trips a real DB (verified live on the harness); restoring
garbage is rejected at preview with the live DB untouched; a pre-restore safety copy exists
after every apply; import libs unit-tested with hand-built CSVs (quoted commas, bad rows
reported not silently dropped); imported bets appear in tracker/history with the import marker
and change no balances.

---

# PHASE 7 — WORKBENCH

## F1. Match checker `[strong]` ✅ DONE — new side-nav item

**Objective.** Turn a found match into a verdict in seconds: back odds + lay odds + commission →
good/ok/poor, qualifying cost or locked-in profit, and one tap into the full calculator. It
checks the match you found; it NEVER lists or ranks markets (roadmap §7.3 discovery guard).

**Implementation.** Pure lib `src/lib/calc/match-verdict.ts`: `checkMatch` wraps the spec-tested
`matchedBet` (no reimplemented maths) and adds a rating (qualifying/risk-free: % of stake
retained after the qualifying loss; free bets: % of face value retained) with documented verdict
bands (`MATCH_VERDICT_THRESHOLDS`: qualifying good ≥97% / ok ≥93%; free bets good ≥75% /
ok ≥65% - community rules of thumb, revisit from real use). Page `src/app/match-checker` with
commission prefilled from the default exchange; "Open in calculator" hands the inputs to the
matched-calculator provider (whose prefill contract is PERCENT, not fraction - calc-auditor
caught the units mismatch). Risk-free is deliberately absent from the mode select: its verdict
depends on refund inputs the checker doesn't collect, and a silent 70% default would mislead -
the full calculator handles it. Nav entry after Calculators (flows into the mobile burger via
`flatNavLinks`).

**Acceptance.** Verdict lib unit-tested with hand-worked vectors; a found match gets a verdict
in <10s; no market listing/browsing anywhere.

## F2. Alerts inbox `[strong]` ✅ DONE — new side-nav item

**Objective.** An alert missed is never an alert lost: every emitted EdgeAlert lands in a
persistent inbox with read state, an unread nav badge and deep links.

**Implementation.** New `alerts_inbox` table keyed on the rules' stable dedupe keys (UNIQUE) -
a re-firing rule UPDATES its row (`onConflictDoUpdate`) and read state survives the re-fire
(same condition, already acknowledged). Service `src/lib/services/alerts-inbox.ts`
(record/list/unreadCount/markRead/markAllRead, unit-tested). The client alert-watcher stays the
brain: after delivering through the AlertChannel it POSTs fresh alerts to `/api/alerts`,
fire-and-forget so a failed write never blocks delivery. `alertsUnread` rides AppState for the
nav badge. `/alerts` page: kind-icon rows, unread emphasis, tap = mark read + follow the deep
link, mark-all-read toolbar. Snooze deferred until real use shows the need (read/unread proved
sufficient for v1).

**Acceptance.** Service round-trip unit-tested (dedupe upsert, read survival); live loop
verified end-to-end on the harness (watcher-emitted alerts appeared in the inbox and badge
unprompted); tapping navigates and clears the unread dot.

## F3. Background web push `[strong]` ✅ DONE (server pipeline; real-device test = Sam's Android)

**Objective.** Sentinel alerts reach the phone with every Edgeways tab closed. Dependencies
`web-push` (+ types) and `cmdk` (for F4) approved by Sam 2026-07-14. **Sam's phone is Android**,
which is the easy path (Chrome push, no iOS install-first quirks) - the roadmap's iOS open
question applies only if an iOS device ever joins.

**Implementation.** VAPID keys generated once and persisted in `app_settings` (rotating them
orphans subscriptions - never regenerate). `push_subscriptions` table (endpoint UNIQUE,
upserted). `src/lib/services/push.ts`: save/remove/list + `sendPush` fanning out via
`web-push`, pruning dead subscriptions on 404/410 from the relay, never throwing (push is
best-effort on top of the F2 inbox record). `/api/alerts` POST fans freshly recorded alerts out
after the inbox write. `/api/push`: GET (public key + devices), POST (subscribe or
`{test:true}` test-send), DELETE (unsubscribe). Service worker gains `push` +
`notificationclick` handlers (focus-or-open the deep link). Settings → Alerts:
"Push to this device" switch (permission → subscribe → register) + "Send test push".

**Delivery constraint (stated honestly in the UI copy):** the local server must be running and
online to SEND; the phone receives anywhere via the vendor relay. **Acceptance.** VAPID key
stable across calls; test-send graceful with zero devices; invalid subscriptions fail locally
without crashing (verified on harness); the 404/410 prune path and real delivery need Sam's
Android - staged for his next session.

## F4. Command palette `[strong]` ✅ DONE

**Objective.** Cmd/Ctrl+K anywhere: fuzzy jump to any page, open offer or bookie wallet, plus
the four quick actions (Add bet, New offer, Matched calculator, Adjust balance).

**Implementation.** `cmdk` (approved) behind new shadcn primitives in
`src/components/ui/command.tsx`; `CommandDialog` wraps the app Dialog so mobile inherits the
bottom-sheet treatment. `src/components/command-palette.tsx` mounts in the root layout inside
the action providers; pages come from `flatNavLinks` (single source with the sidebar/burger),
offers and bookies come from live app state only - no separate index to go stale. Offers open
their campaign dialog via `viewOffer`; bookies jump to Accounts.

**Acceptance.** Cmd+K opens from any page; typing filters across all four groups (verified live:
"bet365" → the wallet with its balance); selection runs the action and closes.

---

# PHASE 8 — MOMENTUM

## G1. Targets & pace `[strong]` ✅ DONE

**Objective.** A monthly profit target with factual pace copy - no streaks, no confetti.

**Implementation.** Pure lib `src/lib/pnl/pace.ts` (+5 tests, hand-worked vectors):
`computeMonthPace` (straight-line expectation, penny tolerance on the on-pace flag),
`currentMonthAchieved` over monthly P&L rows, `paceLabel` ("£162 of £250 · on pace" /
"£X/day needed" / "target met"). Setting `monthlyProfitTarget: number | null` (flat key,
clamped parse). Settings → "Monthly target" card (clearing the field removes all pace copy -
the description explicitly notes a bad-variance week is not "behind plan" if the edge was
captured). Home's Monthly P&L chip appends the pace label when a target is set for the current
month. Edge Report intentionally untouched: its realised number is campaign-EV capture, not
total monthly P&L - mixing the two on one page would blur exactly the distinction the report
exists to make.

**Acceptance.** Lib unit-tested; verified live (target £250 → "£162 of £250 · on pace" on the
chip; clearing the target removes the copy).

## G2. Onboarding & demo mode `[strong]` ✅ DONE

**Demo mode (shipped).** Demo data is a SEPARATE FILE, never a flag: `resolveDbPath` opens
`data/edgeways-demo.db` when a `data/demo-mode` marker exists (EDGEWAYS_DB_PATH still wins, so
tests are unaffected). Switching requires a server restart ON PURPOSE - parallel dev module
graphs holding connections to different files would split-brain writes; the path is fixed per
process lifetime. A fresh demo DB seeds atomically (`src/lib/db/demo-seed.ts`, wrapped in a
transaction so a mid-seed failure can never strand a half-seeded file that would then skip
reseeding - learned the hard way): 6 accounts, 7 offers, 11 bets, 5 settled EV-locked campaigns
pinned INSIDE the current month so the Edge Report always renders ready, one leak tag, an open
qualifier and a planned offer. "DEMO DATA" watermark chip in the top bar via
`AppState.demoMode`; Settings → Data & API "Demo mode" card (arm/disarm switch with
restart-needed status, wipe button that only ever touches the demo file).

**Onboarding wizard (shipped).** `src/components/help/setup-wizard.tsx` extends the welcome
tour: its last step gains a "Set up your desk" CTA handing off to a four-step wizard (bank +
bankroll → bookies + balances via the standard VenueSelect with its Add-custom affordance →
bet defaults → notification permission, with pointers to push and the E3 CSV import rather
than embedding them). Everything is created in ONE go at Finish (POST /api/accounts per
account, bookies funded by the bank; PATCH /api/settings for defaults), so stepping back and
forth never double-creates; per-item failures are reported, not silently dropped. Re-entry via
Settings → Help & about → "Set-up wizard". Verified on a fresh DB: bank created and funded,
defaults saved, all steps navigable. Design pass note: the wizard is a pattern-clone of the
already-reviewed welcome dialog; it rides the next polish sweep with Sam's harvested tweaks
(see polish-backlog.md).

## G3. Season summary `[strong]` ✅ DONE

**Objective.** The year the way B8 tells the month, without ever faking pre-capture history.

**Implementation.** Pure lib `src/lib/report/season-report.ts` (+3 tests, hand-worked):
`buildSeasonReport` - per-month rows (settled profit for ALL bets; expected/realised/capture
only for months with EV locks, null otherwise), commission drag, retention, year totals,
`captureFrom` (first lock month), best/worst bookmaker across the year's settled bets;
`seasonYears` newest first. `/api/report?view=year&year=YYYY`. UI: Month | Year segmented tabs
on `/report`; the Year view (`src/components/report/season-view.tsx`) shows year pills, a
5-tile StatStrip, the month-by-month table (desktop table + mobile card list) with the coverage
note stated plainly ("EV capture measured from Jul 2026 - earlier months show settled profit
only"), and a best/worst bookmaker card. Deviation: the brief's "realised £/hr" is omitted -
there is no recorded effort-time data, and deriving it from the B2 effort guesses would present
a made-up number as measurement.

**Acceptance.** Lib unit-tested (pre-capture months null EV, year scoping excludes other years,
best/worst); verified live (Year tab → totals, coverage note, bookmaker card).

## G4. Access & keyboard polish `[local]` ✅ DONE (scoped)

**Shipped.** (1) Accessible names on the seven pre-existing Settings switches (offer reminders,
OCR match, five alert toggles) - everything E1/E2/F3/G2 added already carried them; (2) global
`prefers-reduced-motion` support: pulsing live indicators and dialog slide/zoom stilled, smooth
scrolling disabled; (3) NEW "Keyboard & accessibility" Help guide documenting the palette,
everyday keys and assistive-tech behaviour (unread alerts already announce via sr-only from F2).

**Deferred, stated honestly:** a full contrast audit across both themes (no known failures, but
unmeasured), and the ~40 react-compiler setState-in-effect lint sites (performance hygiene, not
accessibility - tracked as their own backlog item).

# PHASE 10 — NEW DESKS (promoted from §9, 2026-07-15)

## H1. Weekly digest `[strong]` ✅ DONE — needs B8, F2, F3 (all shipped)

**Objective.** An opt-in Monday summary of last week — edge captured, capture %, commission
drag, biggest leak, drought nudges — recorded in the alerts inbox and pushed to subscribed
devices via the existing F3 pipeline.

**Why.** The single moment a tracker becomes a coach is when it opens the week for you.
All the plumbing shipped: B8 computes the content shapes, F2 stores durably, F3 delivers
to Sam's Android (verified 2026-07-14). This brief is composition, not new infrastructure.

**Trigger model (local-first, no cron).** The server only runs when the desk is open, so the
digest is compute-on-poll with a week-key latch, exactly one send per ISO week:
- NEW `src/lib/services/weekly-digest.ts` — `maybeSendWeeklyDigest(now = Date.now())`:
  1. Read `AppSettings.digestWeekly` (new, default **false** — opt-in) and raw setting
     `digestLastSentWeek` (via `readRaw`/`writeRaw` in `src/lib/services/settings.ts`).
  2. Due when `now` ≥ Monday 09:00 local of the current ISO week AND `digestLastSentWeek`
     ≠ current ISO week key (`YYYY-Www`). Missed weeks do NOT backfill — send only the most
     recently completed week.
  3. Build content (pure lib below), `recordAlerts([digestAlert])`
     (`src/lib/services/alerts-inbox.ts:19`, dedupe key `digest:<isoWeek>`), then
     `void sendPush(digestAlert)` (`src/lib/services/push.ts:77`, fire-and-forget), then
     write `digestLastSentWeek`.
  4. Call from `getAppState()` in `src/lib/services/state.ts` (after `syncOfferStatuses()`);
     the guard is one settings read per poll, send path idempotent via the latch + inbox
     dedupe.

**Content (pure, tested).** NEW `src/lib/offers/weekly-digest-content.ts` (client-safe, no db):
`buildWeeklyDigest(input: { snapshots: EvSnapshotRow[]; bets: BetRow[]; league: BookmakerLeagueRow[]; weekStartMs: number; weekEndMs: number }): { title: string; body: string } | null`.
- Realized: sum `realizedProfit` of snapshots settled in `[weekStartMs, weekEndMs)`;
  expected: their `expectedProfit`; capture % (null-guard |expected| ≤ 0.01, same rule as
  `buildEdgeReport` — `src/lib/report/edge-report.ts:137`).
- Commission drag: `commissionPaidOnSettledBet` (`src/lib/calc/commission-paid.ts`) over
  bets settled in the window.
- Biggest leak: top `aggregateMistakes` row for the window's snapshots (reuse
  `src/lib/offers/mistakes.ts`).
- Drought nudges: `BookmakerLeagueRow.droughtNudge` names (cap at 2 in copy).
- Returns null when the week has NO settled campaigns (nothing lands — never nag).
- Title like `"Your week: +£47.20 captured (89%)"`; body ≤3 short lines; `href: "/report"`.
  Money via `£x.toFixed(2)`; digest kind `"weekly_digest"`.

**Settings (per §0 pattern).** `digestWeekly: boolean` DEFAULT false: interface + default in
`settings-shared.ts`, read in `getAppSettings()`, write branch in `patchAppSettings()`, body
handling in `src/app/api/settings/route.ts`, toggle in the Alerts card of
`src/app/settings/page.tsx` ("Weekly digest — Monday morning summary of last week's edge").

**Data sources at the call site** (verified 2026-07-15): snapshots via `getAllSnapshots()`
(`src/lib/services/ev-snapshot.ts`), bets already loaded in `getAppState`, league rows via
`computeBookmakerStats` (`src/lib/accounts/bookmaker-stats.ts:105`, the same builder the
accounts league uses).

**Nuance.**
- Week window is the COMPLETED week: `[prev Monday 00:00, this Monday 00:00)` local.
- The 09:00 gate stops a Sunday-night poll counting Monday 00:01 as "morning".
- If push has no subscriptions, the inbox row still lands (F3 is best-effort by design).
- Digest respects E1 tuning where it exists (droughtNudgeDays) — read from settings, do not
  hardcode 40.

**Acceptance.** Vitest: content builder (capture line, null on empty week, drought copy cap,
commission drag hand-worked); trigger latch (not due before Mon 09:00, sends once, second
poll same week no-ops, missed week sends only latest). Live: enable toggle, force
`digestLastSentWeek` back, next poll lands inbox row + push; disabled toggle sends nothing.

## H2. Casino desk `[strong]` ✅ DONE — dedicated side-nav section

**Objective.** A "Casino" section for wagering-offer EV: log a casino offer (bonus, wagering
requirement, game RTP, contribution %), get an honest EV verdict net of wagering drag with a
variance warning tier, and track realised outcomes — the variance-honest counterpart to the
matched desks.

**Sam's direction (2026-07-15).** Straight to development, no design phase — follow the
layouts, stylings and consistencies already across the app (design tokens, shadcn patterns,
section headers, EV basis badges).

**Maths (pure calc — /calc-change applies).** NEW `src/lib/calc/casino-ev.ts`:
- `casinoOfferEv(input: { bonusAmount: number; wageringMultiplier: number; houseEdge: number; contributionPct?: number })`
  → `{ ev: number; wageringDrag: number; totalTurnover: number }` where
  `totalTurnover = bonusAmount × wageringMultiplier / (contributionPct ?? 1)` and
  `wageringDrag = totalTurnover × houseEdge`; `ev = bonusAmount − wageringDrag`.
  House edge from RTP: `1 − rtp`. Exact arithmetic, hand-worked test vectors
  (e.g. £20 bonus, 35× wagering, 96% RTP → turnover £700, drag £28, EV −£8).
- Variance tier from turnover-to-bonus ratio and house edge (low/medium/high bands —
  spec the thresholds in tests first). EV displays MUST carry a basis badge:
  `"estimated"` when RTP supplied, `"heuristic"` when defaulted.
- Optional stake-limited slot sessions and cash-stake-first flows are OUT of v1 scope.

**Schema (per §0 migration pattern).** New `casino_offers` table: id, bookmaker, title,
bonusAmount, wageringMultiplier, rtp, contributionPct, status (`planned|active|completed|expired`),
expectedEv (derived at save), actualProfit (user-entered at completion), notes, createdAt,
completedAt. Drizzle table in `schema.ts` + `CREATE TABLE IF NOT EXISTS` in `db/index.ts`.
Casino realised P&L is a first-class bucket: completed campaigns write
`history.kind = casino_settlement` (History + Home feed), a
`balance_transactions.category = casino_settlement` wallet row, and count in
total `settledProfit` as `casinoProfit` (separate from Betting P&L). Casino EV
still never feeds Do Next / edge-on-the-table sums.

**UI.** New nav entry "Casino" in the Betting section of `NAV_SECTIONS`
(`src/components/…` nav source, single source of truth drives sidebar + drawer + palette);
`/casino` page: offer list (calendar-card idiom from Offers), add/edit dialog, EV verdict
with variance warning chip, completion flow capturing realised profit and an
expected-vs-realised line (A3 idiom, but simple columns — no snapshots/locks in v1).

**Nuance.**
- Variance honesty is the product stance: copy always frames EV as an expectation across
  many attempts, never a lock ("EV +£4.80 — high variance: most sessions lose").
- No game data scraping; RTP is user-entered (default 96% with `"heuristic"` basis).
- `casinoOfferEv` output NEVER feeds Do Next/edge-on-the-table sums in v1.

**Acceptance.** Vitest for every calc branch with hand-worked numbers; calc-auditor pass;
`/casino` verified in the harness (create offer → EV verdict + variance chip + basis badge;
complete → expected-vs-realised line renders); mobile 390×844 pass; suite + build green.

**Follow-ups shipped same day (Sam's requests, 2026-07-15):**
- *Paste offer*: `parse-casino-offer-text.ts` (pure, tested — bonus/wagering/RTP/contribution
  from promo text, fractions out) behind `CasinoPasteDialog`; the shared capture block
  (screenshots→OCR + text merge) was extracted from the offers paste dialog into
  `src/components/paste-capture.tsx` and both dialogs now use it (the extraction also
  cleared the two react-compiler lint errors the old dialog carried).
- *Side-nav quick action*: `CasinoLogProvider` (layout-mounted, `useCasinoLog()`) owns the
  log dialog; the Casino nav entry gets `quickAction: "casinoLog"` so the + opens it from
  any page; saves fire `CASINO_CHANGED_EVENT` so a mounted `/casino` list refreshes.
- *Game RTP library*: `casino_games` table lazily seeded on first `/api/casino/games` GET
  from `src/lib/casino/game-library.ts` (published base RTPs — HONESTY: operators licence
  lower variants, all copy says verify in the game info, every row editable; seed only runs
  on an empty table so user edits/deletions never resurrect). Log dialog gains an
  eligible-games picker (cmdk search, chips, starred best pick) that drives the RTP field
  from the highest-RTP selection and stores the recommendation on `casino_offers.game`
  (additive column); pasted promo text auto-matches library games via `matchGamesInText`
  (longest-name-first span consumption so "Fishin' Frenzy The Big Match" never also credits
  bare "Fishin' Frenzy"). Library manager dialog on the Casino page (upsert by name,
  delete).

---

# PHASE 11 — EXECUTION EDGE (promoted from §9, 2026-07-16)

> Landscape research (`docs/roadmap/competitive-landscape.md`) showed the incumbents optimise
> *finding* offers; nobody measures *executing* them. These nine briefs are that gap. Sam's
> design decisions (2026-07-16) are baked in below. Build in waves: W1 = J1–J3, W2 = J4–J6,
> W3 = J7–J9. Standing process per item: brief → tests-first lib → UI → harness verify (dev on
> :3799, NEVER build in the live tree) → calc-auditor/design-reviewer → docs → commit.

## J1. Measured effort — real £/hr `[strong]` ✅ DONE (W1)

**Objective.** Replace estimated effort minutes with measured ones. Time the span from first
meaningful engagement with an offer to its final bet logged; blend measured medians into the
£/hr sort once samples exist. **Hybrid capture (Sam):** automatic, with edit-after.

**Why.** B2's £/hr sort divides EV by `EFFORT_MINUTES[action.kind]` guesses
(`src/lib/offers/do-next.ts:27`, E1-tunable overrides at :108). Measured minutes make the
number personal and honest — no competitor measures execution at all.

**Schema (§0 pattern).** New `offer_effort_samples` table: id, offerId, actionKind,
startedAt, endedAt, durationMin REAL, edited INTEGER DEFAULT 0, createdAt. Additive only.

**Capture points (client, via a small provider):**
- START: first of — Do Next action click-through, offer campaign "Place qualifying bet",
  matched calculator opened from an offer context, Add bet opened with an offerId prefill.
  Keyed `offerId:actionKind`; re-engagement while open does not restart.
- STOP: a bet POST succeeds carrying that offerId → sample written via
  `POST /api/effort` (new thin route). Abandoned starts expire after 60 min unrecorded.
- EDIT-AFTER: the sample renders on the offer campaign card ("Logged in 4m") with a small
  edit affordance → PATCH duration, sets `edited=1`.

**Blend (pure lib, tests first).** NEW `src/lib/offers/effort.ts`:
`measuredEffortMinutes(samples, actionKind): { minutes: number; sampleSize: number } | null`
(median of last 20 per kind) and `blendedEffort(measured, n, prior)` following the A1
`blendedRetention` idiom (`src/lib/offers/retention-shared.ts`): n=0 → prior (current
EFFORT_MINUTES), large n → measured. Thread through `buildDoNextItems` opts alongside the
E1 overrides (measured beats default; explicit E1 user override beats measured — user intent
wins). Rate captions show the basis: "£24/hr · measured (12)".

**Acceptance.** Lib unit-tested (median, blend, override precedence); harness: run an offer
flow on :3799 → sample lands, card shows duration, £/hr caption flips to measured at n≥5;
suite green.

## J2. Boosts page — boost & bet-builder checkers + boost diary `[strong]` (W1) — ✅ DONE 2026-07-16

Shipped as briefed: `boost-check.ts` (verdict thresholds ±1% edge → take/marginal/skip),
`boost_diary` table + `/api/boosts` CRUD/settle, `/boosts` page with mode tabs, live verdict
card (basis: boost = estimated, builder = heuristic until the haircut is touched), diary with
EV-banked vs realised headline. The optional "Lay it" calculator handoff was deferred — add
it when a real boost play wants a lay leg.

**Objective.** A separate nav page (**Sam: not Match Checker tabs**) answering "is this
boosted/builder price above fair?" in <10s, and a diary accumulating boost EV captured.

**Why.** The incumbents' Price Boost Matcher / Bet Builder Finder are discovery (D2). The
*checker* halves are one manual-entry step from F1's maths and extend the same fair-price
idiom. The diary turns one-off checks into an edge ledger.

**Maths (pure calc — /calc-change).** NEW `src/lib/calc/boost-check.ts`:
- `boostVerdict({ boostedOdds, fairOdds, stake })` → `{ evPct, evGbp, verdict }` where
  fairOdds comes from user-entered exchange back/lay (mid or no-vig via `ev.ts#noVig`).
- `betBuilderFairOdds(legs: Array<{ fairOdds: number }>, correlationHaircutPct = 0)` →
  product of leg odds × (1 − haircut) — the haircut is user-set with copy explaining
  same-match legs are correlated so true fair is LOWER than the naive product; default 0
  with a "heuristic" basis, any haircut set by the user = "estimated". EV badges per A2.

**Schema.** `boost_diary` table: id, label, bookmaker, boostedOdds, fairOdds, stake, evGbp,
kind ('boost' | 'builder'), outcome nullable ('won'|'lost'|'void'), actualProfit nullable,
createdAt. Log-at-check, settle later from the row.

**UI.** Nav "Boosts" (Betting section, after Match Checker; Zap icon); page = checker form
(mode toggle boost/builder) with live verdict card (EV %, £EV, basis badge) + "Log to diary"
+ diary table (sum EV captured headline; settle/void inline). Optional "Lay it" handoff to
the matched calculator prefill (COMMISSION IS PERCENT in that prefill — F1 audit lesson).

**Acceptance.** Calc vectors hand-worked (incl. haircut and no-vig paths); diary CRUD;
harness drive: check a boost → verdict <10s → diary row → settle it; mobile 390×844 pass.

**Follow-up.** Money path / Tracker / History → **J2b** (Phase 15). Do not extend J2 settle
to paper-trade Logged-only rows (see §9 parking lot + J2b out of scope).

## J2b. Boosts money path — diary ↔ Add bet ↔ Tracker / History `[strong]` (Phase 15)

**Status.** Implemented 2026-08-03. Confirmed with Sam same day.

**Objective.** A boost play is first-class money like any other sports bet: balances, In-bets,
Profit Tracker (including Open), and History. The Boosts page remains entry + diary ledger;
committing cash always goes through Add bet. Settlement is one record, two surfaces.

**Why.** J2 shipped an EV diary only. Logging never created a `bets` row, never called
`ledgerBetPlacement`, never appeared in Tracker/History/In-bets. Lay preview was not persisted.
Sam's real plays need the underlay on the exchange reserved and managed like a normal matched bet.

**Product decisions (Sam, 2026-08-03) — do not re-litigate.**

1. **Two checker actions:** **Log for later** and **Place bet** (not "Bet placed").
2. **Log for later** → create `boost_diary` row only. State: **Logged**. No wallet, no Tracker.
3. **Place bet** (from checker or from a Logged diary row) → ensure a Logged diary row exists
   first (so cancel loses nothing), then open **Add bet** prefilled from that row. Confirming
   Add bet creates/links the real `bets` row → diary state **Placed**.
4. **Edge case A:** Place bet then cancel Add bet → diary stays **Logged**.
5. **Edge case B / paper-trading:** NO Won/Lost/Void on Logged-only rows. Settlement across the
   app only affects committed money. Paper-trade EV settle is parked in
   `product-roadmap.md` §9 ("Paper-trading EV") for later review — document only, do not build.
6. **Bet type:** Add/store as `betType: "boost"`. Visual category in Add bet (label "Boost",
   Zap icon acceptable). Math path = qualifying matched back+lay (same as `qualifying` in
   `matched.ts` / settlement); do not invent new stake formulae.
7. **Diary tabs** next to All, same pattern as Tracker desk queues: **All | Logged | Placed**.
8. **Diary rows are clickable** — Logged → Place bet (Add bet prefill); Placed → open/settle
   context that fits the Boosts page (linked bet summary + settle controls).
9. **Settle:** same action whether from Boosts or Profit Tracker — updates the linked bet;
   both surfaces refresh. Prefer existing bet settle APIs over a parallel diary-only P&L.
10. **History:** add a **Boosts** filter tab (like Racing/Casino) for boost-typed bets and/or
    diary-linked settlements. Placed/settled also appear under normal Bets/Settlements.
11. **Casino excluded:** casino campaigns stay on their own path; this brief is sports bets only.

**Schema (verify against code before coding; shapes checked 2026-08-03).**

- `boost_diary`: add nullable `betId` (FK intent to `bets.id`). Optionally persist lay preview
  fields used for Add bet prefill (`layStake`, `layOdds`, `commission`, `exchangeId` / notes)
  so Place bet from a Logged row does not depend on ephemeral form state. Keep existing EV
  columns (`fairOdds`, `evGbp`, `basis`, `kind`, …).
- `bets.betType`: allow `"boost"` (text column already; no enum migration). Thread through UI
  labels, Tracker display, History filter, CSV if bet-type labels are listed explicitly.
- Stop writing diary-only `actualProfit` on settle when `betId` is set — derive display P&L
  from the linked bet. Leave legacy settled diary rows (pre-J2b, no `betId`) readable on the
  Boosts page; do not backfill fake bets.

**UI / flows.**

- `boost-checker-form.tsx`: replace single "Log to diary" with **Log for later** + **Place bet**.
  Place bet = POST diary (if needed) → `openAddBet(prefill)` with
  `betType`/UI type Boost, back stake/odds from boost, lay from preview, bookmaker, label,
  commission as **percent** in prefill (F1 audit lesson), and a way to pass `boostDiaryId` so
  save can link (`AddBetPrefill` extension).
- `add-bet-dialog.tsx`: add UiBetType `"boost"` (label "Boost"; calc mode `qualifying`). On
  successful create, if `boostDiaryId` present, PATCH diary `{ betId }`. Show Boost chrome
  (type select + optional Zap) so the modal reads as a boost commit, not a generic qual bet.
- `boosts/page.tsx`: tabs All / Logged / Placed; clickable rows; settle only when `betId` set
  (call bet settle, then refresh). Remove or hide Won/Lost/Void on Logged-only rows.
- Tracker: no special queue required if `betType === "boost"` bets are normal open bets —
  they already land in **Open**. Optional later: desk filter "Boosts"; not required for v1.
- History: `HistoryFilter` + `HISTORY_FILTERS` entry `boosts`; filter `betType === "boost"`
  and/or history rows linked via diary. Home feed tab optional if Casino has a parallel —
  match existing History page pattern first.
- Help: update `page-help.ts` / guides — Log for later vs Place bet; settle on either surface;
  Logged is not paper-settled.

**API / services.**

- NEW or extend `src/lib/services/boosts.ts`: create diary, link `betId`, list with joined bet
  summary, delete rules (delete diary unbound; if linked, confirm / unlink policy — prefer:
  deleting diary does not delete the bet; deleting the bet clears `betId` or blocks with message).
- `POST /api/boosts` — Log for later (and Place bet's ensure-row step).
- `PATCH /api/boosts/[id]` — link `betId`; do **not** accept outcome settle without `betId`.
  Settlement of money goes through existing `/api/bets/[id]` (or whatever Tracker uses today).
- Prefill bridge: `boostDiaryId` on Add bet POST body or a follow-up PATCH from the client
  after create — pick one and test it.

**Out of scope.**

- Paper-trading settle on Logged-only diary rows (§9 parked idea).
- Casino-style separate `boostProfit` P&L bucket (money lives on `bets` → existing
  `bettingProfit`).
- Auto-placing on bookie/exchange (J9 extension may fill slips; this brief is logging only).
- Changing `boost-check.ts` verdict maths unless a bug is found (no `/calc-change` for pure wiring).
- Acca `boostPct` (L3) — different feature; do not conflate.

**Acceptance.**

1. Log for later → diary Logged; balances/In-bets/Tracker unchanged.
2. Place bet → Add bet opens as Boost with fields populated; cancel → still Logged.
3. Confirm Add bet → `betType: "boost"`, diary Placed + `betId`, In-bets/Open Tracker update.
4. Settle Won/Lost from Boosts or Tracker → same bet status/P&L; both UIs agree.
5. History **Boosts** tab lists boost bets; they also appear under Bets/Settlements as appropriate.
6. No settle controls on Logged-only rows.
7. `npx vitest run` green; design-reviewer on Boosts + Add bet Boost type; calc-auditor only if
   settlement maths touched (should not be).

**Sizing.** `[strong]` — schema, Add bet type, ledger via existing bet path, multi-surface UI.
Implement on a frontier / serious multi-file agent; Grok/Composer fine for UI slices after the
service+schema land.

## J3. Lock-in advisor — close any open position `[strong]` (W1) — ✅ DONE 2026-07-16

Shipped with Sam's design answers folded in: all four single bet types (incl. back-only
rows), 2UP early-payout bets excluded (the EP desk owns that maths), a partial slider
(lock some, let the rest ride), and one-click logging from the dialog instead of an Add
bet handoff — the lay direction writes a real `lay_only` bet; the back direction stores
commission-adjusted odds (1+(Ob−1)(1−c), commission 0) so plain-back settlement is exact.
Deviation from the brief: no Add bet round-trip (Sam's call — fewer steps). The companion
"No lay" Add bet type Sam requested rides the same session as a follow-up.

**Objective.** Any open back+lay single shows "close now for £X guaranteed": enter the
CURRENT back/lay odds and get the equalising trade (further lay at today's price, or back
on the exchange) with the locked P&L either way.

**Why.** The 2UP desk already computes equalising trades (`equalizedStakes`,
`src/lib/calc/ep/engine.ts:325` — spec-locked, consume don't modify). Generalising to any
open position is a small step no personal tool takes.

**Maths (pure calc — /calc-change).** NEW `src/lib/calc/lock-in.ts` (do NOT touch the EP
engine): `lockInTrade({ backStake, backOdds, layStake, layOdds, commission, currentLayOdds })`
→ `{ additionalLayStake, lockedProfitIfWin, lockedProfitIfLose, guaranteed }` — standard
equalisation across the remaining exposure; supports positions with zero original lay
(back-only → full lay-to-lock). Exact arithmetic via roundPence; hand-worked vectors
including the classic "back 50 @ 4.0, laid 48 @ 4.2, now 2.5 → lock +£X".

**UI.** Tracker row action "Lock in…" on open back/lay singles (not dutch/EW v1) → dialog:
current lay odds input (prefill = original), trade card, "Log the lay" handoff into Add bet
prefilled as lay-only linked to the same event/offer.

**Acceptance.** Calc vectors; harness: open position → dialog → sensible trade → handoff
prefills Add bet; EV basis "estimated" (user-entered price).

## J4. Casino variance simulator `[strong]` (W2) — needs H2 — ✅ DONE 2026-07-16

Shipped as briefed: spec'd preset ladders (hand-worked expectations 3.46/5.805/13.6 per
hit) scaled so E[return] = RTP exactly; mulberry32-seeded, deterministic; chunked runner
(500 runs/tick) instead of a worker — same non-blocking guarantee, no bundler surface.
One honest deviation surfaced by the model itself: where drag exceeds the bonus the
simulated mean sits ABOVE the static H2 EV (a session can only lose the bonus; busting
truncates the drag) — the dialog shows both figures side by side and says why.

**Objective.** Monte Carlo a wagering offer with **volatility presets (Sam)**: bust
probability, median outcome, percentile band, distribution chart — extending H2's variance
tiers into honest distributions.

**Why.** Incumbents publish static EV lists. "62% bust, median −£4, top decile +£40 across
10,000 runs" is the most honest casino tool on the market and pure local compute.

**Spec FIRST (calc-change, test vectors before code).** NEW `src/lib/calc/casino-sim.ts`:
- Slot model per spin: win probability p and multiplier distribution parameterised by
  volatility preset (low/medium/high) calibrated so E[return] = RTP exactly. Presets are
  SPEC'D CONSTANTS with test vectors (e.g. low = frequent small wins: hit rate ~30%,
  capped multipliers; high = hit rate ~15%, long tail). Document that presets are stylised
  models, not real game maths.
- `simulateWagering({ bonusAmount, wageringMultiplier, houseEdge, contributionPct, volatility, spinStake, runs = 10_000, seed })`
  → `{ bustPct, median, p10, p90, meanEv, histogram }`. Seeded PRNG (mulberry32) so tests
  are deterministic; meanEv must converge on `casinoOfferEv().ev` within tolerance — that
  cross-check IS a test.
- Runs in a web worker (or chunked) — never block the main thread.

**UI.** "Simulate" on the casino verdict card + offer rows → sheet with the distribution
(dataviz skill for the chart), bust %, median, honest copy ("stylised model — real games
vary"). Volatility preset picker; spin stake input (default bonus/50).

**Acceptance.** Deterministic seeded vectors; EV convergence test; harness drive on
/casino; chart renders both themes.

## J5. Mug-bet scheduler `[strong]` (W2) — feeds B9 — ✅ DONE 2026-07-16

Shipped as briefed. Exclusion sweep landed at the chokepoints with a test per surface:
offer money (computeOfferProfitBreakdown + summariseOffer → EV capture, expectedFromBets,
mistake ledger all inherit), edge-report monthBets (commission drag + retention),
retention.ts conversions, naked-exposure (a flagged mug is deliberately unlaid — muted);
KEPT in net P&L, bankroll and league profit/staked, with a separate per-bookie
"Mug (month)" line vs budget. Do Next gains lowest-priority (30) place_mug reminders
that deep-link to /tracker?mug=<bookie> → Add bet pre-set (Mug toggle + No lay type).
Mug bets never link offers (server-enforced) and stamp every matching account's plan
(duplicate wallet names exist in real data). The optional OFF-by-default "mug due"
push alert is DEFERRED — the Do Next reminder covers the workflow; add the alert rule
only if daily use wants a push.

**Objective.** Plan, log and budget camouflage bets per bookie. **Own category excluded
from edge (Sam):** mug spend counts in real bankroll and net P&L but never in EV capture,
£/hr, retention or leak analytics; it shows as its own per-bookie cost line.

**Why.** Account longevity is half the game; B9 scores health but nothing maintains it.
Nobody does this systematically.

**Schema.** Additive column `bets.purpose TEXT` (NULL/'edge' = normal, 'mug') — betType
and ALL settlement maths untouched (a mug bet is a normal bet, usually back-only or
loosely layed). Plus `mug_plan` table: id, accountId, cadenceDays, monthlyBudget,
lastMugAt nullable, notes, createdAt.

**Exclusion sweep (the careful part).** Audit every analytics surface and exclude
`purpose='mug'`: EV capture/edge-report inputs, retention (`retention.ts` conversions are
free-bet types so unaffected — verify), £/hr, mistake ledger, Do Next expectedFromBets;
KEEP in: bankroll ledgering, net P&L series/settledProfit (real money), bookmaker league
staked/profit with a separate "mug cost" column. Each exclusion gets a test.

**Workflow.** Accounts page per-bookie: mug plan editor + "due" indicator
(now − lastMugAt > cadenceDays); Do Next gains low-priority `place_mug` items when due
(respects visibleBookieNames); Add bet gains a "Mug bet" toggle setting purpose+quickLog
label; logging one stamps lastMugAt. Alert rule optional OFF-by-default ("Bet365 mug due").
League table shows "camouflage cost this month" per bookie and total vs monthly budget.

**Acceptance.** Exclusion tests per surface; due-logic lib tests; harness: plan → due item
→ log mug → stamps + costs appear, edge metrics unchanged (assert equality before/after).

## J6. Offer email ingestion `[strong]` (W2) — staged — ✅ DONE 2026-07-16 (both stages)

Stage 1 shipped: hand-rolled MIME-lite (`parse-email.ts` — multipart walk, plain-preferred,
QP/base64, RFC2047 subjects, HTML→text; no new dependency needed) feeding the existing
PasteCapture drop zone (.eml drops and Choose files; casino dialog inherits). Sam approved
`imapflow` for stage 2 on 2026-07-16; stage 2 shipped same day: Settings → Data & API
"Email intake" card (host/user/app-password/folder; password stored in app_settings
unencrypted like API keys — the card says so plainly and pushes a dedicated mailbox;
never returned to the client), compute-on-poll fetch every 5 min while the desk is open,
drafts land as PLANNED offers tagged source='email' with an inbox alert + push, and a
"Check now" button. Unparseable messages stay UNSEEN for a manual look (mock-IMAP test
pins that contract). Note: `imapflow` requires `socks` transitively — a fresh clone just
needs `npm install`.

**Objective.** Bookie promo emails become prefilled offers. **Stage 1:** drop an .eml (or
paste the email body) into the existing paste pipeline. **Stage 2 (the destination, Sam is
keen):** the desk polls an IMAP folder you forward offers to and queues drafts for review.

**Stage 1 (ship first).** Extend `PasteCapture` (`src/components/paste-capture.tsx`) to
accept `.eml` drops: parse locally — text/plain part preferred, else HTML → text (strip
tags, keep hrefs' text); subject line prepended (often the offer title). Feed the existing
`parseOfferFromText` preview. NEW pure lib `src/lib/offers/parse-email.ts` (tests: real-ish
multipart fixtures, base64 + quoted-printable bodies). No new dependency if hand-rolled
MIME-lite proves tractable; otherwise flag `postal-mime` (tiny, no native deps) BEFORE
adding, per AGENTS.md.

**Stage 2 (separate follow-up commit, same brief).** Settings → "Email intake": IMAP host,
user, app-password (stored in app_settings; document plainly that it is stored locally
unencrypted like API keys in .env — prefer a dedicated forwarding mailbox, never a main
account), folder name (default "Edgeways"). A poll (60s×N backoff, only while desk open —
same compute-on-poll idiom as H1) fetches UNSEEN messages, runs stage-1 parsing, creates
PLANNED offers tagged `source='email'` with an inbox alert "3 offers arrived by email —
review". Never auto-activates: drafts require human review (planned status IS the review
queue). Dependency to flag at build time: `imapflow`.

**Acceptance.** Stage 1: fixture-tested parser; harness: drop .eml → preview → offer
created. Stage 2: mock-IMAP test for the fetch→draft path; drafts land planned + alert.

## J7. Acca desk — leg-by-leg lay workflow `[strong]` (W3, biggest) — ✅ DONE 2026-07-16

Shipped with Sam's design answers: lay-due = previous result in + kick-off within 30 min
(no schedule → due on previous result); lay-due alerts ON by default with per-run mute;
legs linked to tracked events auto-result (match-odds v1); insurance = BOTH methods,
picked per run. Method maths as built: sequential = zero-loss cover recursion
L=(stake+priorLiabilities)/(1−c) with the FINAL leg equalised (lock algebra) so the run
ends the same either way; insurance leg-by-leg reuses the cover recursion (run stops at
the first loss, refund alert fires when exactly one leg lost); insurance whole = one
standard equalising lay at the combined price. The acca back and every lay are REAL
tracker bets settled by the desk the moment results land. Daily Plan gains lay-due slots.
Deviation: leg "result entry" for laid sequential legs uses inline Won/Lost/Void buttons
on the desk (no separate dialog); deriveOutcomes drives linked legs.

**Objective.** Run acca offers as guided multi-day workflows. **Both types in v1 (Sam):**
(a) **sequential lay** — lay each leg just before it starts, restaking after each result so
the position stays locked; (b) **acca insurance** — free bet refund if exactly one leg
loses, lay the whole acca once (or legs) per the standard insurance method.

**Why.** Outplayed's Acca Catcher proves demand; its tracker half is pure execution
workflow. Ours works from any acca the user logs — no finder, no D2 conflict.

**Maths (pure calc — /calc-change; consume `accaMatched`,
`src/lib/calc/accumulator.ts:330`, extend beside it).** NEW `src/lib/calc/acca-workflow.ts`:
- `nextLegLay({ remainingLegs, accaStake, accaOddsRemaining, legLayOdds, commission, bankedSoFar, method })`
  → per-leg lay stake for the sequential ("lock") method — the standard recursion where each
  leg's lay covers the acca's current exposure; test vectors from a worked 4-fold.
- Insurance method: qualifying maths for "refund if exactly 1 leg loses" (trigger
  probability irrelevant to stakes; lay legs individually so any single loss is covered —
  vectors for 3- and 4-fold).

**Schema.** `acca_runs`: id, offerId nullable, method ('sequential'|'insurance'), stake,
status, createdAt. `acca_legs`: id, runId, seq, label, eventId nullable, backOdds,
layOdds nullable, layStake nullable, layBetId nullable, result ('pending'|'won'|'lost'|'void'),
scheduledAt nullable. Each placed lay is a REAL bets row (lay_only) linked via layBetId, so
settlement/P&L ride existing rails — the desk orchestrates, the tracker owns money.

**Workflow.** New nav "Acca Desk" (Live desks). Create run (from an offer or standalone) →
legs list → per-leg state machine: upcoming → LAY DUE (alert via rules.ts + push: "Lay leg
3 of your Bet365 acca — £12.40 @ ~2.1") → laid → result. Result entry manual v1 (or linked
event auto). Run summary: locked P&L so far, worst case, projection. Daily Plan slots for
lay-due legs (extends `buildDailyPlan`).

**Acceptance.** Calc vectors both methods; run lifecycle service tests (temp DB); harness:
create 3-fold sequential run → leg 1 result → leg 2 lay stake matches hand-worked; alert
fires; mobile pass.

## J8. Household account sets `[strong]` (W3) — ✅ DONE 2026-07-16

Shipped with Sam's design answers: owners are an OPEN LIST (any name assigned to an
account; no separate registry), shared bookie names resolve by DISTINCT WALLET NAMES
(identical names across owners are ambiguous → attributed to 'me' + a warning banner),
one shared Do Next plan, all five surfaces (Accounts filter + per-owner P&L strip,
league follows the filter, Edge Report + Season via ?owner= on /api/report, top-bar
per-owner balance tooltip). Owner set per account in Manage venues. Compliance framing
throughout: "operated by their owner" - tracks, never encourages.

**Objective.** Track a partner's separately-operated accounts as a tagged second set:
`accounts.owner` (additive column, default 'me'), owner filter on Accounts/Tracker/League/
Reports, per-owner P&L split, combined by default.

**Why.** Long-standing community practice the incumbents support. **Compliance framing
(standing):** copy always says "accounts operated by their owner" — Edgeways tracks, never
encourages operating someone else's accounts.

**How.** Additive `accounts.owner TEXT DEFAULT 'me'` + owners list in settings (names);
bets/offers inherit owner via bookmaker→account mapping at analytics time (no bet-level
column — an account belongs to one owner). Surfaces: owner chip filter (Accounts, league,
Edge Report, season summary); balances top-bar shows combined with per-owner popover.
Do Next unaffected v1 (single plan). Migration: everything existing = 'me'.

**Acceptance.** Analytics split tests (owner A vs B vs combined reconcile to totals);
harness: tag an account, filters split correctly; copy review for framing.

## J9. Betslip prefill extension `[strong]` (W3, last — new surface) — ✅ DONE 2026-07-16

Shipped BETDAQ-FIRST (Sam's call — his default exchange and every real lay is there;
the brief's Betfair map follows once the pattern proves out). `extension/` at the repo
root: plain MV3, no build step — Edgeways pages dispatch an `edgeways:fill-slip`
CustomEvent, the bridge content script relays to the service worker, which focuses the
Betdaq tab and fills the stake via a VERSIONED selector map that fails loud (on-page
banner). FILL ONLY — the extension never places; and Edgeways copies the stake to the
clipboard BEFORE emitting, so no extension = graceful degrade. Surfaces: the lay-stake
banner (matched calculator + Add bet), the Lock in dialog, and Acca Desk lay-due rows.
Install + manual fixture test protocol in extension/README.md.

**Objective.** A Chrome (MV3) extension: one click in Edgeways copies a structured intent →
the extension fills the betslip (selection search + stake) on the exchange tab. Betfair
exchange first; bookies later. Execution automation, zero odds scraping (D2 intact).

**Why.** Betwatch proves the pattern. Cuts the most error-prone manual step (fat-fingered
lay stakes) — directly serves "am I executing correctly?".

**How (size carefully — new package).** `extension/` workspace (plain MV3, no build deps if
possible): content script for betfair.com that finds the market view and fills
selection/stake from a payload received via `chrome.runtime` messaging; Edgeways page emits
via a custom DOM event the extension listens for (localhost + tailscale origins). Fill only
— NEVER auto-place; the user always clicks the exchange's own confirm. Fragile-selector
risk: version the selector map, fail loud with a toast fallback ("couldn't find the slip —
stake copied to clipboard" as the graceful degrade). Edgeways side: "Fill slip" buttons on
matched calculator + lock-in dialog + acca lay-due rows.

**Acceptance.** Manual harness protocol (extension loaded unpacked, drive a Betfair market
page in the harness Chrome with a stubbed page fixture for CI-less testing); clipboard
fallback tested; docs page "Install the extension".

---

# PHASE 12 — CASINO REWARD PARITY (promoted from §9, 2026-07-21)

## K1. Casino reward-type parity — multi-component campaign model `[strong]` — needs H2 — ✅ DONE 2026-07-21

**Shipped as spec'd**, including the parser extension (spin/chip/cashback single-component
detection) originally flagged as an optional lighter follow-up - there was time to do it
properly rather than defer it. Multi-component paste SPLITTING (one promo → several
components) remains out of scope, as spec'd, for a K2 follow-up.

**Objective.** H2's Casino desk models exactly one reward shape per offer — a £ bonus amount
with its own wagering multiplier, RTP and contribution % (`casinoOfferEv` in
`src/lib/calc/casino-ev.ts`). That covers **Bonus** (site credit + playthrough) and, by setting
wagering to 0, **Cash**, but has no way to represent **Free Spins** (spin count × spin value,
sometimes with a second wagering requirement on the winnings), **Golden Chips** (roulette-only
credit at a near-fixed game edge), **Cashback/loss-back** (a % of expected losses refunded, up
to a cap), or a **qualifying wager** stage (a deposit that must be staked before the reward is
even granted — e.g. "wager £100 to unlock 20 free spins"). Sam confirmed the gap against
Outplayed's EV calculator (2026-07-21) and, further, that real casino offers routinely bundle
more than one of these in a single promotion — so a single `rewardType` column per offer is the
wrong shape entirely. This brief instead makes a casino offer a **campaign that can carry
multiple components**, mirroring the pattern Edgeways already uses for sports offers.

**The existing pattern this mirrors.** A sports `offers` row is a campaign; `bets` rows link to
it via `offerId` and carry a `betType` (`qualifying | free_snr | free_sr | risk_free`); each leg
is added incrementally via the normal "Add bet" flow prefilled with the offer (see
`offer-view-dialog.tsx`'s `openAddBet(trackBet.prefill)`, which passes `offerId` + `betType`); a
service (`src/lib/services/offers.ts`) aggregates the linked bets into `OfferProfitBreakdown`
(`qualifyingProfit + freeBetProfit → totalProfit`), computed on read, never stored on the
campaign row. K1 reproduces this exactly for casino: `casino_offers` becomes the campaign,
a new `casino_offer_components` table holds N components (one row per reward or cost stage),
each contributing its own locked `expectedEv`, summed into the campaign total by a new service.

**Why this shape, concretely.** The Grosvenor "20 Free Spins" screenshot Sam supplied is a
qualifying wager (£100 staked) PLUS a Free Spins reward (20 spins @ 40p) in one promotion — two
components, one campaign. The flat single-`rewardType` model literally cannot represent this;
the campaign model does, the same way a free-bet sign-up offer needs both a qualifying bet leg
and a free-bet leg to be represented honestly.

**Component types (`componentType` enum).** `qualifying_wager | cash | bonus | free_spins |
golden_chips | cashback`. `qualifying_wager` is a COST component (its EV is always ≤ 0 — the
price of unlocking whatever reward components follow); the other five are reward components.
A campaign can hold any combination, including just one (the common case — a plain Bonus offer
is still a one-component campaign, and the UI should make that feel like a single step, not a
two-step chore — see UI section).

**Maths (pure calc — `/calc-change` applies, tests-first, hand-worked vectors before code).**
`src/lib/calc/casino-ev.ts`'s `casinoOfferEv` is UNCHANGED — it remains exactly the Bonus
component's calc (Cash is `wageringMultiplier: 0` through it, both already correct today; zero
risk to the 445 existing green tests). NEW sibling file `src/lib/calc/casino-reward-ev.ts`:

- `freeSpinsEv(input: { spins: number; spinValue: number; houseEdge: number; winningsWagerX?: number; contributionPct?: number }): { spinWinnings: number; totalTurnover: number; wageringDrag: number; ev: number }`.
  Stage 1 (the spins themselves): `spinWinnings = roundPence(spins × spinValue × (1 − houseEdge))`.
  Stage 2 (winnings wagering, only when `winningsWagerX` is truthy and > 0):
  `totalTurnover = roundPence(spinWinnings × winningsWagerX / (contributionPct ?? 1))`,
  `wageringDrag = roundPence(totalTurnover × houseEdge)` — reuses the SAME house edge as stage 1
  (Outplayed's Free Spins panel shows one RTP field servicing both). `ev = roundPence(spinWinnings
  − wageringDrag)`. When `winningsWagerX` is 0/undefined, `totalTurnover`/`wageringDrag` are 0
  and `ev = spinWinnings`. Hand-worked vectors:
  - 20 spins, £0.40 spin value, 95% RTP, no winnings wagering → `spinWinnings = £7.60`, `ev = £7.60`.
  - 50 spins, £0.10 spin value, 95% RTP, winnings wagered 20×, 100% contribution →
    `spinWinnings = £4.75`, `totalTurnover = £95.00`, `wageringDrag = £4.75`, `ev = £0.00` —
    exact break-even, shows winnings-wagering can fully erode a spins payout.
  - 10 spins, £1.00 spin value, 96% RTP, winnings wagered 10×, 50% contribution →
    `spinWinnings = £9.60`, `totalTurnover = £192.00`, `wageringDrag = £7.68`, `ev = £1.92`.
- `goldenChipsEv(input: { chipCount: number; chipValue: number; houseEdge: number }): { totalTurnover: number; wageringDrag: number; ev: number }`.
  Single-shot, no compounding turnover (chips are staked once, not cycled like slot wagering):
  `totalTurnover = roundPence(chipCount × chipValue)`, `wageringDrag = roundPence(totalTurnover
  × houseEdge)`, `ev = roundPence(totalTurnover − wageringDrag)`. House-edge presets (exported
  const, UI-facing): `EUROPEAN_ROULETTE_EDGE = 0.027`, `AMERICAN_ROULETTE_EDGE = 0.0526`.
  Hand-worked vectors: 10 chips at £5, European (2.70%) → `totalTurnover = £50.00`,
  `wageringDrag = £1.35`, `ev = £48.65`. 5 chips at £10, American (5.26%) →
  `totalTurnover = £50.00`, `wageringDrag = £2.63`, `ev = £47.37`.
- `qualifyingWagerDrag(input: { amount: number; houseEdge: number }): { totalTurnover: number; wageringDrag: number; ev: number }`.
  Now a full component type (built now, applies to any campaign — Sam's call, 2026-07-21), not
  optional. `totalTurnover = amount` (staked once, cf. Outplayed's left-hand Wagering panel),
  `wageringDrag = roundPence(totalTurnover × houseEdge)`, `ev = roundPence(-wageringDrag)` —
  ALWAYS ≤ 0; a qualifying wager never nets positive, its "value" is entirely the cost of
  unlocking the reward components that follow it. Hand-worked vector: £100 at 96% RTP →
  `wageringDrag = £4.00`, `ev = −£4.00`.
- `cashbackEv(input: { expectedTurnover: number; houseEdge: number; cashbackPct: number; cashbackCap?: number }): { expectedLoss: number; cashbackAmount: number; ev: number }`.
  A cashback offer refunds a % of losses the player would incur from their OWN play regardless
  of the offer — so the offer's marginal value is the refund itself, not the underlying play's
  own house-edge drag (that drag isn't caused by the offer; it's the baseline cost of gambling,
  same with or without it). `expectedLoss = roundPence(expectedTurnover × houseEdge)`,
  `cashbackAmount = roundPence(Math.min(expectedLoss × cashbackPct, cashbackCap ?? Infinity))`,
  `ev = cashbackAmount`. Hand-worked vectors: £500 turnover, 4% edge, 10% cashback, no cap →
  `expectedLoss = £20.00`, `cashbackAmount = £2.00`, `ev = £2.00`. £2,000 turnover, 4% edge, 10%
  cashback, £5 cap → `expectedLoss = £80.00`, cashback would be £8 but caps at `£5.00`,
  `ev = £5.00`.
- `sumCampaignEv(components: { expectedEv: number }[]): number` → `roundPence(sum)`. Trivial, but
  exists so the service layer and UI never hand-roll the addition — money maths stays exact per
  the hard rule, and it's the one function every consumer (service, UI verdict card, tests) calls
  rather than each re-summing independently.
- **Combined example (proves the campaign model, not just the components).** Qualifying wager
  £100 @ 96% RTP → `ev = −£4.00`. Free Spins 20 @ £0.40 @ 95% RTP, no winnings wagering →
  `ev = £7.60`. `sumCampaignEv([...]) = £3.60` — this is the Grosvenor screenshot's actual shape,
  and the flat single-component model from the previous draft of this brief could not express it.
- `casino-sim.ts` (J4 Monte Carlo) stays scoped to individual Bonus-type COMPONENTS in v1 — its
  balance-cycling session model doesn't fit Free Spins' discrete two-stage payout, Golden Chips'
  single-shot mechanic, Cashback's refund-on-own-play framing, or a qualifying wager's pure-cost
  shape. The "Simulate" trigger (`CasinoSimDialog`) appears per-component, only on `bonus`-type
  rows, not once per campaign. Leave a `// TODO K2` marker on the others rather than silently
  misrepresenting their distribution — a deliberate v1 scope line, flag it as such in the PR.

**Schema.** `casino_offers` (the campaign row) SLIMS DOWN — reward fields move to components:
- KEEP: `id`, `casino`, `title`, `status` (`planned|active|completed|expired`), `notes`,
  `actualProfit` (nullable, user-entered TOTAL realised profit across the whole campaign at
  completion — unchanged from today), `createdAt`, `completedAt`.
- `bonusAmount`, `wageringMultiplier`, `rtp`, `contributionPct`, `expectedEv`, `game` become
  LEGACY — kept in `schema.ts` (commented "superseded by casino_offer_components, read only by
  the one-time migration below, never written after K1 ships") rather than dropped. §0's
  migration pattern is additive-only; dropping four unused columns isn't worth the risk for a
  single-user local SQLite file, and keeping them costs nothing.
- NEW `casino_offer_components` table: `id` PK, `casinoOfferId` integer NOT NULL (references
  `casino_offers.id`), `componentType` text enum (`qualifying_wager | cash | bonus | free_spins |
  golden_chips | cashback`), `amount` real nullable (meaning depends on `componentType`: wager
  amount / cash amount / bonus amount / cashback's expected-turnover basis), `wageringMultiplier`
  real nullable (bonus playthrough ×, or free-spins winnings-wager ×), `rtp` real nullable (game
  RTP or edge-derived RTP, null = 96% heuristic default, same convention as today), `contributionPct`
  real nullable, `spins` real nullable, `spinValue` real nullable, `chipCount` real nullable,
  `chipValue` real nullable, `houseEdgePreset` text nullable (`european|american|custom`,
  cosmetic — the calc only ever reads `rtp`, this can't drift out of sync with the number that
  matters), `cashbackPct` real nullable, `cashbackCap` real nullable, `game` text nullable
  (recommended eligible game for this component), `expectedEv` real NOT NULL (locked at save
  time from this component's own inputs — negative for `qualifying_wager`), `sortOrder` integer
  NOT NULL default 0, `createdAt` integer NOT NULL. Drizzle table in `schema.ts` + `CREATE TABLE
  IF NOT EXISTS` in `db/index.ts`, per §0.

**Backward-compat migration (one-time, idempotent, in the `db/index.ts` bootstrap alongside the
existing additive-column helper).** For every `casino_offers` row with no linked
`casino_offer_components` row yet (every row that predates K1), insert one `bonus`-type
component copying `bonusAmount → amount`, `wageringMultiplier`, `rtp`, `contributionPct`, `game`
and `expectedEv` from the legacy columns, `sortOrder: 0`. Idempotent — check for an existing
linked component before inserting, so it only ever runs once per row. This is the one part of
this brief that mutates existing data rather than purely adding schema; dry-run it against a
copy of `data/edgeways.db` before it ships, and write a migration test (below).

**Services.** NEW `src/lib/services/casino-offers.ts` (server): `getCasinoOfferSummaries():
CasinoOfferSummary[]` joins `casino_offers` with `casino_offer_components` (grouped by
`casinoOfferId`, ordered by `sortOrder`). NEW client-safe `src/lib/services/casino-offers.types.ts`:
`CasinoOfferSummary extends CasinoOfferRow { components: CasinoOfferComponentRow[]; expectedEv:
number }` where `expectedEv = sumCampaignEv(components)`, computed on read, NEVER stored on the
campaign row — mirrors `OfferSummary.profit` being derived, not stored. The legacy
`casino_offers.expectedEv` column is read exactly once, by the migration, then never again.

**API.**
- `GET /api/casino` → returns `CasinoOfferSummary[]` (was flat `CasinoOfferRow[]`).
- `POST /api/casino` → creates the CAMPAIGN only (`casino`, `title`, `status`, `notes`) — no
  reward fields. A campaign with zero components is valid, same as a sports offer with zero bets.
- NEW `POST /api/casino/[id]/components` → adds one component to an existing campaign. Zod
  discriminated union keyed on `componentType`, validating only the fields that type uses
  (reject stray ones — e.g. a `cash` component must not also carry `spins`). Derives and stores
  `expectedEv` from the matching calc function. Mirrors the `offerId`-prefill pattern
  `add-bet-dialog.tsx` already uses.
- NEW `PATCH /api/casino/[id]/components/[componentId]` → edits one component, re-derives its
  `expectedEv`.
- NEW `DELETE /api/casino/[id]/components/[componentId]` → removes one component.
- `PATCH /api/casino/[id]` → campaign-level fields only (`casino`, `title`, `status`,
  `actualProfit`, `notes`) — reward fields move entirely to the components endpoints.
- Validation bounds carried over from today: `spins`/`chipCount` positive; `spinValue`/`chipValue`
  positive; `wageringMultiplier`/`winningsWagerX` non-negative, max 200 (matches the existing
  `wageringMultiplier` bound); `cashbackPct` in (0, 1]; `rtp` in [0.5, 1].

**UI — mirrors the sports "Add bet against this offer" idiom, not one giant form.**
- "Log a casino offer" (`casino-log-provider.tsx`) becomes a small first step — Casino, Title
  only — creating the empty campaign, then immediately opening "Add a component" for the first
  one, so the common single-component case (a plain Bonus offer) still reads as one continuous
  flow even though it's technically two calls.
- NEW component dialog (opened from the log flow's first component, or from an existing
  campaign's card via "+ Add component", mirroring `openAddBet` prefilled with `offerId`/
  `betType` in `offer-view-dialog.tsx`): a `componentType` dropdown (Qualifying wager / Cash /
  Bonus / Free Spins / Golden Chips / Cashback) swaps the field set below it —
  - *Qualifying wager*: Wager amount (£), Game RTP (%).
  - *Cash*: Cash amount (£) only.
  - *Bonus*: Bonus value (£), Wagering (×), Game RTP (%), Contribution (%) — unchanged from today.
  - *Free Spins*: No. of spins, Spin value (£), Game RTP (%) (fed by `CasinoGamePicker`),
    Winnings wager (×) (optional, default 0), Contribution (%) (stage 2 only, disabled while
    `winningsWagerX` is 0).
  - *Golden Chips*: No. of chips, Chip value (£), House edge preset (European 2.70% / American
    5.26% / Custom, the last revealing a % field).
  - *Cashback*: Expected turnover (£), Game RTP (%), Cashback (%), Cap (£, optional).
- `/casino/page.tsx` campaign cards replace today's flat rows: casino/title/status header, a
  per-component breakdown line (e.g. "Qualifying wager −£4.00 · Free Spins +£7.60"), the campaign
  total EV + basis badge (worst basis across components — any heuristic component makes the whole
  campaign read "heuristic", same honesty principle as everywhere else) + variance chip (sourced
  from whichever components carry genuine wagering-bust risk — Bonus, Free Spins with
  `winningsWagerX` > 0, Cashback; NOT Cash, Golden Chips, or a qualifying wager alone), "+ Add
  component", and per-component edit/remove actions.
- `parse-casino-offer-text.ts` stays single-component detection in v1 (today's regexes, extended
  with spin/chip/cashback patterns: `"(\d+)\s+free\s+spins"`, `"spins?\s+worth\s+£X(?:\s+each)?"`,
  `"(\d+)\s+(?:golden\s+)?chips"`, `"(\d+)%\s+cashback"`) — the parsed draft prefills the FIRST
  component of a new campaign. Detecting and correctly splitting multiple components from one
  block of promo text (e.g. "deposit £10 get £10 bonus AND 20 free spins" — which phrase belongs
  to which component) is real ambiguity and is EXPLICITLY OUT OF SCOPE for K1; flag as a K2
  follow-up once the multi-component model is live and real paste examples exist to test against.

**Nuance.**
- This is materially bigger than a column-add — schema, services and API all change shape. If it
  doesn't fit one PR, it splits cleanly at: (1) schema + migration + calc + services + API,
  (2) component dialog + campaign card UI, (3) parser extension — ship in that order, each
  independently testable, mirroring how H2 itself shipped its follow-ups same-day but separately.
- Casino realised P&L is ledgered (wallet + History/Home feed + total P&L Casino
  bucket). Casino EV still never feeds Do Next / edge-on-the-table sums.
- `qualifyingWagerDrag`'s `ev` is always ≤ 0 by construction — a campaign consisting of ONLY a
  qualifying-wager component (no reward added yet) should read as a net-negative "not worth it
  yet" state in the UI, not an error; it's a legitimate intermediate campaign state, same as a
  sports offer that's qualifying but hasn't been awarded its free bet.

**Acceptance.**
- Vitest: every calc branch (`freeSpinsEv`, `goldenChipsEv`, `qualifyingWagerDrag`, `cashbackEv`,
  `sumCampaignEv`) with the hand-worked vectors above; the combined qualifying-wager + free-spins
  vector proves campaign summing is exact.
- Migration test: seed a legacy-shape `casino_offers` row (no components), run the bootstrap,
  assert exactly one `bonus`-type component exists with the original values and the campaign's
  derived `expectedEv` matches the original stored value exactly.
- calc-auditor pass.
- `/casino` verified in the harness: create a campaign, add a Qualifying wager component, add a
  Free Spins component, verify the card shows both lines and the correct summed EV; edit and
  remove a component; a pre-migration offer still loads, displays and edits correctly.
- Mobile 390×844 pass; suite + build green.

## K2. Combined-campaign Monte Carlo simulation `[strong]` — needs K1 — ✅ DONE 2026-07-21

**Shipped as spec'd**, including both lowest-confidence parts confirmed by building rather than
asking again: the Golden Chips even-money payout multiplier default, and the cashback
underlying-play model (which turned out to need a `Math.max(0, …)` clamp on the per-run loss the
brief's text didn't spell out explicitly — real cashback never claws back a winning session, so
the clamp is correct; it does mean the simulated mean sits at/above a naive unclamped expectation,
same honesty category as the module's existing bust-truncation divergence for Bonus, and the test
suite asserts structural properties for cashback rather than a tight numeric convergence for
exactly that reason). Also folded in as part of this ship: an "Expires" date on casino campaigns
and a day-split Casino calendar (`/casino/calendar`), plus the sidebar's Casino entry becoming a
Calendar/Campaigns group mirroring Offers — bundled in by Sam alongside the K2 build request,
not separately briefed.

**Objective.** J4's Monte Carlo (`src/lib/calc/casino-sim.ts`) simulates ONE Bonus component's
wagering session in isolation; K1's campaign card only offers "Simulate" on a Bonus row for
exactly that reason. Sam asked (2026-07-21) whether a campaign with several components (e.g. a
qualifying wager + free spins, or a bonus + cashback) could get ONE combined distribution instead
of simulating each component separately in your head. Confirmed worth building, as its own
scoped brief given the modelling lift, not a quick extension.

**Why.** A campaign's real bust risk is the SUM of its components' risk, and summing two
independent distributions isn't the same as adding their means (K1's `sumCampaignEv` is correct
for the EV number, but the variance of a sum is not the sum of the variances' square roots in any
way a user should have to compute by hand). A combined simulation is the only honest way to show
"what does a whole Grosvenor-shaped campaign (wager £100, get 20 spins) actually look like across
many attempts" as one distribution, the same honesty standard J4 already set for a single Bonus.

**Architecture - compose, do not fork, the existing session primitives.** `runSession` (the
wagering-cycle loop: stake `spinStake` per iteration, hit the scaled volatility ladder, until the
requirement clears or the balance busts) is the ONE reusable engine and must not be
reimplemented per component type (same "never reimplement, only extend" rule K1 already
followed for `casino-sim.ts` itself). Each component type maps onto it or a small sibling as
follows:

- **Bonus** - already `runSession` exactly as J4 built it. No change.
- **Qualifying wager** - `runSession` with `bonus = amount`, `wageringMultiplier = 1` (the wager
  clears its own value once, by definition). The session's `final` balance is what the player
  keeps after clearing the qualifying stake through the game - this is the simulated analogue of
  `qualifyingWagerDrag`'s analytic `ev = -wageringDrag`, i.e. `simulatedEv = final - amount`
  (framed as a cost relative to the stake put in, matching the analytic function's sign
  convention). Hand-worked sanity check before coding: with `wageringMultiplier = 1` and a
  realistic RTP, `mean(final) ≈ amount × rtp` across many runs, so `mean(simulatedEv) ≈
  amount × rtp - amount = -amount × houseEdge`, converging on `qualifyingWagerDrag`'s analytic
  figure - pin this convergence with a test exactly like J4's own analytic-convergence test for
  Bonus.
- **Free Spins stage 1 (the spins)** - NOT a wagering cycle, so NOT `runSession`. NEW
  `simulateSpinsSession(spins, spinValue, volatility, rtp, rng)`: draw exactly `spins`
  independent hits from the SAME scaled ladder (`scaledLadder`) used elsewhere, each staking
  `spinValue`, sum the returns. No requirement, no cycling, no bust condition - a fixed number of
  independent draws. `mean(sum) ≈ spins × spinValue × rtp` must converge on `freeSpinsEv`'s
  `spinWinnings` - test this convergence.
- **Free Spins stage 2 (winnings wagering, only when `winningsWagerX > 0`)** - CHAINED, not
  independent: for a given run, feed THAT run's stage-1 simulated winnings into `runSession` as
  `bonus`, with `wageringMultiplier = winningsWagerX`. This is the one place a combined
  simulation must carry state between two sub-steps of the SAME run (every other component's
  contribution is independent per run and can be summed directly).
- **Golden Chips** - NEEDS A NEW, SIMPLER DISTRIBUTION, not the slot ladder. A golden chip is one
  discrete bet, not a slot spin - model as a single Bernoulli draw per chip: win with probability
  `p = (1 - houseEdge) / payoutMultiplier` and return `chipValue × payoutMultiplier` on a win, 0
  otherwise. **Confirm payoutMultiplier before building** (lowest-confidence part of this brief,
  same "confirm before /calc-change starts" flag K1 used for its own uncertain parts): the
  natural default is an even-money outside bet (red/black, odd/even), `payoutMultiplier = 2`, but
  this should be confirmed against what Sam has actually seen in a golden-chips promo rather than
  assumed. Hand-worked check: `p × payoutMultiplier = 1 - houseEdge` must hold exactly so
  `mean(chip return) = chipValue × (1 - houseEdge)`, converging on `goldenChipsEv`.
- **Cashback** - simulates the UNDERLYING play the cashback is a rebate on, using `runSession`
  with `bonus = expectedTurnover`, `wageringMultiplier = 1` (the same "clears its own value once"
  shape as the qualifying wager - the player is simply playing through their stated turnover).
  `actualLoss = expectedTurnover - final` for that run; `cashbackAmount = min(actualLoss ×
  cashbackPct, cashbackCap ?? Infinity)` is that run's simulated payout. This is the component
  whose modelling choice is LEAST certain of the five (a cashback offer's true variance depends
  on how the player actually staked during the period, which K1's analytic model already
  simplifies away) - flag it for Sam's sign-off alongside the Golden Chips payout multiplier
  before starting `/calc-change`.

**Composition.** NEW `simulateCampaign(components, volatility, rng): number` runs ONE simulated
outcome per call, summing each component's contribution as spec'd above (chaining Free Spins'
two stages, everything else independent), returning a single £ figure. The existing chunked
10,000-run loop, seeding, histogram bucketing and percentile maths in `casino-sim-dialog.tsx`
and `summariseFinals` are REUSED as-is, just fed `simulateCampaign` results instead of
`runSession` results directly - no UI rework needed beyond swapping what feeds the distribution
and moving the "Simulate" trigger from a per-component row to the campaign card's header
(replacing the per-component placement K1 shipped, now redundant once whole-campaign simulation
exists - keep the per-component `CasinoSimDialog` for a Bonus-only campaign as a degenerate case
of the same combined function, do not maintain two separate simulate code paths).

**Acceptance.** Vitest for `simulateSpinsSession` and the Golden Chips Bernoulli draw (hand-worked
convergence tests, same rigor as J4's `expectedSpinReturn` calibration test); `simulateCampaign`
convergence test against `sumCampaignEv` for a multi-component campaign (mirrors K1's own
Grosvenor combined-vector test, run through simulation instead of the analytic path); calc-auditor
pass; harness check that a multi-component campaign's "Simulate" produces one histogram, not one
per component; suite + build green.

## K3. Recurring casino offers `[strong]` — needs K1 — ✅ DONE 2026-07-28

**Objective.** Sports offers already support recurrence (Sam asked 2026-07-21 whether casino
offers should too, "we do this for Bet offers"): a template row (`offer_series`) plus a
horizon-based materialiser (`src/lib/offers/offer-recurrence.ts`) that stamps out one `offers`
instance per calendar date the rule fires, rolls each instance's status by date, and can "stop
from this date forward" without touching already-materialised history. Casino has no equivalent -
a genuinely daily/weekly casino offer (a real, common shape: many operators run the same reload
bonus or free-spins drop every day) has to be logged by hand each time today.

**Why this is comparable in size to K1 itself, not a small add-on.** The sports model recurs a
SINGLE `offers` row per instance (bets get logged fresh against each instance as they happen).
A casino campaign's whole value is in its COMPONENTS - "the same offer daily" means the same
components repeat, not just an empty campaign shell. The template therefore has to carry a
component template too, and materialising an instance means creating both the `casino_offers`
row AND its component rows in one transaction, every time the rule fires.

**Architecture - mirror `offer_series`/`offer-recurrence.ts` exactly, do not invent a new
recurrence shape.** NEW `casino_offer_series` table (Drizzle + `CREATE TABLE IF NOT EXISTS` per
§0): `id`, `recurrenceEnabled`, `recurrenceStoppedFrom`, `ruleJson` (reuse
`OfferRecurrenceRule`/`parseRecurrenceRule` from `offer-recurrence-shared.ts` UNCHANGED - do not
fork the rule grammar), `casino`, `title`, `notes`, `horizonDays` (default 14, matches the sports
default), `createdAt`, `updatedAt`. NEW `casino_offer_series_components` table: `seriesId`, plus
the SAME component-shape columns as `casino_offer_components` (componentType and its
type-specific fields) MINUS `expectedEv` (a template has no locked EV - each materialised
instance derives its own via `deriveComponentEv` at creation time, same as a manually-logged
component) and MINUS `casinoOfferId` (replaced by `seriesId`).

`casino_offers` gains `seriesId` (nullable, additive) + `instanceDate` (nullable, additive) -
mirrors `offers.seriesId`/`offers.instanceDate` exactly.

NEW `src/lib/offers/casino-offer-recurrence.ts` (sibling to, not a merge with,
`offer-recurrence.ts` - the sports module's `insertInstance` writes sport/racing-specific columns
that don't apply here, and forcing one shared function to branch on "is this a casino series" is
worse than two small parallel modules): `insertCasinoInstance(series, componentsTemplate,
instanceDate, todayKey, now)` creates the `casino_offers` row (status derived from
`instanceStatusForDate`, REUSE that helper unchanged, it's date-arithmetic with no sports
coupling) then loops the component template rows, inserting one `casino_offer_components` row
per template row with `expectedEv` derived fresh via `deriveComponentEv` (so a component that
references game RTP or a preset picks up the CURRENT calc, not a stale locked number).
`syncCasinoOfferSeriesInstances(now)` mirrors `syncOfferSeriesInstances` - expand the rule over
the horizon window, materialise missing dates, no double-creation (check existing
`instanceDate`s first, same idempotency the sports version relies on).
`stopCasinoOfferRecurrence(seriesId, fromDateKey)` mirrors `stopOfferRecurrence` - disable the
series, delete only untouched future planned instances (an instance with logged components more
than the template default, or already started/completed, is never silently deleted - reuse the
sports version's exact "don't delete if there's user work on it" guard, adapted to check
`casino_offer_components` rows that diverge from the template rather than linked `bets`).

**UI.** `CasinoLogProvider`'s campaign-creation step gains a "Repeat" toggle (mirrors wherever the
sports offer editor exposes `OfferRecurrenceRule` - reuse that same rule-editing control, do not
build a second one) that, when enabled, saves the just-built campaign + its components as a
`casino_offer_series` template instead of (or in addition to - confirm which) a one-off
`casino_offers` row. `/casino` page cards for a recurring instance show the same recurrence
affordance sports offers show (stop-from-here action) - reuse the existing component if it isn't
sports-coupled, otherwise a small casino-specific sibling.

**Confirm before `/calc-change` starts (lowest-confidence parts, Sam's call).**
1. Does starting a recurring campaign create the FIRST instance immediately (so "daily from
   today" behaves the same as the sports flow) or only from tomorrow? Match whatever the sports
   flow already does - check `createOfferSeriesWithInstance`'s exact behaviour and mirror it,
   don't re-decide this independently.
2. When a template's components change (Sam edits the series, not a single instance), do
   already-materialised FUTURE (not-yet-started) instances update, or only instances
   materialised after the edit? The sports model's answer to the equivalent question should be
   the default here too - confirm by reading how editing an `offer_series` template behaves
   today rather than assuming.

**Acceptance.** Reuse `offer-recurrence.test.ts`'s test shapes as the template for
`casino-offer-recurrence.test.ts` (horizon expansion, no double-materialisation, stop-from-date
leaves history intact, status rolls correctly by date) - CasinoOfferSeries gets the same rigor
sports series already has, adapted to also assert each materialised instance's components match
the template with freshly-derived (not stale) EVs; calc-auditor pass on the EV-derivation path;
harness check: create a daily series, roll the clock (or force a resync), confirm a second day's
instance appears with its own components and its own locked EV; suite + build green.

---

# PHASE 13 — ACCA DESK GROWS UP (Track J follow-on)

J7's leg-by-leg lay workflow shipped 2026-07-16; a styling pass on 2026-07-22 fixed the run
header (grey "Campaign P&L" bar matching the Profit Tracker's `bet-campaign-sections.tsx`
convention, backed by a new tested `accaCampaignProfit()` in `acca-workflow.ts`), replaced the
misleading "Pending" badge on legs a busted sequential run will never lay with "not needed", and
added a one-line bust reason. That work is DONE and out of scope here — these three briefs are
what Sam asked to scope next (2026-07-22), inspired by (not cloned from) Oddsmonkey's acca
tooling: an outcome-probability readout, a proper history/richer-columns view, and native
boosted-odds support (Sam's own trigger: a 50% final-price boost on a 2-leg acca that he had to
reverse-engineer into per-leg odds by hand to use the desk at all).

## L1. Acca outcome-probability calc `[local]` — needs J7 — ✅ DONE 2026-07-22

**Objective.** A small, pure, independently-shippable calc: given each leg's back odds, return
`{ allWinPct, oneLosePct, atLeastOneLosePct }` - the "ALL WIN / 1 LOSE / 1+ LOSE" breakdown
Oddsmonkey shows per acca campaign - so the run card can carry one honest probability readout
without waiting on L2's bigger layout work.

**Why.** It's the single most useful "informative piece" from Oddsmonkey's tool and it's cheap:
no schema change, no new UI surface, pure maths on data already in `AccaLegRow[]`. Shipping it
alone first also de-risks L2 - the probability bar can be built and tested against real runs
before the bigger view around it is designed.

**Maths (pure calc — /calc-change; extend `src/lib/calc/acca-workflow.ts`, beside
`accaCampaignProfit`).** New `accaOutcomePercentages(legs: { backOdds: number; result: "pending" |
"won" | "lost" | "void" }[])`:
- Naive implied win probability per leg `p_i = 1 / backOdds_i` (no market-wide prices exist for an
  ad-hoc acca leg, so a true no-vig `p_i` per A2's provenance model isn't available - this MUST
  render with a `basis: "heuristic"` badge, same component A2 already built, never presented as
  a live/measured probability).
- Legs already settled (`result !== "pending"`) are certain, not probabilistic: a `won`/`lost` leg
  contributes probability 1 or 0, not `1/backOdds`, so the bar sharpens as a run plays out rather
  than staying static from creation.
- `allWinPct = Π p_i` (product over every non-void leg; void legs excluded, same convention as
  `combinedBackOdds`).
- `oneLosePct = Σ_i [(1 - p_i) · Π_{j≠i} p_j]` (exactly one leg loses, every other wins).
- `atLeastOneLosePct = 1 - allWinPct`.
- Test vectors: a clean 3-leg example with round odds (e.g. 2.0/2.0/2.0 → allWin 12.5%, exactly-one
  37.5%, 1+ 87.5% - hand-verifiable with p=0.5 each); a leg already `won` (p forced to 1) changes
  the remaining product; a `void` leg is excluded entirely, matching `combinedBackOdds`'s existing
  void-exclusion convention (reuse the same filter, don't reinvent it).

**UI.** A slim three-segment bar (or three stat chips) in `RunCard` (`src/app/acca/page.tsx`),
under the existing grey Campaign P&L header, labelled exactly as Oddsmonkey does (ALL WIN / 1
LOSE / 1+ LOSE) since that's a well-understood convention in this community, styled with existing
shadcn/Tailwind tokens (no new colour). Carries the heuristic basis badge (A2 component) inline.

**Acceptance.** New `describe("accaOutcomePercentages...")` block in `acca-workflow.test.ts`
covering the vectors above; `npx vitest run` green; calc-auditor pass (it's additive/pure, same
shape as `accaCampaignProfit` - should be a fast review); wired into `RunCard` behind no feature
flag (additive UI, nothing to gate).

## L2. Acca Desk history & richer per-leg view `[strong]` `[design-first]` — needs J7, L1 — ✅ DONE 2026-07-22

Shipped built-then-screenshotted rather than mock-first (Sam's standing preference for design-first
items - iterate from a working build, not a wireframe): segmented `Tabs` split Active/History by
`run.status` (zero API change, filtered client-side as scoped); History `RunCard`s default
collapsed to the headline (header + Campaign P&L + L1's probability bar) via a `collapsedByDefault`
prop and a `ChevronDown` toggle, expanding to the full leg list and footer on demand - the same
progressive-disclosure split §4.2 already uses for mobile, reused here for a growing desktop list;
each `LegRow` gained a per-leg £ contribution figure (liability paid or lay profit kept, once that
leg's lay has actually settled) next to its badge. Screenshotted and reviewed (design-reviewer pass
clean bar two pre-existing, unrelated colour/time-format nits in the same file, fixed same day).

**Objective.** Grow the Acca Desk from "one flat list of run cards" into the fuller feature Sam
asked for: a clear split between live runs and finished ones, and more informative per-leg
columns/detail - Oddsmonkey's ideas (dedicated campaign table, clear concluded-vs-live treatment),
reshaped into Edgeways' own calculator/BackPanel design language rather than copied wholesale.

**Why.** Today `/acca` (`src/app/acca/page.tsx`) renders every run - active or long-settled - in
one `runs.map(...)` list (verified 2026-07-22, `AccaDeskPage` component). As history accumulates
this becomes a scroll of dead campaigns ahead of the ones that actually need attention today,
which is the same "informative pieces displayed clearly" gap Sam flagged when reporting the
misleading Pending-state bug that prompted the Phase 13 styling pass.

**Design-first - wait for Sam's wireframe/mock before building.** This is a real information-
architecture decision, not a wiring job: how much of Oddsmonkey's per-leg column density
(Date/Event/Bet/Back/Lay/Exchange/Com/Stake/Lbty/Outcome) is worth carrying into Edgeways'
denser calculator-card idiom vs collapsing into the existing `LegRow` line, where the L1
probability bar sits relative to the P&L header, and what a "History" tab/section looks like
(separate route, a collapsed accordion under Active, or a filter toggle) all need a decision Sam
should sketch or describe before code starts, per the sizing tag's own definition.

**Known constraints for whoever designs this (from the current code, verified 2026-07-22).**
- `GET /api/acca` (`src/app/api/acca/route.ts` → `listAccaRuns()` in
  `src/lib/services/acca-desk.ts`) returns every run regardless of status, sorted newest-created-
  first - an Active/History split can filter client-side on `run.status` with zero API change, or
  gain a `?status=` param if the history list needs pagination once it's large.
- `run.status` is exactly `"active" | "completed" | "abandoned"` (schema.ts) - History = the
  latter two, Active = the former. No new status values needed.
- L1's probability bar and the existing Campaign P&L header both need to reflow into whatever the
  new card/row shape is - don't design L2 assuming today's `RunCard` header exists unchanged.

**Acceptance.** Once a mock exists: harness check with several runs spanning both buckets confirms
correct placement; a completed run's history view still renders the busted-leg reason (already
shipped) and the L1 probability bar frozen at its final state; suite + build green; design-reviewer
pass against `docs/design-system.md`.

## L3. Boosted acca odds `[strong]` — needs J7 — ✅ DONE 2026-07-22

Shipped with Sam's confirmed answers to all three open questions: winnings-only convention
(`boosted = 1 + (rawCombined − 1) × (1 + boostPct/100)`); entered as a run-level percentage,
recomputed live from current leg odds (not a direct final-price override); and a voided leg
recomputes the boost against the remaining legs rather than freezing the original price.
`boostPct` (nullable, additive) on `acca_runs`; `applyAccaBoost()` threaded through every
money-relevant call site that read the raw combined odds - `completeRun`'s real settlement,
`legDueState`'s final-leg lock suggestion (used by both the UI and lay-due alerts),
`createAccaRun`'s stored back-bet odds, and `accaCampaignProfit`'s all-win branch - plus a new
`setRunBoost()` service function (PATCH-only for now, no dedicated edit-after-creation UI yet)
that refuses once a run is no longer active, so a completed run's boost can never desync from its
already-settled bet. calc-auditor passed twice (once on the core threading, once after closing a
`setRunBoost` guard gap and finishing the API/UI wiring it flagged as incomplete).

**Objective.** Let a run carry a bookmaker "acca boost" percentage and have the desk apply it
correctly from then on, instead of the user reverse-engineering equivalent per-leg odds by hand
(Sam's real example: a 50% boost on the FINAL combined price of a 2-leg acca).

**Why this is `[strong]`, not a UI label.** The boost changes the combined odds the acca actually
pays at, and combined odds feed two money-maths paths, not one cosmetic display:
1. `finalLegLockLay()`'s `combinedBackOdds` input (the last leg's equalising lock stake - gets this
   wrong and the "locks the same either way" guarantee breaks).
2. `accaCampaignProfit()`'s all-win branch (`run.stake * (combined - 1)`, shipped 2026-07-22) and
   the existing "if all win (est.)" footer figure in `RunCard` - both need the BOOSTED figure, not
   the raw leg-odds product, once a boost is set.
- Good news verified 2026-07-22: `nextSequentialLay()` (the non-final-leg cover recursion) takes
  only `accaStake` + `priorLiabilities` + `commission` - no odds input at all - so intermediate
  legs' cover-lay maths is UNAFFECTED by a boost. The blast radius is smaller than it first looks:
  only the final-leg lock and the two profit/projection figures need the boosted combined odds
  substituted in for the raw product.

**Confirm before `/calc-change` starts (Sam's call - do not guess, do not write code yet).**
1. **Which convention does the boost use?** Two real formulas exist in the market and they give
   different numbers: (a) *whole-price* boost - `boostedOdds = rawCombined × (1 + boostPct)`; (b)
   *winnings-only* boost (more common industry phrasing, "your winnings boosted by X%") -
   `boostedOdds = 1 + (rawCombined − 1) × (1 + boostPct)`. Sam's own 2-leg example (50% boost) is
   the acceptance test: hand-compute both conventions against his actual bet slip and confirm
   which one matches before writing `applyAccaBoost()` or its test.
2. **Does the user enter the boost as a run-level percentage (recomputed live from current leg
   odds) or as a direct boosted-combined-odds override?** A percentage is more useful if legs get
   edited before kick-off; an override is simpler and matches "I already know the boosted price
   from the slip." Recommend the percentage (matches how bookies market it, "50% boost") unless
   Sam has a reason to prefer entering the final price directly.
3. **What happens if a leg voids after the boost is set?** Real bookmakers are inconsistent here
   (some keep the original fixed boosted price, some recompute against the remaining legs). Default
   recommendation: recompute from the remaining (non-void) legs' product using the same boost %,
   clearly documented as Edgeways' choice, not a scraped bookmaker rule - confirm Sam is fine with
   that default before building it in, since it's the kind of silent-assumption the calc-change
   guardrail exists to catch.

**Schema (once Q1-Q2 are answered).** `acca_runs` gains `boostPct` (real, nullable, additive
column per §0's `ALTER TABLE` convention - needs both the Drizzle field in `schema.ts` AND the
matching `CREATE TABLE`/`ALTER TABLE` block in `src/lib/db/index.ts`).

**Maths (pure calc — /calc-change; extend `src/lib/calc/acca-workflow.ts`).** New
`applyAccaBoost(rawCombinedOdds, boostPct)` using whichever convention Q1 confirms, exported and
tested with Sam's own 2-leg worked example as the primary vector (hand-computed, not invented) plus
a `boostPct` of 0/undefined round-tripping to `rawCombinedOdds` unchanged (existing unboosted runs
must show byte-for-byte the same numbers they do today - this is the regression guard). Thread the
boosted figure into `finalLegLockLay`'s `combinedBackOdds` argument and into `RunCard`'s all-win
projection and `accaCampaignProfit`'s all-win branch (both currently call the plain leg-odds
product `combined(legs)` in `src/app/acca/page.tsx` - each call site needs the boosted figure
substituted when `run.boostPct` is set).

**UI.** `CreateRunForm` (`src/app/acca/page.tsx`) gains an optional "Boosted?" toggle + a boost %
`PanelInput`, shown collapsed by default (most accas aren't boosted) inside the existing green→
exchange-tinted `BackPanel`. `RunCard`'s header shows the boosted combined odds (with the raw
odds available on hover/tooltip - never silently hide the real bookmaker price) once a run has
`boostPct` set.

**Acceptance.** `applyAccaBoost` test vectors (Sam's real example + the zero-boost identity check)
green under `npx vitest run`; calc-auditor pass BEFORE this lands (money maths, touches the
final-leg lock and campaign P&L) verifying every call site that reads `combined(legs)` for money
purposes was updated consistently, not just the ones on the happy path; harness check: create a
boosted 2-leg run matching Sam's real slip, confirm the final-leg lock stake and the Campaign P&L
figure match hand-computed numbers at both conventions' worth of scrutiny; suite + build green.

---

# PHASE 14 — OFFER EDGE

Promoted from §9 on 2026-07-31. Trigger: Sam's daily "Bet £50 get £50 free bet if your horse
finishes 2nd, 3rd or 4th" offer, and the observation that the Racing Desk currently picks the
target horse from market rank rather than from price.

**The decisions taken in planning, so no agent re-litigates them.**
1. The objective is `P(finishes exactly 2nd, 3rd or 4th)`. **A win is a miss** — the free bet is a
   consolation for narrowly losing, confirmed by Sam. So the target quantity is
   `P(top four) − P(wins)`, not `P(top four)`.
2. Full stake on ONE horse in ONE race. No dutching across two runners in v1 (Sam's call).
3. Model only. Do NOT add a Betfair "To Be Placed" (`marketTypeCodes: ["PLACE"]`) call in v1 — API
   cost stays flat (Sam's call). It is the obvious v2 calibration anchor; leave it out.
4. Racing only, but the offer's target outcome is a general concept other sports plug into later.
5. Surfaces show **£EV, plain-English reasons and the existing confidence chip**. Never a
   probability table (Sam: the maths is the secret sauce). The confidence chip stays because §1's
   north star and A2's provenance rule are non-negotiable — hiding the working is fine, hiding how
   much to trust the number is not.

**Why the current code is wrong.** `scorePlaceRefundRunners()`
(`src/lib/offers/racing-offer-rules.ts:284`) scores by market *rank* with flat bonuses (rank 2 gets
`+40`, rank 3 `+30`, rank 4 `+25`), hard-excludes the favourite (`p.rank >= 2 && p.rank <= 5`), and
never looks at field size. `estimatePlaceRefundTriggerProb()`
(`src/lib/offers/place-refund-ev.ts:11`) then turns rank into a probability via multipliers clamped
to `[0.03, 0.45]`. Rank is the wrong variable: a 2nd favourite at 5.0 behind a 1.4 shot and a 2nd
favourite at 3.4 behind a 3.0 shot score identically today but are completely different bets.

**The maths, once, for every brief below.** Harville (Plackett-Luce with exponent 1) over the
no-vig win probabilities `p_i`:

```
P(i finishes 2nd) = Σ_{j≠i}  p_j · p_i/(1 − p_j)
```

The `1/(1 − p_j)` term is why a dominant favourite roughly doubles a mid-priced horse's chance of
running second (worked example: a horse with a 12% win chance sits at ~27% to finish 2nd behind a
1.5 favourite, but only ~13% behind a weak 5.0 favourite). The same formula concentrates top-four
mass when the field thins out after 4th, and it captures field size for free — three target
positions out of 8 runners is roughly double the hit rate of three out of 16. All three of Sam's
stated instincts are therefore consequences of one model, not three hand-tuned bonuses.

## M0. Capture the exchange back price `[local]` — prerequisite for M1

**Objective.** Stop throwing away half the Betfair order book.

**Why.** `src/lib/services/exchange/betfair.ts` requests `EX_BEST_OFFERS` and reads only
`bookRunner.ex?.availableToLay?.[0]` (the `MarketBookRow` interface at line ~212 does not even
declare `availableToBack`). `availableToBack` arrives in the **same response** at **zero extra API
cost**. `trueProbabilityFromExchange(back, lay)` already exists in `src/lib/calc/ev.ts:47` and
computes exactly the midpoint the model wants — it is simply never given a real back price.

**Files.**
- `src/lib/services/exchange/betfair.ts` — add `availableToBack?: Array<{ price; size }>` to the
  `MarketBookRow` runner shape; populate a new optional `backDecimal` / `backSize` on the emitted
  quote. A runner with a lay but no back (or vice versa) must still emit its quote.
- `src/lib/services/exchange/types.ts` — `ExchangeLayQuote` gains optional `backDecimal`,
  `backSize`. **Optional and additive** so the Betdaq stub and every existing caller compile
  untouched.
- `src/lib/racing-desk/types.ts` — `RacingRunnerDetail` gains optional `exchangeBackDecimal`,
  `exchangeBackSize`.
- `src/lib/services/racing-desk.ts` — thread the new fields through the enrichment step that
  already maps quotes onto runners.

**Nuance.** Do NOT change `exchangeDecimal` semantics: it stays the lay price, because the whole
desk, the offer guide and the qualifying-loss maths read it as the lay. The back price is
additive context for the probability model only.

**Acceptance.** Existing exchange tests unchanged and green; a runner with both sides present
carries both on the desk payload; nothing that reads `exchangeDecimal` changes behaviour.

## M1. Finishing-position model `[strong]` — pure calc, /calc-change

**Objective.** New `src/lib/calc/racing/finish-positions.ts`: given win probabilities, return each
runner's probability of finishing 1st, 2nd, 3rd and 4th.

**API.**
```ts
export interface FinishPositionProbs {
  /** probs[runnerIndex][position - 1] */
  byRunner: number[][];
}
export function finishPositionProbs(
  winProbs: number[],
  opts?: { maxPosition?: number; exponent?: number }
): FinishPositionProbs;
```

**Algorithm.** Exact enumeration, no simulation. Enumerate ordered triples `(a, b, c)` of distinct
runners as the first three finishers; each triple's probability is
`p_a · p_b/(1−p_a) · p_c/(1−p_a−p_b)`. Accumulate positions 1–3 from the triple, then for every
remaining runner `i` add `tripleProb · p_i/(1−p_a−p_b−p_c)` to its 4th-place total. A 24-runner
field is ~12k triples × 24 runners ≈ 290k operations, microseconds. Guard against a zero or
negative remaining denominator (possible with floating point when probabilities are extreme).

**The exponent parameter.** Harville is documented to overstate the place chances of short-priced
horses; the standard correction is a Stern exponent applied to positions after the first
(`p_j^λ / Σ_{k∈S} p_k^λ` when drawing from remaining set `S`, with position 1 left at λ=1 so the
model reproduces the market's win probabilities exactly). **Ship v1 at `exponent: 1` (pure
Harville).** Plumb the parameter and test that `λ < 1` shifts mass toward longshots, but do NOT
invent a default constant and do NOT expose a Settings knob yet — the honest way to set it is to
calibrate from Sam's own realised hit rate once results accumulate, which is a §7.4 data-moat
feature in its own right. Record that as the follow-up.

**Companion helper in the same file.**
```ts
export function winProbsFromRunners(
  runners: Array<{ backDecimal?: number | null; layDecimal?: number | null; nonRunner?: boolean }>,
  opts?: { minCoverage?: number }
): { probs: number[]; indexes: number[] } | null;
```
- Per runner, prefer `trueProbabilityFromExchange(back, lay)` when both sides exist; fall back to
  `1 / lay` when only the lay is available.
- Normalise with `noVig()` from `src/lib/calc/ev.ts`. Note `noVig()` divides by the implied sum, so
  it already tolerates an **underround** book (a lay-only book sums below 1) — no change needed
  there, but assert it in a test so nobody "fixes" it later.
- Return `null` when fewer than `minCoverage` (default **0.9**) of active runners are priced,
  mirroring the 0.8 guard in `src/lib/racing/fair-odds.ts:26`. A partial book produces nonsense.

**Test vectors (hand-worked, in `finish-positions.test.ts`).**
- Three runners `p = [0.5, 0.3, 0.2]`:
  `P(A finishes 2nd) = 0.3·(0.5/0.7) + 0.2·(0.5/0.8) = 0.214285… + 0.125 = 0.339285…`
- Same field: `P(A finishes 1st) = 0.5` exactly (the model must reproduce the market at position 1).
- Invariants on a larger random-ish field: each **position column** sums to 1; each **runner's**
  positions sum to ≤ 1; every value is in `[0, 1]`.
- The dominant-favourite effect, asserted as a relationship not a magic number: hold one runner's
  `p` fixed at 0.12, and assert its `P(2nd)` is materially higher when the rest of the book is
  concentrated in a 1.5 favourite than when it is spread across a weak book.
- Field-size effect: the same `p_i` in an 8-runner field has a higher `P(2nd)+P(3rd)+P(4th)` than
  in a 16-runner field.
- `winProbsFromRunners` returns `null` below 90% coverage, and uses the back/lay midpoint when both
  sides exist.

**Guardrails.** This is probability, not money — floats are fine here. Any conversion of a
probability into pounds happens downstream in M2 and MUST use `src/lib/calc/money.ts`. Do not touch
`src/lib/calc/ep/engine.ts`.

## M2a. Target outcome + modelled trigger probability `[strong]` — /calc-change

**Objective.** Give an offer a machine-readable statement of what result it pays on, and use the M1
model to price it, without weakening a single existing test.

**Files.**
- NEW `src/lib/offers/target-outcome.ts`:
  ```ts
  export type TargetOutcome = { kind: "finish_positions"; positions: number[] };
  export function offerTargetOutcome(rules: BetGetFreePlaceRules): TargetOutcome;
  export function describeTargetOutcome(t: TargetOutcome): string; // "finishes 2nd, 3rd or 4th"
  ```
  `positions` comes straight from `rules.qualifyingPlaces`. This is the seam other sports extend by
  adding members to the union — do not build football members now.
- `src/lib/offers/place-refund-ev.ts`:
  - **KEEP `estimatePlaceRefundTriggerProb()` exactly as it is.** Its tests in
    `place-refund-ev.test.ts` must stay green and untouched. It becomes the documented degraded
    fallback for the free Racing API tier, where the price book is often too sparse for the model.
  - Add `triggerProbFromModel(positionProbs: number[], target: TargetOutcome): number` — sum the
    model's probabilities for the target positions.
  - `PlaceRefundEvInput` gains an optional `triggerProb?: number`. When supplied, use it; when
    absent, fall back to `estimatePlaceRefundTriggerProb()` as today. `PlaceRefundEvResult` gains
    `triggerBasis: "model" | "heuristic"` so the UI can badge honestly.

**Why the fallback is kept rather than replaced.** Two reasons, both hard rules: the calc guardrail
forbids weakening a passing test to make new code pass, and the free tier genuinely cannot price a
full book, so a graceful degradation path is required behaviour rather than a compromise.

**Acceptance.** Every existing `place-refund-ev.test.ts` assertion passes unmodified; new tests
cover `triggerProbFromModel` (positions `[2,3,4]` sums the right three columns), the
`triggerProb`-supplied path, and `triggerBasis` on both branches.

## M2b. The Offer Edge engine `[strong]`

**Objective.** NEW `src/lib/offers/offer-edge.ts` — for one offer and today's races, return the
ranked plays.

```ts
export interface OfferEdgePlay {
  offerId: number;
  raceExternalId: string;
  course: string;
  offTime: string;
  startTime: number;
  region?: string;
  fieldSize: number;
  runner: { horseId: string; name: string; backDecimal: number; layDecimal: number };
  triggerProb: number;
  triggerBasis: "model" | "heuristic";
  qualLoss: number;
  freeBetEv: number;
  totalEv: number;
  confidence: OfferConfidence;
  reasons: string[];
  warnings: string[];
}
export function buildOfferEdgePlays(
  offer: { id; rules: BetGetFreePlaceRules; bookmaker },
  races: RacingDeskRace[],
  opts: { date: string; retention: number; commission?: number; limit?: number }
): OfferEdgePlay[];
```

**Rules.**
- Only races passing the existing `raceQualifiesForOffer()` are considered. Reuse it, do not
  reimplement scope/region/min-runner matching.
- **Every** active runner is a candidate, including the favourite. The old `rank >= 2` exclusion is
  deleted: in a competitive handicap where the favourite is 6.0 and nothing else is under 8.0, the
  favourite frames often, wins rarely, and has the tightest spread, so it is frequently the best
  play. Let EV decide.
- Probability comes from the **exchange** book (M1's `winProbsFromRunners`). The **bookie** price is
  the back leg of the qualifying calc only. Where no bookie price exists (free tier), use the
  runner's resolved `bookieDecimal`; where that is absent too, skip the runner rather than invent.
- Rank by `totalEv` descending. Return the best runner per race, then the best `limit` races
  (default 5).
- Retention comes from A1's measured rate passed in by the caller, never hardcoded.
- Pounds via `src/lib/calc/money.ts`.

**Reasons (plain English, generated by inspecting model inputs — never by scoring).** British
English, sentence case, commas not em dashes. Examples of the vocabulary:
- `"Only 8 runners, the minimum this offer allows"` when `fieldSize` is at or within one of
  `rules.minRunners`.
- `"The 1.5 favourite should take the win"` when the favourite's modelled win probability is
  dominant.
- `"Field thins out sharply after 4th"` when the tail beyond the fourth-shortest carries little
  probability mass.
- `"Tight lay, qualifying costs 62p"` when `qualLoss` is small relative to stake.
Cap at three reasons per play so the UI line stays readable.

**Warnings (the execution-truth angle no competitor covers).**
- `"Exactly 8 runners, one non-runner and this offer no longer qualifies"` when
  `fieldSize === rules.minRunners`. This is the trap that costs real money: the field drops after
  you have already placed and the offer silently stops applying.
- `"Only £120 available at the lay price"` when `exchangeLaySize` is below the required lay stake.
- `"Prices are estimates, no live exchange match for this race"` when `exchangeSource !== "live"`.

**Acceptance.** `offer-edge.test.ts` with a constructed race fixture: the favourite CAN win the
ranking when the book justifies it; a race at exactly `minRunners` carries the non-runner warning;
a race below `minRunners` is excluded entirely; plays are ordered by `totalEv`; `triggerBasis`
degrades to `"heuristic"` when the book is too sparse for M1.

## M3. Three surfaces `[strong]`

Built-then-screenshotted, not mock-first (standing convention, see L2). Read
`docs/design-system.md` first. Design tokens only, no ad-hoc colours,
`formatClockTime`/`formatClockString` for every time of day.

**M3a — offer campaign card.** `src/components/offers/offer-campaign-card.tsx` gains an Edge panel
for `sport === "horse_racing"` + `offerType === "bet_get_free_place"` offers: the top three plays,
each showing time and course, the horse and its back price, `£EV`, the reason line and the
confidence chip. One click through to the race on the Racing Desk, one to the prefilled add-bet
dialog. Hidden entirely when there are no plays (do not render an empty shell).

**M3b — Do Next / Daily Plan.** `src/lib/offers/next-actions.ts`: the `place_qualifying` branch
currently emits the generic `"No bets linked yet - start the qualifying leg at Bet365."`. When an
edge play exists, it becomes specific: `"Chepstow 15:20, back Horse X at 6.5, EV +£12.40."`
`OfferNextAction` gains an optional `edge?: { raceExternalId; course; offTime; runnerName;
backDecimal; totalEv }` and `deriveOfferNextAction()` an optional `opts?: { edgePlay?: ... }` so
every existing call site and test compiles unchanged. Plays are computed in
`src/lib/services/state.ts` (which already builds Do Next) and threaded through.

**M3c — Racing Desk picks.** `src/components/racing/racing-intelligence-dialog.tsx`: "Race picks"
becomes offer-scoped and EV-ranked. The opaque 0–100 `Badge` is replaced by the reason line and
`£EV`; warnings render as a distinct, quieter line. The existing confidence filter pills and
Advanced switch stay.

**Acceptance for M3.** `npx vitest run` green; `npm run build` green; design-reviewer pass; every
new £ figure carries a basis/confidence indicator (hard rule since A2); no probability percentages
rendered anywhere in the UI.

## M3d. Racing Desk cohesion — workflow + markers `[strong]` ✅ DONE (2026-07-31)

**Objective.** Stop Offer Workflow disagreeing with Race picks. One play model (Offer Edge) drives
both; the desk visually separates **qualifying** (rules pass) from **recommended** (modelled EV).

**Why.** Workflow was still using heuristic `suggestedRunners[0]` (ranks 2–5 only) while Race picks
used `edge.runner` (favourite allowed). Green tab/course counters read as "must bet" when they
only meant "qualifies." Sam asked (2026-07-31) for a cohesive desk: workflow shows the recommended
play + EV; markers and a COURSES legend make the colour language explicit.

**Files.**
- `src/lib/racing/offer-tags.ts` (+ tests) — `edgePlayForRaceOffer`, `offerTagDisplayEv`,
  `countRecommendedRaces`, `countRecommendedOffersOnRace`; `qualifyingOfferTags` / `findOfferTag`
  prefer Edge EV when plays are supplied.
- `src/components/racing/racing-offer-guide.tsx` — Recommended / Estimate / Qualifies guidance
  from `edgePlays`; Back/Lay target `edge.runner`; MoneyFlow EV + confidence + reasons/warnings.
- `src/components/racing/flashscore-racecard.tsx` — pass `edgePlays`; race-tab emerald = qualifies,
  warning+sparkles = recommended count; runner row "recommended" badge for Edge horses.
- `src/components/racing/racing-desk-view.tsx` — course pills mirror the same two markers; COURSES
  legend (qualifies / recommended / near-min dots).

**Rules.**
- Heuristic `suggestedRunners` / `offerTargetScore` are fallback only, labelled Estimate — never
  silently override an Edge play.
- Near-min bookie-coloured dots stay (NR trap); they are not "recommended."
- Recommended chrome uses `--edge` (violet), never `--warning` (amber = caution only). See D5.
- No probability percentages in the UI (M3 acceptance still holds).

**Acceptance.** Workflow Back horse matches Race picks for the same race+offer when an Edge play
exists; legend present under Courses; `offer-tags` tests cover Edge sort preference;
`npx vitest run src/lib/racing/offer-tags.test.ts` green.

---

# PHASE — MONETISATION SCAFFOLDING (gated)

> Do **not** start N0 billing/auth work until D1 gate criteria in `product-roadmap.md` §7.1 are met.
> The matrix + preview switch may ship earlier as personal product-design scaffolding if Sam asks.

## N0. Entitlement scaffolding (Free / Core / Edge) `[strong]` ⏸ GATED

**Objective.** Make the §7.5 tier split *real in code* as a feature-entitlement matrix, with Edge
chrome (`--edge`) reserved for Edge-tier capabilities, without building multi-tenant SaaS yet.

**Why now (document, measure readiness).** As of 2026-07-31 the app is a single unlocked local
install: every desk, Offer Edge, and live feed path is available once env keys exist. We cannot
"sell Core vs Edge" today. We *can* define what each tier includes, wire `can(feature)` checks,
and optionally preview the locked UX. Auth + Stripe wait for the business gate (D1).

**Readiness today**

| Layer | Status | Notes |
|-------|--------|-------|
| Product features (calcs, offers, tracker, Offer Edge engine) | ✅ Built | One binary; no plan check |
| Visual signature for Edge (`--edge` violet) | ✅ Built (D5) | Race picks, recommended markers, Best plays, Do Next edge line |
| Feature entitlement matrix | ❌ Missing | No `PlanId` / `entitlements.ts` |
| UI lock / upgrade prompts | ❌ Missing | Nothing is gated |
| Settings "preview as Free/Core/Edge" | ❌ Missing | Useful pre-gate for Sam |
| Auth / accounts / multi-tenant data | ❌ Deferred (D1) | Local-first single user |
| Billing (Stripe) | ❌ Deferred (D1) | No customer identity yet |
| Per-subscriber API keys / pooled feeds | ❌ Deferred | See `docs/api-dependencies-and-tiers.md` |

**Proposed entitlement matrix (v1 draft — confirm with Sam before coding)**

| Capability | Free | Core | Edge |
|------------|------|------|------|
| Calculators + manual bet log | ✓ | ✓ | ✓ |
| Demo Racing Desk / demo data | ✓ | ✓ | ✓ |
| Offers pipeline, tracker, free-bet lots | | ✓ | ✓ |
| Do Next / Daily Plan / Edge Report / EV analytics | | ✓ | ✓ |
| Acca Desk + offer → Acca qualifier routing (L4) | | ✓ | ✓ |
| Offer Edge model + Race picks + recommended desk chrome | | | ✓ |
| Live/delayed Racing Desk feeds (when keys present) | | | ✓ |
| 2UP sentinel + web push | | | ✓ |
| Exchange lay integration on desk | | | ✓ |

Core must remain useful without feeds. Edge is where API cost and modelled picks live.

**Files (when unblocked).**
- NEW `src/lib/entitlements/plans.ts` — `PlanId = "free" | "core" | "edge"`,
  `ENTITLEMENTS: Record<PlanId, FeatureFlag[]>`, `can(plan, feature): boolean`.
- NEW `src/lib/entitlements/features.ts` — string union of feature ids
  (`offer_edge`, `racing_live_feeds`, `push_alerts`, `do_next`, …).
- `src/lib/services/settings-shared.ts` + settings API — `planPreview?: PlanId | "unlocked"`
  (default `"unlocked"` for Sam's daily use). Persist in `app_settings`.
- Thin wrappers at UI entry points (not deep in calc): Race picks trigger, Offer Edge panel,
  recommended markers, push settings — if `!can(plan, feature)` show a compact Edge lock
  using `--edge` chrome + one-line "Edge plan" copy (no fake paywall animation).
- Do **not** put entitlement checks inside `src/lib/calc/**` or settlement.

**Out of scope for N0.** Stripe Checkout, webhooks, user accounts, cloud DB, per-user API key
vaults, oddsmatcher. Those are post-gate (§7.2–7.6).

**Acceptance (scaffolding slice).**
1. Matrix + `can()` unit tests for every feature id.
2. With `planPreview: "free"`, Race picks / Offer Edge panel / recommended pills hide or show
   the Edge lock; calcs still work.
3. With `planPreview: "unlocked"` (default), behaviour identical to today.
4. Design-system: lock chrome uses `--edge`, never `--warning`.
5. `npx vitest run` green; no auth dependency.

**Sizing note.** Full Stripe path is a later brief (N1+) after D1. Do not merge N0 and billing.

---

# PHASE — ACCA OFFER BRIDGE

## L4. Offer qualifier shape → Acca Desk routing `[strong]` (Sam 2026-08-05)

**Objective.** Persist whether a campaign’s qualifying stake must be placed as a **single**,
**acca**, or (later) **bet builder**, and when the user hits Place qualifying bet on an
acca-shaped offer, open Acca Desk’s **New run** as a global dialog (same pattern as Add bet),
prefilled from the offer. Non-entitled users fall back to the standard Add bet modal.

**Why.** Today “Bet £20 ACCA get £10 free bet” only encodes ACCA in the title string.
`deriveTrackBetAction` always returns an `AddBetPrefill`, so Do Next / Offer view assume a
single matched-bet workflow. Acca Desk already exists (`/acca`, `accaRuns.offerId` nullable
FK, create API accepts `offerId`) but nothing opens it from an offer. Paste intelligence
already detects `multisOnly` / `minSelections` and folds them into free-text notes only.

**Product decisions (locked 2026-08-05).**
1. Structured **Qualifier shape** on the offer (`single` | `acca` | `bet_builder`) in Important
   terms + editor; paste-intelligence pre-suggests `acca` when it detects ACCA / multis /
   min selections.
2. Pro path opens Acca **New run** as a **global dialog** from wherever the user is (like Add
   bet), linked to the offer, no forced navigation to `/acca`.

**Verified shapes (2026-08-05).**
- `PromoTermsRules` / Important terms: `minOdds`, `minStake`, `maxStake`, `importantNotes` in
  `src/lib/offers/offer-terms.ts` — no bet-shape field yet.
- Routing: `deriveTrackBetAction` → `TrackBetAction { prefill: AddBetPrefill | null }` in
  `src/lib/offers/offer-track-bet.ts`; callers `offer-view-dialog.tsx` (and any other Place
  qualifying CTAs) call `openAddBet(trackBet.prefill)`.
- Acca create: `CreateRunDialog` / `CreateRunForm` local to `src/app/acca/page.tsx`; POST
  `/api/acca` already accepts `offerId` but the form never sends it.
- Pro gating: cosmetic `pro: true` on nav Live desks only (`app-nav.tsx`). No `can()` yet;
  N0 is gated. Acca Desk is fully reachable today for everyone.

### Data model (no new DB columns)

Extend Important / promo rules JSON (same `offers.rules` blob; racing merge keeps working):

```ts
export type QualifierShape = "single" | "acca" | "bet_builder";

// on OfferImportantTerms + PromoTermsRules (+ racing merge keys):
qualifierShape?: QualifierShape; // default "single" when absent
minSelections?: number | null;   // persist what paste already extracts
```

Defaults: missing / legacy offers → `single` (current behaviour). Read/write via
`readImportantTerms` / `buildPromoTermsRules` / `mergeImportantIntoRacingRules` /
`emptyImportantTerms`. Offer create/update APIs already pass `rules` through; no schema
migration beyond existing JSON.

### Capture UI

In `src/components/offers/offer-editor-form.tsx` Important section (amber “don’t forget”):
- Segmented or select control: **Single** | **Acca** | **Bet builder**.
- When Acca or Bet builder: show **Min selections** number input (optional; prefill from paste).
- Existing min odds / min–max stake stay; they become guidance on the Acca create dialog.

Paste path (`enrichImportantTerms` / `applyPasteDraft`):
- If `signals.multisOnly` OR `signals.minSelections != null` OR title/text matches
  `/\bacca\b|\baccumulator\b/i` (extend signals if needed): set `qualifierShape: "acca"`.
- Copy `signals.minSelections` onto `important.minSelections`.
- User can still override in the editor before save.
- Do **not** auto-set from archetype `acca_insurance` alone (that is refund structure, not
  always “must be an acca qualifier” for bet&get shapes) unless multis/acca text also matches.

### Routing

Widen `TrackBetAction` to a discriminated destination:

```ts
type TrackBetDestination =
  | { kind: "add_bet"; prefill: AddBetPrefill }
  | { kind: "acca_desk"; prefill: AccaRunPrefill }
  | { kind: "none" };

// AccaRunPrefill: offerId, label, stake, bookmaker, minOdds?, minSelections?,
// importantNotes?, suggestedMethod? ("sequential" default)
```

Rules inside `deriveTrackBetAction` (keep enable/disable pipeline logic unchanged):
1. If step is **convert free bet** (`free_snr`) → always `add_bet` (conversion stays Add bet).
2. If step is **place qualifying** (or start_planned / review_expiry with no bets) AND
   `qualifierShape === "acca"` AND `canUseAccaDesk(settings)` → `acca_desk`.
3. If `qualifierShape === "bet_builder"` → `add_bet` for v1 (no Bet Builder desk yet); CTA
   label can stay “Place qualifying bet”; optional one-line reason later, not blocking.
4. Otherwise → `add_bet` as today.
5. If shape is `acca` but `!canUseAccaDesk` → `add_bet` fallback (Sam: non-pro uses Add bet).

Call sites that must branch on `destination.kind`:
- `src/components/offers/offer-view-dialog.tsx` (primary).
- Any Do Next / campaign card path that currently opens Add bet for qualifying (audit
  `dashboard-do-next.tsx` — today it often opens the offer view first; if any path calls
  `openAddBet` with offer qualifying prefill directly, route there too).

CTA copy when destination is Acca: prefer **“Open Acca Desk”** or keep “Place qualifying bet”
with Acca secondary hint — use **“Build acca”** when enabled Acca path (clearer). Disabled
reasons unchanged.

### Global Acca create provider (2B)

Mirror `AddBetProvider`:
- NEW `src/components/acca-run-provider.tsx` + extract `CreateRunForm` (and shared types) from
  `src/app/acca/page.tsx` into e.g. `src/components/acca/create-run-dialog.tsx` so `/acca`
  “New run” and the global opener share one form.
- `openAccaRun(prefill?: AccaRunPrefill)` mounts the dialog app-wide; register provider next to
  `AddBetProvider` in `src/app/layout.tsx`.
- Prefill behaviour:
  - `label` ← offer title (or “Qualify · {bookie}”).
  - `stake` ← same stake resolution as track-bet (`offerBetPrefs` / minStake / default).
  - `bookmaker` ← offer bookmaker / prefs.
  - `offerId` ← offer.id (POST must send it — wire into `CreateRunForm` save payload).
  - Legs: seed `max(minSelections ?? 3, 2)` empty leg rows (user fills odds/labels).
  - Show a compact **Offer requirements** strip above the form: min odds, min/max stake,
    min selections, truncated important notes (read-only guidance, not hard validation v1).
- On success: toast as today; `refresh()` app state; dialog closes. User can continue on Acca
  Desk via nav if they want lays; no forced redirect.

### Thin entitlement stub (before full N0)

Do **not** unblock full N0. Ship the smallest hook so routing is real:

- NEW `src/lib/entitlements/acca-desk.ts` (or under a tiny `features.ts`):
  `canUseAccaDesk(settings): boolean`.
- Default: **true** when `planPreview` is absent / `"unlocked"` (preserves today’s open Acca
  Desk). False only when a future/settings preview is `"free"` (or whatever N0 matrix says
  Acca is Core+).
- Optional Settings “Preview as Free” can wait for N0; if adding a flag now, keep it off by
  default and document that Acca offer routing uses the same switch.
- When N0 lands: fold `acca_desk` into the matrix; delete the one-off helper or re-export
  `can(plan, "acca_desk")`.

Update N0 matrix draft row when convenient: Acca Desk = Core+ (Live desks “Pro” tag).

### Tests

- `offer-terms` / rules round-trip: `qualifierShape`, `minSelections`.
- `deriveTrackBetAction`: single → add_bet; acca + can → acca_desk; acca + !can → add_bet;
  free_snr on acca offer → add_bet; bet_builder → add_bet.
- Paste/intelligence: sample “Bet £20 ACCA get £10 free bet” + min 3 selections → suggests
  `acca` + `minSelections: 3`.
- Acca create payload includes `offerId` when prefilled (service or form unit where easy).

### Out of scope

- Bet Builder desk / routing (enum + editor only).
- Hard-enforcing min odds / stake / selection count on save.
- Auto-creating legs from fixtures.
- Full N0 / Stripe / paywall chrome beyond the thin `canUseAccaDesk` stub.
- Changing Acca calc / settlement (`/calc-change` not required).

### Acceptance

1. New/edited offer can set Qualifier shape Acca; value persists in `rules` and reloads in editor.
2. Paste of an ACCA bet&get offer suggests Acca + min selections when text supports it.
3. Place qualifying / Build acca on an Acca-shaped offer (entitled) opens global New run dialog
   with stake, bookie, offerId, requirements strip; creating the run links `accaRuns.offerId`
   and logs the back bet as today.
4. Same CTA when not entitled opens Add bet with existing qualifying prefill.
5. Free-bet convert on that offer still opens Add bet.
6. Bet builder shape saves but still opens Add bet.
7. `/acca` New run still works (shared form); standalone create without offerId unchanged.
8. `npx vitest run` green; design-reviewer on Important section + Acca create prefill strip.

**Sizing.** `[strong]` — rules shape, track-bet API change, provider extract, multi-surface
CTA. Grok/Composer fine; no calc audit. Depends on J7 (Acca Desk exists). Soft-depends on N0
for real paywall; ships with unlocked default.

---

```
A1 ──► A2 ──► A3 ──► B7 ──► B8
 │      │      │
 └──────┴──► A4 (hero)          A5 (independent)
B1 ◄─ offer-calendar (exists)   B2, B3 (independent, after A1 sig change)
B4 ──► C3                       B10 (independent audit)
C4 (AlertChannel) ──► B5, B6    C1 ──► C2
B9 (after A1; feeds advantage scoring)
```

## Standing acceptance bar for every brief

1. `npx vitest run` fully green (currently 445/445 — new code adds tests, breaks none).
2. `npm run build` green.
3. Times rendered via `time-format.ts`; money/idiom consistent with neighbours.
4. New EV figures ALWAYS carry a basis (post-A2 this is a hard rule).
5. Nothing auto-places bets, auto-marks account health, or silently mutates a lock/snapshot.
6. Commit messages follow repo style (`feat:`/`fix:`/`test:`); push only to
   `Edgeways-MB/Edgeways`.
