# API Dependencies & Feature Tiers

Edgeways runs **local-first**: calculators, tracker, offers, and settlement logic work without any external APIs. Optional integrations unlock live data and automation.

Last updated: July 2026.

**Personal-use default: stay on free tiers (£0/mo).** Paid APIs are optional time-savers, not requirements. If you later sell subscriptions, price plans so *subscriber* API usage is covered by revenue - never by your personal free keys.

---

## How often free-tier data updates

Provider publish rates vs what Edgeways actually polls (we cache to protect free budgets):

| Source | Provider updates | Edgeways refresh | Notes |
|--------|------------------|------------------|-------|
| **Racing API Free** - racecards | Today ~every **3 min**; tomorrow ~every **15 min** (provider) | Cached **15 min** in-app; Racing Desk UI reloads every **60 s** (uses cache) | Non-runners / going changes can lag up to ~15 min in Edgeways |
| **Racing API Basic** - results | Today results ~every **3 min** (provider) | Idle cache **5 min**; open-bet / incomplete sync uses **90 s** | Free tier: no results - use Set winner. Winner-only payloads settle win markets; place/EW wait for fuller placings |
| **Betfair delayed key** | Exchange prices **~1–3 min behind** live | Fetched when Racing Desk loads / refreshes | Fine for pre-race matched betting; not for tight in-play |
| **API-Football Free** - fixtures list | Live scores continuous | Fixtures cached **10 min**; live scores **~60 s** | Budget ~**95 req/day** in-app (headroom under 100) ≈ **1 live match/day** |
| **App dashboard / Tracked Events** | - | Poll every **3 s** (Settings → Preferences) | Reuses caches above; does not burn a new API call every 3 s |
| **Manual odds paste** | You | Instant | Best Free-tier bookie price source |

**Practical takeaway:** leave Edgeways open during racing/football sessions. Closing the tab pauses auto sync (no background worker on free local setup).

---

## Cost map (personal use)

