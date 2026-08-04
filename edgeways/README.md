# Edgeways - Matched Betting Command Centre

Local-first matched betting toolkit: calculators, live events, result-driven auto-settlement
and a real-time P&L dashboard. See `PLAN.md` for the full MVP scope and phased roadmap.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

`npm run dev` is supervised (`scripts/dev-keep.mjs`): if Next.js exits after a
memory-threshold restart or a stray kill, it comes back automatically. Prefer a
**Terminal / Cursor tab you own**, not an agent-started shell (those get cleaned
up and take the site down).

For a session that survives closing the launching terminal:

```bash
npm run dev:detached
```

Log: `data/dev-keep.log`. One-shot without the supervisor: `npm run dev:once`.

## Live football data (optional)

Without a key the app runs on demo fixtures plus the built-in match simulator
(Events → Simulate match), which plays a full 90 minutes in ~3 real minutes -
including the classic 2UP scenario (2-0 up, pegged back to 2-2).

### Free tier setup (API-Football)

1. Sign up at [dashboard.api-football.com](https://dashboard.api-football.com/register) -
   the **Free plan** needs no card and gives **100 requests/day** with live scores for
   1,100+ competitions.
2. Copy your key from the dashboard (Account → My Access).
3. `cp .env.example .env.local`, paste it as `API_FOOTBALL_KEY=...`, restart the dev server.

The app manages the 100/day allowance for you: fixture lists cache for 10 minutes, live
scores poll at most once per 60 seconds *and only while a tracked event is in play*, and a
built-in budget guard stops all API calls at 95 requests/day rather than erroring at the cap.
Practically that means **one live-tracked match per day** fits the free tier (a 90-minute
match ≈ 90 polls). Track two matches in the same window and they share the same polls, so
simultaneous kickoffs are fine; back-to-back matches will run the budget out.

If you outgrow it, the Pro tier (~$19/mo, 7,500 req/day) removes the constraint without any
code changes. Alternative free option: [football-data.org](https://www.football-data.org)
(10 req/min free, forever) - better rate limits but only ~a dozen major competitions and
no lower-league coverage; the app would need a second client written for it, so start with
API-Football.

## The 60-second demo loop

1. **Events** → *Simulate match* → "2UP drama" → Kick off.
2. **Calculators** → *Dutching* → *2UP early payout dutch* → Add to profit tracker.
3. **Tracker** → link the new bet to the simulated event (Link event dropdown).
4. **Live Dashboard** → watch the Liveline chart and provisional P&L move as the goals go in,
   and the windfall settle automatically at full time.

With an API key, steps 1–3 collapse into one: the EP Edge Desk and 2UP calculators'
"Add to tracker" find-or-create the real fixture and link the bet automatically.

## Advanced lay mode (part lays + underlay/overlay)

The Matched Betting Calculator and Tracker → Add bet both have an **Advanced** switch on
the lay side. It adds:

- **Part lays** - record lays already matched at other prices; the app solves the
  *remaining* lay stake at current odds and collapses the whole position into one
  equivalent lay for tracking.
- **Underlay / Standard / Overlay** - quick-snap buttons plus a slider (with editable
  min/max). *Underlay* solves for £0.00 net if the bookie bet loses (all profit rides on
  the bookie win - the boosted-odds play); *Overlay* solves for £0.00 if the bookie bet
  wins. Rounded to the penny, so the "no loss" side may land at ±£0.01.

The Add bet form defaults to **Betdaq** (0% commission); pick any exchange from the
dropdown - commission shows beside the label and the inputs re-skin in that exchange's
colours. Exchanges and rates are managed in Settings.

## Live Dashboard History feed

A Flashscore-style commentary column next to Live positions: kick-offs, every goal (scorer,
minute, running score, 1st-goalscorer and own-goal flags), 2UP triggers, full-time results -
and when a bet settles and leaves Live positions, its realised P&L lands here highlighted
green or red.

## "The bet wins IF …" triggers

Bets whose outcome isn't a simple score market (boosted first-goalscorer offers, player
props, combos) can carry a plain-English trigger. In **Tracker → Add bet**, type the
condition under *The bet wins IF* - e.g.

- `Harry Kane scores first` · `Kane scores a brace` · `last goalscorer Kane`
- `Mexico wins to nil` · `England scores first` · `over 2.5 goals` · `BTTS` · `2-1`
- Combos: `Harry Kane scores first and England wins`

The interpretation is shown back to you instantly (green tick = understood). Once the bet
is linked to an event, the trigger engine watches the goal timeline and settles the bet
**the moment the outcome is irreversible** - a first-goalscorer bet wins or dies at the
first goal, not at full time. Underlays behave exactly as expected: bookie win pays out,
bookie loss nets ~£0.

Goal timelines come from three places:

- **API events** - scorer feed from API-Football (`/fixtures/events`, one request per
  poll, only spent when a live match actually has an open player trigger on it).
- **Simulations** - name a "star striker" when kicking off a sim and they score their
  side's first goal, perfect for testing a goalscorer trigger end to end.
- **Manual events** - use the *Goal* button on the Events page to record scorer names.

Unrecognised phrasing is kept as a note and the bet just falls back to manual settlement -
a trigger can never mis-settle on a condition it didn't understand.

## Stack

- Next.js (App Router) + TypeScript
- shadcn/ui (blue primary) · [NumberFlow](https://number-flow.barvian.me) for every changing number ·
  [Liveline](https://benji.org/liveline) for live charts
- SQLite via better-sqlite3 + Drizzle - your data stays in `data/edgeways.db`
- Calculation engine: pure TypeScript in `src/lib/calc`, unit-tested with Vitest (`npm test`)

## Tests

```bash
npx vitest run
```
