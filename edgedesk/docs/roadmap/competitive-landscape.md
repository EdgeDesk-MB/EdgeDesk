# Competitive landscape & innovation gaps

Researched 2026-07-16 (OddsMonkey, Outplayed, MatchedBettingBlog, BonusMoney, Betwatch,
ProfitDuel and the wider tool ecosystem). Purpose: spot features that have slipped our
radar and name the innovation space the incumbents leave open. New ideas from this pass
land in §9 of `product-roadmap.md` for Sam's review — nothing here is scheduled.

## 1. What the incumbents sell (and our stance)

| Incumbent feature | Who | Our position |
|---|---|---|
| OddsMatcher (real-time back/lay across ~90 bookies) | OddsMonkey, Outplayed, BonusMoney | **D2: no oddsmatching, possibly never** — it is *discovery*, their core cost, and their moat. EdgeDesk sells *execution truth*. Unchanged. |
| Extra Place / Each Way / Racing matchers | OddsMonkey ("biggest benefit of a subscription"), Outplayed | Discovery again — but note our EP **engine** and Racing Desk intelligence already do the *maths* half. Parked EW matcher (§9) stays parked. |
| Acca Finder / **Acca Catcher** (find + **track leg-by-leg, lay-on-loss alerts**) | OddsMonkey, Outplayed | The *finder* half is discovery (D2). The **tracker half is pure execution workflow — squarely our thesis and missing from our roadmap**. → NEW §9 candidate: Acca desk. |
| Price Boost Matcher / Bet Builder Finder | OddsMonkey | Finders are D2. The **checker** halves (is this boost/builder price above fair?) are one manual-entry step from our F1 Match Checker. → NEW §9 candidates. |
| Daily offer calendar (staff-curated) | All | Content business, not software. Our answer is better ingestion of what Sam already receives (paste, and → NEW: email ingestion). |
| Offer EV ratings on a calendar | BonusMoney | We already do this personally (A2/A3 basis-tagged EV beats their static list — ours is measured). |
| Profit tracker | All | Ours is deeper (EV capture, leaks, commission, retention). This is our home turf. |
| Community/forums, training courses | All | Out of scope pre-gate; Help guides + playbooks are the single-user analogue. |
| Betslip auto-fill browser extension | Betwatch | Genuinely useful *execution* automation that is not discovery. → NEW §9 candidate. |

## 2. The open innovation space (nobody does these)

The incumbents optimise *finding* offers. Nobody measures or optimises *executing* them —
which is exactly EdgeDesk's thesis. The gaps that fall out of this research:

1. **Acca desk** — multi-day offer workflow with per-leg lay tracking and "lay leg 3 now"
   alerts. Outplayed proves the demand; their version needs their finder, ours would work
   from any acca the user logs.
2. **Mug-bet scheduler** — account longevity is half the game (B9 already scores health);
   nobody plans or budgets camouflage bets systematically. Cadence per bookie, cost
   tracked as a deliberate expense against EV earned per account.
3. **Measured effort (real £/hr)** — B2's £/hr sort uses *estimated* minutes. Timing the
   actual open→logged span per offer would make the number honest and personal. No tool
   measures execution speed; it is the purest expression of our thesis.
4. **Casino variance simulator** — H2 ships variance *tiers*; a local Monte Carlo
   ("across 10,000 runs of this offer: bust 62%, median −£4, top decile +£40") would be
   the most honest casino tool on the market. Incumbents publish static EV lists.
5. **Lock-in advisor for any open position** — the 2UP desk already computes equalising
   trades; generalising "close this position now for £X guaranteed" to any open back+lay
   (user-entered current odds) is a small step no personal tool takes.

## 3. Explicitly considered and NOT pursued

- US-style promo converters (ProfitDuel, OddsJam) — different market/regulatory shape.
- Real-time odds anything — D2 stands; see §7.3 staged bridge.
- Community features — gate territory (§7).

## 4. Full feature comparison (have / planned / not planned)

Reviewed with Sam 2026-07-16, prompted by a cost-comparison thread. OddsMonkey and Outplayed
pricing/tier contents as reported by Sam from their current sites (not independently re-verified
here — confirm on the provider dashboards before treating any figure as current). EdgeDesk status
is read directly off `product-roadmap.md` §6 (phase status) and §9 (parking lot), not guessed.

**Status key:** ✅ Have (shipped) · 🔜 Planned (roadmapped, not yet built) · ⛔ Not planned
(explicit decision, see reason) · 🟡 Partial (a slice exists, the rest is a different feature)

### Discovery (odds/value finding across bookmakers)

