# EdgeDesk — Matched Betting Command Centre

> Working title. A Mac-local, real-time matched betting toolkit: calculators, profit tracking,
> live events and a live P&L dashboard — with the user's **Edge** surfaced everywhere.

## Product principles

1. **Result-centric, not bet-centric.** You record what happened in the real world (a 2-1 score),
   and the app derives every market outcome from it (BTTS = Yes, Over 2.5 = No, Home Win, 2UP
   triggered…) and settles all linked bets automatically.
2. **Edge everywhere.** Every calculator and every tracked bet shows implied probability, fair
   (no-vig) odds, expected value and edge % against the exchange, so the user always knows where
   their advantage lives.
3. **Live by default, manual as fallback.** Events come from live APIs where possible; anything
   the APIs can't cover degrades gracefully to manual entry, never blocking the workflow.

## Architecture (decided)

| Concern | Choice | Why |
|---|---|---|
| Platform | **Next.js web app run locally** | shadcn/ui, NumberFlow and Liveline are all React. Server routes proxy sports APIs (keys stay server-side, no CORS pain). Can be wrapped in **Tauri** later for a real `.app`, or deployed as a web product — no rework either way. |
| UI kit | **shadcn/ui**, blue primary | Per spec; single source of styling truth for MVP, full design system later. |
| Numbers | **@number-flow/react** | All changing monetary/odds values animate through NumberFlow. |
| Live charts | **liveline** | Dashboard P&L line, per-event live position charts. |
| Persistence | **SQLite (better-sqlite3 + Drizzle)** | Durable local file (`data/edgedesk.db`) — profit history is money, browser storage isn't good enough. |
| Football data | **API-Football** (free tier: 100 req/day → £15/mo for real use) | Live scores every 15s, fixtures, 1,200+ leagues. |
| Horse racing | **TheRacingAPI** free tier (racecards) — results manual in MVP | Live racing results need a paid tier; Phase 2. |
| Demo/testing | **Built-in match simulator** | Full live experience (2-0 → 2-2 swings) with zero API keys. |

## MVP (this build)

### Calculators (the most-used core set)
- **Matched Betting calculator** — qualifying bet / free bet SNR / free bet SR / risk-free,
  lay stake, liability, profit both sides, overlay/underlay.
- **Dutching calculator** — n-way equal-profit dutch, with **Early Payout (2UP) dutch mode**.
- **Early Payout (2UP) calculator** — back/lay with early-payout windfall scenario matrix.
- **Each Way calculator** — EW back vs win+place lays, configurable EW terms.
- **Odds converter** — decimal ↔ fractional ↔ american ↔ implied probability.
- **EV / Edge calculator** — expected value, edge %, fair odds via no-vig from exchange odds.

### Live features (the three pillars)
1. **Event selection** — browse today's/upcoming football fixtures from API-Football,
   attach them to tracked bets in one click; manual event creation for anything else.
2. **Result monitoring** — poll live scores during match windows; score changes drive the
   settlement engine (score → derived markets → auto-settle linked bets). Manual result
   entry as fallback (racing, unsupported markets).
3. **Live dashboard** — Liveline chart of running P&L where open live positions contribute
   their *current provisional* value in real time (the £7,000 + 2UP £250 scenario),
   NumberFlow stat cards, live event scoreboard strip.

### Profit tracker
- Bet log (single back/lay, dutch multi-leg) linked to events, markets and selections.
- Auto-settlement from results; manual settle/void always available.
- Running totals, monthly breakdown, per-bookmaker P&L.

## Phase 2 (planned next)
- Sequential lay, Multi-lay, Unwanted lay calculators.
- Accumulator + multiples family (Lucky 15/31/63, Yankee, Heinz, Patent, Trixie, Goliath…).
- Arbitrage, Kelly criterion, Rule 4, Racing refund, Refund-if, Enhanced offers,
  Exchange bonus lock-in, Asian handicap, Sporting Index.
- Horse racing live results (TheRacingAPI paid tier) + racecard event selection.
- Live in-play probability model (goals → win prob → live EV on open positions).
- Tauri packaging → signed macOS `.app`.
- Full design system pass (typography, spacing, dark-mode-first polish).

## Phase 3 (ideas)
- Odds screen / auto-matcher (bookie vs exchange odds feeds).
- Offer calendar & reminders; bankroll spread across bookies/exchanges.
- Cloud sync / multi-device; iOS companion.

## Data model (MVP)

- `events` — sport, teams, kickoff, status, live score, minute, source (api | manual | sim).
- `bets` — event link, market (`match_odds` | `btts` | `over_under_2_5` | `two_up` | `other`),
  selection, bet type (qualifying | free bet SNR/SR | risk-free | dutch | lay only),
  stakes/odds/commission, legs JSON for dutches, status, expected vs actual profit.

## Settlement logic (result-centric)

From a final (or live) score the engine derives: Home/Draw/Away, BTTS, Over/Under 2.5,
and 2UP-triggered (either side led by 2 at any point — tracked from live score progression).
Each derived outcome settles matching open bets: bookie side, exchange side, commission,
early-payout windfalls.
