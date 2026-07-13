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

Last updated: 2026-07-13 (A3 done — Phase 1 complete)

---

## 0. Repo conventions every agent must know

- **Git root is the PARENT directory** `MB app build/`, not `edgedesk/`. Git paths are prefixed
  `edgedesk/`. Run all npm commands from `edgedesk/`.
- **This is Next.js 16** — APIs may differ from training data. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing App Router / server code (per `AGENTS.md`).
- **Tests:** `npx vitest run` from `edgedesk/`. 486 tests / 68 files must stay green.
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

## C2. Progressive disclosure audit `[local]` (mechanical, given C1)

Every dashboard/desk card gets a collapsed `< sm` variant: headline stat + one line, expand in
place. Racing Desk mobile default = race strip + suggested races + workflow steps
(`racing-offer-guide.tsx`); full runner grid behind a tap. Tables → card lists at `< sm`
(tracker, history — partially done; finish and make consistent).

## C3. Quick-log sheet `[strong]` — needs B4

Floating "+" on mobile (add to `src/components/app-nav.tsx` mobile chrome) → bottom sheet with
three paths: Paste slip (B4), From plan (today's B1 slots → one-tap "placed"), Minimal manual
(bookie/stake/odds only). Writes flag the bet `quick-logged` (new nullable text column
`quick_logged` on `bets` per §0 additive-column pattern, or reuse `notes` marker — decide with
Sam; column preferred for querying). Desktop tracker shows a "review quick-logged" filter chip.
**Mobile captures, desktop curates** — the sheet never demands full data.

## C4. PWA + local alerts `[strong]`

Manifest + service worker (read Next 16 PWA guidance in `node_modules/next/dist/docs/` first —
conventions may differ from training data). iOS install prompt on first mobile visit
(dismissible, once). Alert scheduler v1 is LOCAL (single-user): a client module watching app
state, firing Notification API notifications, each type toggleable in Settings:
offer-expiring-with-EV, race-off-time-approaching-with-unfinished-workflow, result-settled.
Define `interface AlertChannel { notify(alert: EdgeAlert): void }` so Phase-4 push and any
future server backend swap in without touching alert-rule logic.

---

# PHASE 4 — GUARDIAN

## B5. Naked-exposure sentinel `[strong]` — after C4's AlertChannel

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

## B6. Live 2UP sentinel `[strong]` — after C4

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

## B7. Mistake ledger `[strong]` — needs A3

When a settled offer's capture < 90%, offer one-tap tags on the post-mortem line:
`laid_late | wrong_market | odds_moved | bookie_voided | other`. Store on the EV snapshot row
(new nullable `mistake_tag TEXT` via additive column). Aggregation pure lib
`src/lib/offers/mistakes.ts`: £ lost per tag per month (`expected - realized` summed by tag).
Surface inside B8's report. Never force tagging — skippable, editable later from offer detail.

## B8. Monthly Edge Report `[strong]` `[design-first]` — needs A3, A1; B7 enriches

NEW route `src/app/report/page.tsx` + pure lib `src/lib/report/edge-report.ts`:
`buildEdgeReport(snapshots, bets, month): { cumulative: { t, expected, realized }[]; captureRate;
retentionTrend; commissionDrag; realizedPerHour?; mistakes? }`. The chart is THE product chart:
cumulative expected (from A3 locks, at lock time) vs cumulative realized (at settle time) —
follow `live-pnl-chart.tsx` charting idiom (Liveline). Months with < 5 settled campaigns render
a "not enough data" state, not noisy lines.

## B9. Bookmaker league table + account health `[strong]`

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

## Dependency graph (build order within/across phases)

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