| Feature | OddsMonkey | Outplayed | EdgeDesk | Notes |
|---|---|---|---|---|
| Full oddsmatcher (back/lay across ~90 bookies) | £49.99 tier+ | £49.99 tier+ | ⛔ Not planned | D2: "possibly never" — their core cost and moat; requires continuous multi-bookmaker polling. `AGENTS.md` hard-rules out bookmaker scraping. |
| Price boost matcher / tracker (finds boosted prices) | £49.99 tier+ | £49.99 tier+ | ⛔ Not planned | Discovery half of the feature — D2 territory. |
| Bet builder finder | — | £49.99 tier+ | ⛔ Not planned | Same — finding builders across books is discovery. |
| Extra place / each-way matcher | Ultra (bundled in Advanced) | Elite (bundled) | ⛔ Not planned | Parked in §9: "wait for real demand from daily use." |
| Acca finder (discovery half of Acca Catcher) | — | Elite | ⛔ Not planned | Only the *tracker* half is on the roadmap (see J7 below) — finding accas across books is D2. |
| Lucky Finder (value 15/31s across books) | Ultra | Pro/Elite | ⛔ Not planned | Finder = discovery = D2. |
| Edge Finder | — | Elite | ⛔ Not planned | Same. |
| Golf Master (golf market finder) | — | Elite | ⛔ Not planned | Same. |
| Steam Chaser (line-movement finder) | — | Elite | ⛔ Not planned | Same. |
| Daily offer calendar (staff-curated list) | All tiers | All tiers | ⛔ Not planned | "Content business, not software" — our answer is J6 (email ingestion of offers Sam already receives), not a curated calendar. |

### Execution & EV verdicts (checking a match you already found)

| Feature | OddsMonkey | Outplayed | EdgeDesk | Notes |
|---|---|---|---|---|
| Matched betting calculator | All tiers | All tiers | ✅ Have | Full suite: matched, EW, dutching, acca, sequential lay, odds converter. |
| Exchange-first match checker (paste a price, get a verdict) | — (built into matcher) | — (built into matcher) | ✅ Have (F1) | Zero new feed cost — the deliberately-scoped alternative to a full matcher. |
| 2UP EV / 2UP master | Ultra | Pro/Elite | ✅ Have | EP engine + 2UP desk, spec-locked, tested. |
| Extra Place EV / EP master | Ultra | Pro/Elite | ✅ Have | EP desk. |
| Price boost / bet builder *checker* (verdict on a price you found) | — | — | ✅ Have (J2, 2026-07-16) | Boosts page: fair-price verdict + boost diary. Neither incumbent separates checker from finder — this is a gap they don't fill. |
| Lock-in advisor (close any open position for £X guaranteed) | — | — | ✅ Have (J3, 2026-07-16) | Generalises the 2UP equalising-lock maths to any back+lay. No competitor has this. |
| Acca leg-by-leg lay tracker + "lay leg 3 now" alerts | — | Elite (Acca Catcher, bundled with their finder) | ✅ Have (J7, 2026-07-16) | Works from any acca logged, not just ones their finder surfaced. |
| Casino wagering EV + variance | Casino tools (£39.99 tier+) | Casino tools (£24.99 tier+) | ✅ Have (H2) | Variance tiers shipped; Monte Carlo distribution is J4 (planned). |
| Casino variance simulator (bust %, distribution) | — | — | ✅ Have (J4, 2026-07-16) | Neither incumbent publishes distributions, only static EV lists. |

### Profit tracking & account management

| Feature | OddsMonkey | Outplayed | EdgeDesk | Notes |
|---|---|---|---|---|
| Profit tracker | All tiers | All tiers | ✅ Have | Deeper: EV capture rate (A3), retention (A1), mistake ledger (B7), commission drag — measured, not estimated. |
| Bookmaker league table / account health | Basic | Basic | ✅ Have (B9) | Manual health marking (Healthy/Cooling/Gubbed), never auto. |
| Household / partner account sets | Some community workarounds | Some community workarounds | ✅ Have (J8, 2026-07-16) | Owner-tag model, per-owner P&L. |
| Mug-bet (camouflage) budgeting | — | — | ✅ Have (J5, 2026-07-16) | Nobody plans/tracks this systematically as a deliberate cost. |
| Monthly / season summary report | Basic | Basic | ✅ Have (B8, G3) | Expected-vs-realized capture chart is the flagship metric — neither incumbent has an equivalent. |
| Spreadsheet import / data export / backup | — | — | ✅ Have (E3) | Migration ramp for spreadsheet users; local-first backup/restore. |

### Alerts & automation

| Feature | OddsMonkey | Outplayed | EdgeDesk | Notes |
|---|---|---|---|---|
| Naked-exposure alert (back with no lay) | — | — | ✅ Have (B5) | Neither incumbent does this. |
| Live 2UP trigger alert | — | — | ✅ Have (B6) | Push notification when early payout triggers. |
| Offer expiry / unfinished workflow alerts | Email digest | Email digest | ✅ Have (F2/F3, H1) | Persistent alerts inbox + background push + weekly digest. |
| Betslip auto-fill browser extension | — | — | ✅ Have (J9, 2026-07-16) | Betwatch does this; execution automation, not discovery, so it's in scope. Betdaq map first. |
| Offer email ingestion (forward a promo email, get a prefilled offer) | — | — | ✅ Have (J6, 2026-07-16) | .eml drop/paste parse + IMAP folder pull into planned drafts. |
| Exchange auto-import (pull settled lays from Betfair account API) | — | — | ⛔ Not planned | Parked: ToS/auth scope needs a proper read, and it weakens the deliberate "log it consciously" execution loop. |

