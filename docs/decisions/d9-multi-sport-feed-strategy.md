# D9 — Multi-sport feed strategy

> Locked **26 Aug 2026**. Decision owner: Sam.
> Product rule: sports are added by UK bookmaker offer volume, funded by Edge
> revenue, and every feed ships with a cap and a monitor from day one.

## The rule

Horse racing and football are the launch sports. Further sports are added in
offer-volume order — **tennis, golf, greyhounds, then NFL / darts / snooker /
cricket** — and only when the phase triggers below say so. "All sports" is a
direction, not a launch requirement.

Three provider shapes price very differently:

| Shape | Coverage | Cost |
|---|---|---|
| **API-Sports** (football provider) | Per-sport APIs (tennis, basketball, NFL, rugby, F1, cricket, MMA…) | ~$19/mo **per sport** (7,500 req/day). Five sports ≈ $95/mo |
| **The Odds API** | 70+ sports, 40+ bookmakers, one account | Credits: $30/mo (20k) → $59 (100k) → $119 (5M) |
| **Betfair Exchange** (held) | Every exchange sport: catalogue, lay prices, settlement | £0 incremental on the delayed key |

The key asymmetry: **Betfair already covers every sport** for fixtures, lay
prices and settlement under the key we hold. What it does not provide is
bookmaker back-odds depth — which manual paste covers for free until a sport
earns automation.

## Phases

**Phase 0 — now → launch: nothing new.** Racing + football is enough. The
launch gate is the Stripe smoke pass (EDGE-37), not sport count. No new
adapters, no new subscriptions pre-revenue.

**Phase 1 — post-launch, pre-revenue (~£0):** extend the desk to new sports
via the Betfair market catalogue already integrated. Tennis first (first-set
/ retirement offers), then golf (each-way extra places — the EW calculator
already exists). One existing integration, no new provider accounts.

**Phase 2 — with paying customers:** add sports in the offer-volume order
above, each as a pooled feed adapter writing into the shared `events` table
with its own `feed_budget` row (schema supports per-feed rows since
0016). When automated bookie odds across sports are justified, take **one**
The Odds API subscription ($30–59/mo) rather than stacking API-Sports
per-sport plans; keep API-Sports for football depth where it is proven.

## Threshold discipline

The admin feed monitor (built 26 Aug 2026) is the upgrade mechanism:

- Every feed has a daily cap in `/admin/feeds`, set below the provider quota.
- **Watch state (70% of cap) is the upgrade trigger.** Sustained Watch on a
  feed → upgrade that provider plan → raise the cap in the admin UI. No
  deploy.
- API-Sports hard-stops at quota and The Odds API credits behave the same —
  worst case is a degraded feed, never a surprise invoice.
- Pooled polling means cost scales with **distinct events tracked**, not
  users. The 100th customer is free; a busy Saturday is what costs.

## What we do not do

- No stack of API-Sports per-sport subscriptions pre-revenue (~$100/mo of
  waste while the charts sit near zero).
- No sport adapters before EDGE-37 is green.
- No provider names anywhere customer-facing (D8).
- No BYOK as a scaling answer (D7). If a sport's feed is unaffordable, that
  sport waits — the customer never sees a key field.

## Agent rule

If a reply would add a sport by spinning up a new paid provider account
before its phase trigger, stop. Phase 1 is Betfair-catalogue work at £0;
Phase 2 upgrades are justified by the feed monitor, not by enthusiasm.

Every sport day-card feed is store-first: cron warms a shared Neon/SQLite
row, users read Edgeways. Copy `fixture-store` / `racecard-store`. Do not
let a desk open become the thing that spends the provider quota. Live
scores stay on the short poll. Rule: `.cursor/rules/feed-store-first.mdc`.
