# EdgeDesk Implementation Briefs

> **How to use this document.** Each brief below is a self-contained work order for a developer or
> AI coding agent. Briefs assume NO memory of prior conversations — everything needed is stated.
> They map 1:1 to the features in `docs/roadmap/product-roadmap.md` (IDs A1–A5, B1–B10, C1–C4)
> and are grouped by roadmap phase. Do briefs in order within a phase; cross-brief dependencies
> are called out explicitly.
>
> **Sizing tags:** `[local]` = suits a small local model (pure functions, isolated UI, strong
> existing test coverage). `[strong]` = use a stronger agent (schema, cross-cutting, or judgment-
> heavy). `[design-first]` = wait for a mock/wireframe from Sam before building UI.

Last updated: 2026-07-16 (Phase 11 added — J1–J9 execution-edge briefs, three waves)

---

## 0. Repo conventions every agent must know

- **Git root is the PARENT directory** `MB app build/`, not `edgedesk/`. Git paths are prefixed
  `edgedesk/`. Run all npm commands from `edgedesk/`.
- **This is Next.js 16** — APIs may differ from training data. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing App Router / server code (per `AGENTS.md`).
- **Tests:** `npx vitest run` from `edgedesk/`. 697 tests / 94 files must stay green.
  `vitest.setup.ts` gives each test process an isolated temp SQLite DB via `EDGEDESK_DB_PATH`.
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
    `src/lib/services/balances.ts` (`ledgerBetSettlement`, `ledgerPromoAward`, …).

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
> EdgeDesk is open on any device, including the installed PWA. TRUE background push (app
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
`edgedesk-backup-YYYY-MM-DD.db`; `?format=json` returns a versioned JSON bundle (app version,
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

**Objective.** Sentinel alerts reach the phone with every EdgeDesk tab closed. Dependencies
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
`data/edgedesk-demo.db` when a `data/demo-mode` marker exists (EDGEDESK_DB_PATH still wins, so
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
Casino money stays OUT of matched P&L surfaces (separate desk, separate truth) — a
follow-up decides any combined view.

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

## J6. Offer email ingestion `[strong]` (W2) — staged — 🔶 STAGE 1 DONE 2026-07-16

Stage 1 shipped: hand-rolled MIME-lite (`parse-email.ts` — multipart walk, plain-preferred,
QP/base64, RFC2047 subjects, HTML→text; no new dependency needed) feeding the existing
PasteCapture drop zone (.eml drops and Choose files; casino dialog inherits). Sam approved
`imapflow` for stage 2 on 2026-07-16 — build next.

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
account), folder name (default "EdgeDesk"). A poll (60s×N backoff, only while desk open —
same compute-on-poll idiom as H1) fetches UNSEEN messages, runs stage-1 parsing, creates
PLANNED offers tagged `source='email'` with an inbox alert "3 offers arrived by email —
review". Never auto-activates: drafts require human review (planned status IS the review
queue). Dependency to flag at build time: `imapflow`.

**Acceptance.** Stage 1: fixture-tested parser; harness: drop .eml → preview → offer
created. Stage 2: mock-IMAP test for the fetch→draft path; drafts land planned + alert.

## J7. Acca desk — leg-by-leg lay workflow `[strong]` (W3, biggest)

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

## J8. Household account sets `[strong]` (W3)

**Objective.** Track a partner's separately-operated accounts as a tagged second set:
`accounts.owner` (additive column, default 'me'), owner filter on Accounts/Tracker/League/
Reports, per-owner P&L split, combined by default.

**Why.** Long-standing community practice the incumbents support. **Compliance framing
(standing):** copy always says "accounts operated by their owner" — EdgeDesk tracks, never
encourages operating someone else's accounts.

**How.** Additive `accounts.owner TEXT DEFAULT 'me'` + owners list in settings (names);
bets/offers inherit owner via bookmaker→account mapping at analytics time (no bet-level
column — an account belongs to one owner). Surfaces: owner chip filter (Accounts, league,
Edge Report, season summary); balances top-bar shows combined with per-owner popover.
Do Next unaffected v1 (single plan). Migration: everything existing = 'me'.

**Acceptance.** Analytics split tests (owner A vs B vs combined reconcile to totals);
harness: tag an account, filters split correctly; copy review for framing.

## J9. Betslip prefill extension `[strong]` (W3, last — new surface)

**Objective.** A Chrome (MV3) extension: one click in EdgeDesk copies a structured intent →
the extension fills the betslip (selection search + stake) on the exchange tab. Betfair
exchange first; bookies later. Execution automation, zero odds scraping (D2 intact).

**Why.** Betwatch proves the pattern. Cuts the most error-prone manual step (fat-fingered
lay stakes) — directly serves "am I executing correctly?".

**How (size carefully — new package).** `extension/` workspace (plain MV3, no build deps if
possible): content script for betfair.com that finds the market view and fills
selection/stake from a payload received via `chrome.runtime` messaging; EdgeDesk page emits
via a custom DOM event the extension listens for (localhost + tailscale origins). Fill only
— NEVER auto-place; the user always clicks the exchange's own confirm. Fragile-selector
risk: version the selector map, fail loud with a toast fallback ("couldn't find the slip —
stake copied to clipboard" as the graceful degrade). EdgeDesk side: "Fill slip" buttons on
matched calculator + lock-in dialog + acca lay-due rows.

**Acceptance.** Manual harness protocol (extension loaded unpacked, drive a Betfair market
page in the harness Chrome with a stubbed page fixture for CI-less testing); clipboard
fallback tested; docs page "Install the extension".

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
   `EdgeDesk-MB/EdgeDesk`.