### Content & community

| Feature | OddsMonkey | Outplayed | EdgeDesk | Notes |
|---|---|---|---|---|
| Training content / guides | £39.99 tier+ | — | ⛔ Not planned | Out of scope pre-gate; Help guides are the single-user analogue, not a course library. |
| Forums / community | Add-on | Add-on | ⛔ Not planned | Gate territory (§7) — needs the multi-tenant business case first. |
| Daily casino reload offers (curated) | £39.99 tier+ | £24.99 tier+ | ⛔ Not planned | Content business — see daily offer calendar above. |

**Reading this table:** the ⛔ rows cluster almost entirely around *discovery* (finding
opportunities across bookmakers) and *content* (curated calendars, training, community) — both
deliberate exclusions (D1/D2), not gaps nobody noticed. Every 🔜 row is execution-side and already
sequenced in Phase 11 (J1–J9). The ✅ rows are where EdgeDesk already matches or exceeds incumbent
depth, mostly in profit truth and alerting, where the incumbents are thin.

## 5. Value proposition & tier ladder

### Positioning

OddsMonkey and Outplayed sell you *finding* — a live feed of mismatches across ~90 bookmakers.
Nobody in this market sells *proof* — confirmation that what you found actually got captured, to
the pound, after commission, after voids, after the free bet converted. That gap is structural,
not incidental: it shows up as the entire "Profit tracking & account management" and "Alerts &
automation" rows in §4 being ✅ for EdgeDesk and thin-to-absent for both incumbents. Working
line: **"They tell you what to bet. EdgeDesk tells you whether it actually paid."**

This is deliberately not "EdgeDesk does everything OddsMonkey does, cheaper." It doesn't — see the
⛔ rows in §4. It is a different product that shares a customer.

### Tier ladder

Mirrored from `product-roadmap.md` §7.5 (draft, revisit at gate) — that section is the canonical
source; update there first if pricing or contents change.

| Tier | Price | Contents | Logic |
|------|-------|----------|-------|
| **Free** | £0 | Calculators, manual tracking, basic P&L | Funnel + community trust |
| **Core** | ~£9.99/mo | Pipeline, Do Next, Daily Plan, EV capture analytics, Edge Report | All-lib features, near-zero COGS |
| **Edge** | ~£24.99/mo | Racing Desk live feeds, 2UP sentinel + push, exchange integration, league table | Carries the API costs; anchored just under Outplayed |

This section adds the competitive reasoning that doesn't belong in the pricing draft itself.

**Why Edge is anchored under Outplayed's £49.99 discovery tier, not their £150-300 bundle:**
the cost-comparison earlier in this thread showed the realistic personal setup is a matcher-only
subscription (£49.99, either provider) *plus* EdgeDesk for everything execution-side — because
EdgeDesk was never trying to replace the part of the bundle it deliberately doesn't build (D2).
Pricing Edge against the £150-300 bundle would mean competing on a feature set EdgeDesk doesn't
have. Pricing it under the £49.99 tier a user keeps anyway, while delivering deeper execution
truth than either incumbent's top tier, is the actual wedge: total spend (~£75-90/mo) still beats
Ultra/Elite outright, and EdgeDesk's slice of that is cheap because it carries no discovery feed
cost (§7.2 — feed proxy economics only apply once multi-tenant; today it's £0-40/mo in personal
API costs per `api-dependencies-and-tiers.md`).

**Open item:** Phase 11 (J1-J9, execution-edge) isn't tier-assigned in §7.5 yet. Reasonable split
by data-cost logic (mirrors the Core/Edge split already documented — pure-local features are
Core-friendly, features riding on exchange/alert infrastructure lean Edge) — J1, J4, J5, J8 look
Core-shaped; J2, J3, J7, J9 look Edge-shaped (they extend already-Edge-gated F1/B6 infrastructure);
J6 straddles (paste/drop is Core, IMAP pull may need Edge). Flagging for a real decision at gate
review rather than deciding it here.

### The compounding argument

§7.4's data moat is the retention story for this ladder: capture rate history (A3), measured
retention (A1), mistake taxonomy (B7) and bookmaker health (B9) all get more valuable the longer
a single user runs EdgeDesk, and none of it is replicable by an incumbent bolting on a tracker
after the fact — it requires the execution loop to have run *through* the product from day one.
That's the argument for why Edge is worth £24.99/mo indefinitely rather than being a one-off
utility: the personal report ("captured 91% of theoretical edge this month") gets more accurate
and more valuable with tenure, which neither Ultra nor Elite can offer regardless of price.

Sources: [OddsMonkey features](https://www.oddsmonkey.com/matched-betting/features/),
[MBB OddsMonkey review](https://matchedbettingblog.com/oddsmonkey-review/),
[Outplayed tools](https://outplayed.com/matched-betting-tools),
[Outplayed Acca Catcher](https://outplayed.com/acca-catcher-guide),
[BonusMoney review](https://www.ozprofit.com/bonus-money-review/),
[Betwatch betslip automation](https://guide.betwatch.com/betting),
[ProfitDuel calculators](https://www.profitduel.com/blog/best-matched-betting-calculators).
