# API Dependencies & Feature Tiers

EdgeDesk runs **local-first**: calculators, tracker, offers, and settlement logic work without any external APIs. Optional integrations unlock live data and automation.

Last updated: July 2026.

---

## External dependencies at a glance

| Service | Free option | Paid upgrade | Env vars |
|--------|-------------|--------------|----------|
| **None** | Full app in demo mode | — | — |
| **API-Football** | 100 requests/day, live scores | Pro ~$19/mo (7,500/day) | `API_FOOTBALL_KEY` |
| **The Racing API** | Today + tomorrow racecards (no live odds) | Basic → results; Standard → live bookie odds | `RACING_API_USERNAME`, `RACING_API_PASSWORD` |
| **Betfair Exchange** | Delayed app key (prices ~1–3 min behind) | Live app key (~£499) | `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD` |
| **Betdaq** | Not available publicly | Partner API (~£250+) | Stub only — not wired up |

See `.env.example` for the full list of environment variables.

---

## Always free — no API keys required

These features run entirely locally:

- **All calculators** — matched, each-way, extra place, dutching, acca, sequential lay, 2UP, EP desk, odds converter
- **Profit tracker, history, balances, P&L**
- **Offers** — create, edit, delete place-refund and extra-place offers
- **Demo data** — sample football fixtures and horse racecards when no keys are set
- **Football simulator** — full 90-minute match in ~3 minutes (including 2UP drama)
- **Manual settlement** — set winner / result on tracked events
- **OCR bet screenshots** — parse stake and odds from images
- **CSV export** — bets, settlements, balances
- **Lay → matched calculator** — works with manually entered odds

---

## With free Racing API credentials

**Available:**

| Feature | Status |
|--------|--------|
| Fixtures → Horse racing | Real UK & IRE racecards (today + tomorrow) |
| Racing Desk | Real racecards and runner details |
| Runner info | Cloth number, draw, jockey, trainer, form, ORF, headgear, weight |
| Bookie odds | **Estimated** from ORF ratings (labelled *proxy*) |
| Exchange lay odds | **Estimated** (+3% spread) unless Betfair is connected |
| Offer targeting / Intelligence | Works; EV and scores marked as **estimates** |
| Track races and link bets | Yes |
| Auto race settlement | **No** — manual “Set winner” only |
| Silks images | **No** — not included on free racecards |
| Live bookie odds | **No** — requires Standard tier |
| Historical racecards | **No** — free tier is today and tomorrow only |

---

## Paid-gated features (by upgrade)

### The Racing API

| Tier | Endpoint / capability | Unlocks in EdgeDesk |
|------|----------------------|---------------------|
| **Free** | `/v1/racecards/free` | Racecards, runners, ORF-based proxy odds |
| **Basic** | `/v1/results/today` | Auto winner/place settlement for tracked races |
| **Standard** | `/v1/racecards/standard` | Live bookie odds per runner |
| **Premium add-on** | `/v1/odds/{race}/{horse}` | Full price history; API-driven steamer/drifter |

### Betfair Exchange

| Tier | Unlocks in EdgeDesk |
|------|---------------------|
| **Delayed app key** (free at [developer.betfair.com](https://developer.betfair.com)) | Real lay prices on Racing Desk; Lay button prefill with exchange odds |
| **Live app key** (~£499) | Real-time exchange prices for in-play and tight spreads |

### API-Football

| Tier | Unlocks in EdgeDesk |
|------|---------------------|
| **Free** (100/day) | Real fixtures, live scores, auto football settlement (~1 tracked match/day) |
| **Pro** (~$19/mo) | Multiple simultaneous live tracks; heavier fixture browsing |

### Betdaq / Matchbook / Smarkets

- **Betdaq** — partner API only; app has a placeholder, no live integration
- **Matchbook / Smarkets** — referenced in UI; no API integration yet

---

## Recommended free stack

```
Racing API Free     →  racecards, runners, proxy odds
Betfair Delayed     →  real lay prices (free dev key)
API-Football Free   →  optional, for football only
Everything else     →  local / manual
```

**Cost: £0/month** for a usable racing offer workflow. The main limitation is that bookie back odds are estimates unless entered manually or Racing API Standard is added.

---

## Still possible on the free model (no paid upgrades)

### Already working well

1. **Racing Desk workflow** — browse today’s cards, filter qualifying races, Intelligence modal for offer-aware suggestions (proxy odds)
2. **Lay workflow** — Lay button opens matched calculator; enter real odds from bookie/exchange when estimates are insufficient
3. **Track and settle manually** — track a race, log bets in tracker, set winner when finished
4. **Full calculator suite** — every calculator works independently of APIs
5. **Offers library** — manage place-refund offers and see which races qualify
6. **Football demo loop** — simulator + 2UP without any football API

### High-value additions (buildable without paid APIs)

| Idea | Effort | Value |
|------|--------|-------|
| Add **Betfair delayed key** (free signup) | ~5 min setup | Real lay odds on Racing Desk — largest free win |
| **Manual odds override** on runner rows | Medium | Paste bookie/exchange odds when proxy estimates are wrong |
| **Remember last-used stake/bookie** per offer | Small | Faster repeat betting on the same offer |
| **Local steamer/drifter** from snapshot polling | Partially built | Movement indicators without premium odds API |
| **Football free tier** (API-Football key) | ~5 min setup | One real live match/day with auto settlement |
| **Offer checklist / workflow** | Medium | Step-by-step: pick race → back → lay → log in tracker |
| **Results reminder** | Small | Prompt to settle when a tracked race should have finished |

### Not available on free tier

- Live bookie odds in-app (Racing API Standard)
- Auto race settlement (Racing API Basic)
- Silks images (higher-tier racecard data)
- Betdaq / Smarkets / Matchbook live lays (partner APIs)
- Racecards for dates other than today/tomorrow
- Full steamer/drifter history from API (`/v1/odds` premium)

---

## Upgrade path (when ready)

| Priority | Upgrade | Approx. cost | What it fixes |
|----------|---------|--------------|---------------|
| 1 | Betfair delayed key | Free | Real exchange lays |
| 2 | Racing API Basic | ~£/mo | Auto-settle tracked horse bets |
| 3 | Racing API Standard | Higher | Live bookie odds; better Intelligence EV |
| 4 | API-Football Pro | ~$19/mo | Multiple live football tracks |
| 5 | Betfair live key | ~£499 | Real-time exchange for in-play |

---

## How EdgeDesk handles tier failures

- **Standard racecards fail (free plan)** → falls back to `/v1/racecards/free`
- **Results endpoint unavailable** → manual settlement; sync shows “No API results yet”
- **Exchange not configured** → +3% lay estimates; banner in Racing Desk
- **No Racing API key** → demo racecards
- **No API-Football key** → demo fixtures + built-in simulator

Settings → **Data & API** shows connection status for each integration. Use **Test Betfair connection** after adding Betfair credentials.
