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

Sources: [OddsMonkey features](https://www.oddsmonkey.com/matched-betting/features/),
[MBB OddsMonkey review](https://matchedbettingblog.com/oddsmonkey-review/),
[Outplayed tools](https://outplayed.com/matched-betting-tools),
[Outplayed Acca Catcher](https://outplayed.com/acca-catcher-guide),
[BonusMoney review](https://www.ozprofit.com/bonus-money-review/),
[Betwatch betslip automation](https://guide.betwatch.com/betting),
[ProfitDuel calculators](https://www.profitduel.com/blog/best-matched-betting-calculators).