| Service | Free option | Typical paid | Needed for personal Edgeways? |
|--------|-------------|--------------|-------------------------------|
| **The Racing API** | Free racecards (today + tomorrow) | Basic ~£25/mo ballpark (results); Standard higher (live bookie odds). Confirm on [theracingapi.com](https://www.theracingapi.com/) dashboard - prices change. RapidAPI Pro ~$45/mo is a different product path. | **No** - paste bookie odds on Racing Desk; Set winner manually |
| **Betfair Exchange** | Delayed app key (free) | Live app key ~£499 (one-off / commercial) | **No for core** - delayed key is the best free upgrade |
| **API-Football** | ~100 req/day | Pro ~$19/mo | **Optional** - simulator covers demos; free tier ≈ 1 live match/day |
| **Betdaq / Matchbook / Smarkets** | - | Partner / commercial | **No** - not wired |
| **Hosting / Tauri** | Local `npm run dev` | Mac signing cert, hosting if SaaS | **£0** while personal-local |

### What you get at £0/mo

```
Racing API Free     →  racecards, runners, proxy odds + manual paste override
Betfair Delayed     →  real lay prices (free signup)
API-Football Free   →  optional football live (budget-capped in-app)
Everything else     →  local / manual (calcs, offers, tracker, OCR, sim)
```

### When a paid upgrade might be worth it (personal)

| Upgrade | Rough cost | Buy only if… |
|---------|------------|--------------|
| Racing API Basic | ~£25/mo | You settle many races/day and hate Set winner |
| Racing API Standard | Higher | You refuse to paste odds and need live bookie prices in-app |
| API-Football Pro | ~$19/mo | You track several live football matches at once |
| Betfair live key | ~£499 | You need tight in-play exchange spreads (rare for matched betting) |

**Rule of thumb:** if the monthly API bill exceeds the time you save × your hourly value (or your matched-betting edge), skip it.

### If you open Edgeways to paying subscribers later

- **Do not** share your personal free API keys with customers.
- Each paid plan should include a **cost floor**: Racing + football + exchange usage per active user, plus hosting.
- Prefer **bring-your-own-key** for power users, or a **pooled paid tier** funded by subscription revenue.
- Free-tier product features (paste odds, manual settle, simulator) remain the onboarding path so attrition doesn’t burn API budget.

---

## External dependencies at a glance

| Service | Free option | Paid upgrade | Env vars |
|--------|-------------|--------------|----------|
| **None** | Full app in demo mode | - | - |
| **API-Football** | 100 requests/day, live scores | Pro ~$19/mo (7,500/day) | `API_FOOTBALL_KEY` |
| **The Racing API** | Today + tomorrow racecards (no live odds) | Basic → results; Standard → live bookie odds | `RACING_API_USERNAME`, `RACING_API_PASSWORD` |
| **Betfair Exchange** | Delayed app key (prices ~1–3 min behind) | Live app key (~£499) | `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD` |
| **Betdaq** | Not available publicly | Partner API (~£250+) | Stub only - not wired up |

See `.env.example` for the full list of environment variables.

---

## Always free - no API keys required

These features run entirely locally:

- **All calculators** - matched, each-way, extra place, dutching, acca, sequential lay, 2UP, EP desk, odds converter
- **Profit tracker, history, balances, P&L**
- **Offers** - create, edit, delete place-refund and extra-place offers
- **Demo data** - sample football fixtures and horse racecards when no keys are set
- **Football simulator** - full 90-minute match in ~3 minutes (including 2UP drama)
- **Manual settlement** - set winner / result on tracked events
- **OCR bet screenshots** - parse stake and odds from images
- **CSV export** - bets, settlements, balances
- **Lay → matched calculator** - works with manually entered odds
- **Manual odds override** - paste real bookie prices on Racing Desk over proxy estimates

---

## With free Racing API credentials

**Available:**

| Feature | Status |
|--------|--------|
| Fixtures → Horse racing | Real UK & IRE racecards (today + tomorrow) |
| Racing Desk | Real racecards and runner details |
| Runner info | Cloth number, draw, jockey, trainer, form, ORF, headgear, weight |
| Bookie odds | **Estimated** from ORF ratings (labelled *est.*) - **click to paste real odds** |
| Exchange lay odds | **Estimated** (+3% spread) unless Betfair is connected |
| Offer targeting / Intelligence | Works; EV and scores marked as **estimates** until you paste odds |
| Track races and link bets | Yes |
| Auto race settlement | **No on Free** - manual “Set winner” (Basic unlocks auto while app open) |
| Silks images | **No** - not included on free racecards |
| Live bookie odds feed | **No** - requires Standard tier (or paste override) |
| Historical racecards | **No** - free tier is today and tomorrow only |

---

## Paid-gated features (by upgrade)

### The Racing API

| Tier | Endpoint / capability | Unlocks in Edgeways |
|------|----------------------|---------------------|
| **Free** | `/v1/racecards/free` | Racecards, runners, ORF-based proxy odds + manual paste |
| **Basic** | `/v1/results/today` | Auto winner/place settlement for tracked races while the app is open (Settings shows Free vs Basic) |
| **Standard** | `/v1/racecards/standard` | Live bookie odds per runner |
| **Premium add-on** | `/v1/odds/{race}/{horse}` | Full price history; API-driven steamer/drifter |

### Betfair Exchange

| Tier | Unlocks in Edgeways |
|------|---------------------|
| **Delayed app key** (free at [developer.betfair.com](https://developer.betfair.com)) | Real lay prices on Racing Desk; Lay button prefill with exchange odds |
| **Live app key** (~£499) | Real-time exchange prices for in-play and tight spreads |

### API-Football

| Tier | Unlocks in Edgeways |
|------|---------------------|
| **Free** (100/day) | Real fixtures, live scores, auto football settlement (~1 tracked match/day) |
| **Pro** (~$19/mo) | Multiple simultaneous live tracks; heavier fixture browsing |

### Betdaq / Matchbook / Smarkets

- **Betdaq** - partner API only; app has a placeholder, no live integration
- **Matchbook / Smarkets** - referenced in UI; no API integration yet

---

## Still possible on the free model (no paid upgrades)

### Already working well

1. **Racing Desk workflow** - browse today’s cards, filter qualifying races, Intelligence modal (proxy + pasted odds)
2. **Lay workflow** - Lay button opens matched calculator; Betfair delayed for real lays
3. **Track and settle manually** - track a race, log bets, set winner when finished
4. **Full calculator suite** - every calculator works independently of APIs
5. **Offers library** - manage place-refund offers and see which races qualify
6. **Football demo loop** - simulator + 2UP without any football API

### High-value additions (buildable without paid APIs)

| Idea | Effort | Value |
|------|--------|-------|
| Add **Betfair delayed key** (free signup) | ~5 min setup | Real lay odds on Racing Desk - largest free win |
| **Manual odds override** on runner rows | Done | Paste bookie odds when proxy estimates are wrong |
| **Remember last-used stake/bookie** per offer | Done | Faster repeat place-refund bets on the same offer |
| **Local steamer/drifter** from snapshot polling | Partially built | Movement indicators without premium odds API |
| **Football free tier** (API-Football key) | ~5 min setup | One real live match/day with auto settlement |
| **Tauri macOS `.app`** | Large | Distribution - £0 API, packaging/signing cost only |

### Not available on free tier (API-gated)

- Live bookie odds *feed* in-app (Racing API Standard) - paste override is the free substitute
- Auto race settlement (Racing API Basic)
- Silks images (higher-tier racecard data)
- Betdaq / Smarkets / Matchbook live lays (partner APIs)
- Racecards for dates other than today/tomorrow
- Full steamer/drifter history from API (`/v1/odds` premium)

---

## Upgrade path (when ready - optional)

| Priority | Upgrade | Approx. cost | What it fixes |
|----------|---------|--------------|---------------|
| 1 | Betfair delayed key | Free | Real exchange lays |
| 2 | Racing API Basic | ~£25/mo ballpark | Auto-settle tracked horse bets |
| 3 | Racing API Standard | Higher | Live bookie odds; better Intelligence EV |
| 4 | API-Football Pro | ~$19/mo | Multiple live football tracks |
| 5 | Betfair live key | ~£499 | Real-time exchange for in-play |

Confirm Racing API prices in your dashboard before upgrading - public listings vary (direct site vs RapidAPI).

---

## How Edgeways handles tier failures

- **Standard racecards fail (free plan)** → falls back to `/v1/racecards/free`
- **Results endpoint unavailable** → manual settlement; sync distinguishes Free-tier block vs “not published yet”
- **Exchange not configured** → +3% lay estimates; banner in Racing Desk
- **No Racing API key** → demo racecards
- **No API-Football key** → demo fixtures + built-in simulator

Settings → **Data & API** shows your free-stack summary, Free vs Basic badge, daily usage meters, and connection tests.
