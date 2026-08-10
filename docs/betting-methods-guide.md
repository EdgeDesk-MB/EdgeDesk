# The Complete Guide to Bet Types

### Structure, Usage, and Matched-Betting Application

**Version 1.0 — August 2026**
**Scope:** UK/Ireland market, with US terminology mapping. Covers every bet structure in commercial use, how each is actually used by punters, and how each behaves under matched betting.

---

## Table of Contents

1. [How to Use This Guide](#1-how-to-use-this-guide)
2. [The Three-Axis Mental Model](#2-the-three-axis-mental-model)
3. [Core Concepts & Vocabulary](#3-core-concepts--vocabulary)
4. [Single-Selection Bets](#4-single-selection-bets)
5. [Multiples](#5-multiples)
6. [Full-Cover Bets Without Singles](#6-full-cover-bets-without-singles)
7. [Full-Cover Bets With Singles](#7-full-cover-bets-with-singles)
8. [Any-To-Come & Conditional Bets](#8-any-to-come--conditional-bets)
9. [Racing Exotics & Pool Betting](#9-racing-exotics--pool-betting)
10. [Exchange Bet Types](#10-exchange-bet-types)
11. [Spread Betting](#11-spread-betting)
12. [International Terminology Map](#12-international-terminology-map)
13. [Modifiers & Promotions](#13-modifiers--promotions)
14. [Settlement Rules & Edge Cases](#14-settlement-rules--edge-cases)
15. [Matched Betting: The Complete Picture](#15-matched-betting-the-complete-picture)
16. [Matched-Betting Utility Matrix](#16-matched-betting-utility-matrix)
17. [Formula Reference](#17-formula-reference)
18. [Data Model Recommendations](#18-data-model-recommendations)
19. [Quick Reference Tables](#19-quick-reference-tables)
20. [Glossary](#20-glossary)

---

## 1. How to Use This Guide

This guide serves three audiences, often the same person wearing different hats:

- **Product / design** — building an app that must model, display, or settle these bet types. Read sections 2, 14, 18, 19.
- **Punter** — understanding what each bet actually does. Read sections 4–12.
- **Matched bettor** — working out which structures are exploitable. Read sections 15–17, then dip back into the structural sections as needed.

Every bet type entry follows the same shape:

> **Structure** — how selections and stake combine
> **Bet count** — how many individual bets the stake is divided across
> **Where used** — sport and typical punter profile
> **Returns profile** — variance and payout shape
> **Matched-betting utility** — rated None / Low / Medium / High, with reasoning
> **Edge cases** — settlement quirks that break naive implementations

⚠️ **A note on figures.** Commission rates, place terms, and promotional structures change frequently. Anything time-sensitive in this guide is flagged. Verify against operator T&Cs and Gambling Commission returns before relying on it commercially.

---

## 2. The Three-Axis Mental Model

The single most common modelling mistake in betting software is treating "bet type" as one flat list. It isn't. There are three orthogonal axes, and conflating them causes combinatorial explosion in your schema and your navigation.

### Axis 1 — Structure

*How the stake and selections combine.* This is what people usually mean by "bet type."

Single · Double · Accumulator · Yankee · Lucky 15 · Round Robin · Forecast · Lay

### Axis 2 — Market

*What you are betting on.* Independent of structure — you can put a Match Odds selection into a Single, an Acca, or a Yankee.

Match Odds · Over/Under Goals · Both Teams To Score · Correct Score · First Goalscorer · Handicap · Win · Place · Outright

### Axis 3 — Modifier

*What is layered on top.* These are flags, not types.

Free Bet (SNR/SR) · Price Boost · Best Odds Guaranteed · Acca Insurance · Extra Places · Early Payout · Cash Out · Bore Draw Refund

### Why this matters

"Free Bet Each-Way Yankee on Over 2.5 Goals with Acca Insurance" is not a bet type. It is:

```
structure : yankee
legs      : [ {market: over_2.5, ...} × 4 ]
each_way  : true
modifiers : [ free_bet_snr, acca_insurance ]
```

Model it as an enum plus arrays and you have one entity. Model it as a flat type list and you have several thousand.

---

## 3. Core Concepts & Vocabulary

### Odds formats

| Format | Example | Meaning | Convert to decimal |
|---|---|---|---|
| **Decimal** | 3.50 | Total return per 1 unit staked | — |
| **Fractional** | 5/2 | Profit / stake | `(num ÷ den) + 1` |
| **American** | +250 | Profit on 100 (positive) or stake for 100 (negative) | `(odds ÷ 100) + 1` or `(100 ÷ \|odds\|) + 1` |
| **Implied probability** | 28.57% | `1 ÷ decimal odds` | — |

Decimal is the only sane internal representation. Convert on display only.

### Stake vs liability

- **Backing:** you risk your **stake**. Maximum loss = stake.
- **Laying:** you risk your **liability**. Liability = `lay stake × (lay odds − 1)`. Laying at 10.0 for £10 risks £90.

This asymmetry is why exchange UIs display the two numbers differently, and why bankroll calculations must track exposure, not stake.

### Overround (the bookmaker's margin)

Sum the implied probabilities of all outcomes in a market. A fair market sums to 100%. A bookmaker market sums to, say, 105% — that 5% is the overround.

```
overround = Σ (1 / decimal_odds_i) − 1
```

The more selections in a market, the more overround is typically baked in. This is precisely why accumulators are profitable for bookmakers: margin compounds multiplicatively across legs.

**Compounded margin on an N-leg acca:**
```
total_margin ≈ (1 + m)^N − 1
```
A 5% margin per leg across a 6-fold is roughly a 34% margin. This single fact explains most of the bookmaker's football P&L.

### Expected value (EV)

```
EV = (P_win × profit_if_win) − (P_lose × stake)
```
Or for a boosted price:
```
EV per unit staked = (B × P_true) − 1
```
where `B` is the boosted decimal odds and `P_true` is the genuine probability. Everything in advantage play reduces to making this number positive.

### Starting Price (SP)

The price returned at the off for a horse race, derived from on-course/market activity. Relevant to Best Odds Guaranteed, and to "take SP" exchange functionality.

### Exchange commission

Charged on **net winnings** per market, not on turnover. Typical published rates: Betfair around 5% standard (reducible via plan selection and lower on some racing markets), Smarkets and Betdaq at 2%, and Matchbook at 2% for UK/Ireland users. Commission-free introductory periods are common — Matchbook has run 0% for 110 days, Betdaq for 100 days, and Smarkets for 60 days.

⚠️ Rates and tiers shift. Treat every number here as a starting point for verification, and make commission a per-account configurable field in any tool you build.

---

## 4. Single-Selection Bets

### 4.1 Single

> **Structure** — one selection, one stake, one bet
> **Bet count** — 1
> **Where used** — universal. The default in horse racing; the fallback everywhere else
> **Returns profile** — lowest variance of any structure
> **Matched-betting utility** — **High**. The workhorse

The irreducible unit. Everything else is a composition of singles.

**Why matched bettors live here:** a single has exactly one outcome to neutralise. You back at the bookmaker, lay the same selection at the exchange, and your position is closed regardless of result. Every additional leg multiplies the number of positions you must hedge and the liquidity you need.

**Edge cases:**
- Void selection → stake returned, bet settles at 1.0
- Non-runner in racing → stake returned, plus possible Rule 4 deductions on remaining bets
- Dead heat → stake divided by number of dead-heaters, settled at full odds on the reduced stake

---

### 4.2 Each-Way (E/W)

> **Structure** — one selection, **two** bets: a Win part and a Place part. Total outlay is double the unit stake
> **Bet count** — 2
> **Where used** — horse racing overwhelmingly; also golf, darts, snooker, cycling, athletics outrights
> **Returns profile** — reduces variance versus a straight Win single; caps upside
> **Matched-betting utility** — **High**, and the source of some of the best recurring value in the game

A £5 each-way bet costs £10. The Win half pays at full odds if the selection wins. The Place half pays at a **fraction** of the odds if the selection finishes within the place terms.

**Standard place terms (horse racing, non-handicap):**

| Runners | Places paid | Fraction |
|---|---|---|
| 1–4 | Win only | — |
| 5–7 | 2 | 1/4 |
| 8+ | 3 | 1/5 |

**Handicap races:**

| Runners | Places paid | Fraction |
|---|---|---|
| 5–7 | 2 | 1/4 |
| 8–11 | 3 | 1/5 |
| 12–15 | 3 | 1/4 |
| 16+ | 4 | 1/4 |

⚠️ Terms vary by bookmaker and by event. Golf commonly pays 5–8 places at 1/4 or 1/5. Never hardcode these — read them from the market.

**Worked example:** £5 e/w on a 10/1 shot in a 12-runner handicap (3 places, 1/4 odds).
- Outlay: £10
- Wins: Win part returns £55, Place part returns £5 × (10/4) + £5 = £17.50. Total £72.50
- Places (2nd/3rd): Win part loses. Place part returns £17.50. Net −£2.50 (a "each-way loss")

**Matched-betting relevance:** each-way is the foundation of **extra-place offers**, which are among the highest-EV recurring plays available. See §15.4.

**Edge cases:**
- Reduced field can change place terms *after* the bet is struck — most bookmakers settle on terms at time of placement, but some re-rate. Check T&Cs.
- Dead heat for a place divides the place stake proportionally.
- Non-runners can push a race below the place-terms threshold.

---

### 4.3 Ante-Post / Outright / Futures

> **Structure** — a single placed well in advance of the event
> **Bet count** — 1
> **Where used** — championship winners, tournament outrights, relegation, top goalscorer, politics/specials
> **Returns profile** — long-horizon, capital tied up
> **Matched-betting utility** — **Low to Medium**. Liquidity is thin and capital is locked up for months

Structurally identical to a single, but with materially different settlement behaviour:

- **True ante-post:** stake is lost if your selection doesn't run/participate. No refund for non-participation.
- **Non-runner no bet (NRNB):** stake returned if the selection doesn't take part. Usually offered closer to the event, at shorter odds.

**Matched-betting note:** capital efficiency is terrible. A £100 outright hedge ties up stake plus exchange liability for weeks or months. Only worth it for exceptional boosts, or where an offer specifically requires an outright. Some bettors use outrights deliberately as **mug bets** — see §15.7.

---

## 5. Multiples

The **accumulator family**. All selections must win for any return. Odds multiply.

```
combined_odds = Π (odds_i)
returns       = stake × combined_odds
```

### 5.1 Double

> **Structure** — 2 selections, 1 bet. Both must win
> **Bet count** — 1
> **Where used** — racing and football; the gateway multiple
> **Matched-betting utility** — **Low**. Used only where an offer demands a minimum of 2 legs

### 5.2 Treble

> **Structure** — 3 selections, 1 bet
> **Bet count** — 1
> **Where used** — very common in racing (three from an afternoon's card)
> **Matched-betting utility** — **Low**. Same reasoning as doubles

### 5.3 Accumulator ("Acca", 4+ legs)

> **Structure** — N selections, 1 bet, all must win
> **Bet count** — 1
> **Where used** — the defining football betting product in the UK
> **Returns profile** — extreme positive skew. Low hit rate, large payout
> **Matched-betting utility** — **Low on its own; Medium-High when an acca-specific offer exists**

Named variants: Fourfold, Fivefold, Sixfold, Sevenfold, Eightfold, and upward. Most bookmakers cap at 12–20 legs.

**Why punters love it:** £2 returning £400 feels like a lottery ticket with skill attached. Bookmakers promote accas heavily because compounded margin (see §3) makes them enormously profitable.

**Why matched bettors avoid it:** laying an acca means either
- laying it leg by leg with progressively adjusted stakes (correct, but requires being present at every kick-off and carrying interim risk), or
- accepting an unhedged position.

The exception is **acca insurance** offers, where the refund condition makes the play worthwhile. See §15.5.

**Edge cases:**
- **Void leg:** most bookmakers reduce the acca by that leg (a fivefold becomes a fourfold) rather than voiding the whole bet. This is the single most commonly mishandled rule in bet-settlement code.
- **Each-way acca:** doubles the outlay; the place part runs as its own acca on place results. Settlement is genuinely fiddly.
- Some operators void the entire bet if a leg is void — check per operator.

---

### 5.4 Bet Builder / Same Game Multi / RequestABet

> **Structure** — multiple selections **within a single event**, combined into one bet
> **Bet count** — 1
> **Where used** — football above all; expanding into basketball, tennis, cricket, NFL
> **Returns profile** — similar to an acca, but priced by the operator's own correlation model
> **Matched-betting utility** — **Low to Medium**. Rarely layable; used almost exclusively as an EV play when an offer attaches

The fastest-growing product in the market. bet365 is widely regarded as the strongest bet builder, allowing up to twelve selections within a single match.

**The critical structural difference:** legs within one event are **correlated**. "Team A to win" and "Team A striker to score" are not independent. Odds are therefore *not* a simple product — the operator prices the joint distribution, applying a correlation adjustment. Some combinations are blocked entirely as too correlated.

**Consequence for matched betting:** there is no exchange market for "Team A wins AND striker scores AND over 9.5 corners." You cannot lay a bet builder. Options are:
1. **Dutch an approximation** across other bookmakers — imprecise and rarely worthwhile
2. **Accept it as a +EV punt** where the offer's value exceeds the expected loss
3. **Model the joint probability yourself** and compute true EV — this is where goal-model work (Dixon-Coles and similar) earns its keep

**Trend to watch:** operators increasingly issue free bets *specifically as bet-builder tokens* rather than generic free bets. Betfred's welcome offer splits into £30 sports free bets plus £20 in bet-builder free bets, and BetMGM issues 2 × £10 sports tokens plus 2 × £10 bet-builder tokens. This is a deliberate product decision that reduces matched-betting extractability, because bet-builder tokens are structurally harder to hedge. Expect this to continue.

**Variants:**
- **Bet Builder Accumulator** — combining builders across multiple fixtures. Compounds both variance and unhedgeability.
- **RequestABet / PickYourPunt** — bespoke priced markets, sometimes requested via social media. Betfred's PickYourPunt allows submitting wager requests via social media.
- **Pre-built / Popular Builders** — operator-curated combinations, prominently surfaced.

---

### 5.5 Each-Way Multiples

> **Structure** — a multiple where every leg is each-way
> **Bet count** — 2 (win multiple + place multiple)
> **Where used** — racing punters combining several e/w fancies
> **Matched-betting utility** — **Low**. Doubles the hedging burden on an already awkward structure

---

## 6. Full-Cover Bets Without Singles

A full-cover bet automatically generates **every possible multiple** from your selections, with no singles included. You stake a unit amount per line, so total outlay = unit stake × number of lines.

The appeal: you get a return even if not every selection wins. The cost: outlay scales fast.

### 6.1 The family

| Name | Selections | Lines | Composition |
|---|---|---|---|
| **Trixie** | 3 | 4 | 3 doubles + 1 treble |
| **Yankee** | 4 | 11 | 6 doubles + 4 trebles + 1 fourfold |
| **Canadian** (Super Yankee) | 5 | 26 | 10 doubles + 10 trebles + 5 fourfolds + 1 fivefold |
| **Heinz** | 6 | 57 | 15 doubles + 20 trebles + 15 fourfolds + 6 fivefolds + 1 sixfold |
| **Super Heinz** | 7 | 120 | all combinations of 2–7 |
| **Goliath** | 8 | 247 | all combinations of 2–8 |

**General formula for lines:**
```
lines = 2^N − N − 1
```
(all subsets, minus the empty set, minus the N singletons)

Check: N=4 → 16 − 4 − 1 = 11 ✓ · N=8 → 256 − 8 − 1 = 247 ✓

### 6.2 Usage notes

- **Minimum returns:** a Trixie needs 2 winners to return anything; a Yankee needs 2; a Goliath needs 2. One winner returns nothing in any no-singles full cover.
- **Naming trivia:** the Heinz is named for the "57 varieties" slogan — the bet count came first, the name second. The Goliath, Super Heinz, and Canadian follow the same tradition of naming by scale.
- **Typical punter:** the racing regular with 4–8 fancies across an afternoon's meetings, wanting coverage rather than an all-or-nothing acca.
- **Stake reality check:** a £1 Goliath costs £247. A £0.10 Goliath costs £24.70. Unit stakes on large full covers are usually pennies.

### 6.3 Matched-betting utility — **None to Very Low**

Full-cover bets are effectively unhedgeable:

- **Liquidity:** you would need to lay 8 selections simultaneously with correctly weighted stakes across 247 interacting outcomes.
- **Correlation of outcomes:** the payoff surface is non-linear in the number of winners. There is no single lay position that neutralises it.
- **Racing lay prices:** typically wider than football, eroding any margin before you start.

They appear in matched betting only when an offer explicitly requires one (rare) or as **mug betting** cover to look like a recreational punter.

**Edge cases:**
- Void selection in a full cover → the bet **reduces**. A Yankee with one void leg becomes a Trixie (plus dead lines). Settlement engines must handle recursive reduction.
- Non-runners cascade: two voids in a Yankee leave you with a single double plus dead lines.

---

## 7. Full-Cover Bets With Singles

Identical to §6, but **singles are included**. One winner now produces a return.

### 7.1 The family

| Name | Selections | Lines | Composition |
|---|---|---|---|
| **Patent** | 3 | 7 | 3 singles + 3 doubles + 1 treble |
| **Lucky 15** | 4 | 15 | 4 singles + 6 doubles + 4 trebles + 1 fourfold |
| **Lucky 31** | 5 | 31 | 5 singles + 10 doubles + 10 trebles + 5 fourfolds + 1 fivefold |
| **Lucky 63** | 6 | 63 | all combinations of 1–6 |
| **Lucky 127** | 7 | 127 | all combinations of 1–7 |
| **Lucky 255** | 8 | 255 | all combinations of 1–8 |

**Formula:**
```
lines = 2^N − 1
```

### 7.2 The Lucky bonus structure

The "Lucky" bets are distinguished by **bonuses**, which are the actual reason for their popularity. Typical terms (vary by operator):

- **One winner:** double the odds on that single (sometimes treble)
- **All winners:** 10% bonus on total returns (sometimes 20%)

⚠️ These bonuses are operator-specific and change. Some apply the consolation only if the other selections all lose; some apply it if the others merely fail to win. Read the T&Cs.

**Why Lucky 15 is the most popular full-cover bet in the UK:** the one-winner consolation makes it feel forgiving, and £1 per line at £15 total is a psychologically comfortable racing stake.

### 7.3 Matched-betting utility — **None to Very Low**

Same reasoning as §6.3, with an extra wrinkle: the bonus terms make the payoff function discontinuous, so even approximate hedging is unreliable. Occasionally a "Lucky 15 bonus" promotion is worth evaluating on pure EV grounds, but it is niche.

---

## 8. Any-To-Come & Conditional Bets

Also called **ATC**, **if-cash**, or **stake-back** bets. Returns from one part of the bet are automatically reinvested into another. These are legacy high-street products, and they are the single most common source of settlement bugs in betting software.

### 8.1 Up and Down (Single Stakes About / SSA)

> **Structure** — 2 selections, 2 bets. Selection A single with "any to come" stake onto B, and B single with ATC onto A
> **Bet count** — 2
> **Where used** — racing, mostly by older punters
> **Matched-betting utility** — **None**

**Mechanics:** £10 Up and Down = £20 total outlay.
- Bet 1: £10 on A. If A wins, £10 of the return goes onto B.
- Bet 2: £10 on B. If B wins, £10 of the return goes onto A.

If both win, you effectively have four winning components. If one wins, the returned stake funds a losing bet on the other.

### 8.2 Double Stakes About (DSA)

Identical to SSA, but **double** the unit stake is carried forward on the ATC leg. Higher exposure, higher return if both win.

### 8.3 Round the Clock

> **Structure** — 3+ selections, each with an ATC to the next in a cycle
> **Bet count** — equal to number of selections
> **Matched-betting utility** — **None**

### 8.4 Rounder / Roundabout

> **Structure** — 3 selections, 3 bets. Each selection is a single with ATC stakes onto a double on the other two
> **Bet count** — 3
> **Variants** — a Rounder carries the full stake; a Roundabout typically carries double stakes
> **Matched-betting utility** — **None**

### 8.5 Round Robin

> **Structure** — 3 selections, **10 bets**: a Trixie (4 lines) + 3 Up-and-Down pairs (6 lines)
> **Bet count** — 10
> **Matched-betting utility** — **None**

⚠️ **Terminology collision:** in the US, "Round Robin" means something entirely different — a set of parlays generated from a selection pool. See §12.

### 8.6 The Flag family

A Flag is a full-cover bet **plus** all up-and-down pairs.

```
flag_lines = fullcover_lines(N) + 2 × C(N,2)
```

| Name | Selections | Lines | Derivation |
|---|---|---|---|
| **Flag** | 4 | 23 | Yankee (11) + 6 pairs × 2 |
| **Super Flag** | 5 | 46 | Canadian (26) + 10 pairs × 2 |
| **Heinz Flag** | 6 | 87 | Heinz (57) + 15 pairs × 2 |
| **Super Heinz Flag** | 7 | 162 | Super Heinz (120) + 21 pairs × 2 |
| **Goliath Flag** | 8 | 303 | Goliath (247) + 28 pairs × 2 |

⚠️ Not all operators offer the larger flags, and line counts above the Super Flag vary by operator convention. Verify before implementing settlement.

### 8.7 Alphabet

> **Structure** — 6 selections, **26 bets**
> **Composition** — Patent on selections 1–3 (7) + Yankee on selections 3–6 (11) + Patent on selections 4–6 (7) + one sixfold accumulator (1)
> **Matched-betting utility** — **None**

Note that selection order matters, which is unusual and worth flagging in any UI.

### 8.8 Union Jack

> **Structure** — 9 selections arranged in a 3×3 grid; 8 trebles drawn along the rows, columns, and diagonals
> **Bet count** — 8
> **Variants** — Union Jack Trixie (8 Trixies = 32 lines), Union Jack Patent (8 Patents = 56 lines), Union Jack Round Robin
> **Matched-betting utility** — **None**

Grid position matters, which makes this the only common bet type requiring a spatial input UI.

### 8.9 Implementation warning

ATC bets are the primary reason legacy betting settlement engines are complex. Key hazards:

- **Sequential dependency** — a bet's stake is not known until a prior leg settles
- **Order sensitivity** — Alphabet and Union Jack depend on selection ordering
- **Partial settlement** — an ATC bet can be half-settled with the remainder pending
- **Non-runner cascade** — a void selection changes downstream stakes, not just line validity

**Recommendation for any modern product:** support these as a display/log category, but do not build a live placement flow unless you have a genuine business case. Volume is tiny and complexity is disproportionate.

---

## 9. Racing Exotics & Pool Betting

Two distinct categories that are often lumped together: **fixed-odds exotics** (bookmaker-priced) and **pari-mutuel pools** (pooled stakes, dividend-based).

### 9.1 Forecast

> **Structure** — predict the first two finishers **in correct order**
> **Where used** — horse and greyhound racing
> **Pricing** — computed at settlement via the **Computer Straight Forecast (CSF)** formula, not offered as a fixed price beforehand
> **Matched-betting utility** — **None**. No exchange equivalent, and the dividend is unknown at placement

| Variant | Description | Bets |
|---|---|---|
| **Straight Forecast** | A then B, in that order | 1 |
| **Reverse Forecast** | A-B or B-A | 2 |
| **Combination Forecast** | All ordered pairs from N selections | `N × (N−1)` |

### 9.2 Tricast

> **Structure** — predict the first three finishers in correct order
> **Availability** — handicaps with 8+ runners, typically
> **Pricing** — Computer Tricast (CT) dividend, computed at settlement

| Variant | Bets |
|---|---|
| **Straight Tricast** | 1 |
| **Combination Tricast** | `N × (N−1) × (N−2)` |

A combination tricast on 5 selections is 60 bets.

### 9.3 Tote / pari-mutuel pools

Stakes go into a common pool. The operator takes a deduction (the "takeout"), and the remainder is divided among winning tickets. **Odds are not known at placement.**

| Pool | Requirement |
|---|---|
| **Win** | Winner of a race |
| **Place** | Placed finisher |
| **Exacta** | First two in order |
| **Trifecta** | First three in order |
| **Swinger** | Any two of the first three, any order |
| **Placepot** | A placed horse in each of races 1–6 at a meeting |
| **Quadpot** | A placed horse in each of races 3–6 |
| **Jackpot** | Winner of each of six nominated races |
| **Scoop6** | Winner of six nominated races nationally; large rollover pools |

**Matched-betting utility — None.** Pool dividends are unknown at placement, there is no lay market, and the takeout is substantial. Pool bets appear in matched betting only as mug-bet cover or when a specific pool promotion offers a guaranteed minimum.

**Design note:** pool bets require a fundamentally different data shape from fixed-odds bets — there are no odds at placement, only a stake, a pool identifier, and a later dividend. Do not force them into a fixed-odds schema.

### 9.4 Football pools

Legacy products (Littlewoods-lineage, Colossus Bets, and similar) based on predicting score draws or outcomes across a coupon of fixtures. Pari-mutuel in structure. Negligible matched-betting relevance.

---

## 10. Exchange Bet Types

An exchange is a peer-to-peer marketplace. There is no bookmaker taking a position — you are matched against other users, and the operator takes commission on net winnings.

### 10.1 Back

> **Structure** — identical to a bookmaker single: you bet on something to happen
> **Risk** — your stake
> **Matched-betting utility** — **Medium**. Used for arbing between exchanges, and when exchange prices beat bookmaker prices

### 10.2 Lay

> **Structure** — you bet on something **not** to happen. You are the bookmaker for that selection
> **Risk** — your **liability**: `lay_stake × (lay_odds − 1)`
> **Matched-betting utility** — **Critical**. This is the entire mechanism

**Worked example:** lay Team A at 4.0 for £25.
- If Team A loses or draws: you win £25, minus commission
- If Team A wins: you lose £75 (liability)

**The lay/back relationship is the whole of matched betting.** Back at the bookmaker (where the promotion lives), lay at the exchange (where the true price lives), and the difference between the two prices plus commission is your cost of entry.

### 10.3 The back/lay spread

The gap between the best available back price and best available lay price. Narrow spreads mean low qualifying loss. Spread width is driven by liquidity:

- **Tight:** Premier League match odds, major racing win markets
- **Wide:** lower-league correct score, obscure player props, small-field place markets

Spread management is the primary lever on matched-betting profitability at the qualifying-bet stage.

### 10.4 Exchange multiples

Some exchanges support accumulators of exchange selections. Betdaq in particular supports doubles, trebles and other multiples on the exchange. Liquidity and pricing are typically inferior to laying leg by leg, but they can simplify acca hedging.

### 10.5 Take SP / Keep at SP

Racing-specific exchange functionality. An unmatched order can be **taken** at Starting Price rather than lapsing, or **kept** into the in-play phase. Useful when you must get a lay matched at any price.

### 10.6 Cash Out

> **Structure** — not a bet type; an operator-offered hedge that closes your position early at a computed price
> **Available on** — singles, accas, bet builders, both bookmaker and exchange
> **Variants** — full, partial, auto cash-out (trigger-based)
> **Matched-betting utility** — **Low**. Usually −EV

Cash-out prices embed a substantial margin. Manually hedging on the exchange nearly always beats cashing out. The exceptions:

- Acca insurance offers where the exit price genuinely beats the alternative
- Situations where you cannot access the exchange in time
- Deliberate mug-bet behaviour (see §15.7) — cashing out looks recreational

---

## 11. Spread Betting

> **Structure** — buy or sell a market's predicted outcome. Your profit or loss is `(actual − quoted) × stake per unit`
> **Where used** — sports spread firms (Sporting Index lineage), financial markets
> **Regulation** — FCA-regulated in the UK, **not** UKGC. Materially different consumer protections
> **Matched-betting utility** — **None to Very Low**

**Example:** total goal minutes in a match quoted at 90–95. You **buy** at 95 for £2/point. If total goal minutes come to 130, you win £70. If they come to 40, you lose £110.

**Critical distinction:** loss is **unbounded**. This is the only common betting structure where you can lose more than your stake. Any product surfacing spread betting alongside fixed-odds betting must make that difference unmissable in the UI — regulatorily as well as ethically.

**Design recommendation:** treat spread betting as a separate module with its own risk model, exposure display, and stop-loss handling. Do not fold it into a fixed-odds bet-type list.

---

## 12. International Terminology Map

Useful if you internationalise, and essential for interpreting US-sourced betting content.

| US term | UK equivalent | Notes |
|---|---|---|
| **Parlay** | Accumulator | Direct equivalent |
| **Same Game Parlay (SGP)** | Bet Builder | Direct equivalent |
| **Moneyline** | Match Odds / Win | Market, not structure |
| **Point Spread** | Handicap | Market |
| **Total / Over-Under** | Over/Under | Market |
| **Round Robin** | *No direct equivalent* | ⚠️ US: a set of parlays from a pool. UK: a specific 10-bet ATC structure. **Do not translate these as equivalents** |
| **Teaser** | *No equivalent* | Parlay where you move the spread in your favour at reduced odds |
| **Pleaser** | *No equivalent* | The inverse: move the spread against yourself for enhanced odds |
| **If Bet** | Any To Come | Conditional sequencing |
| **Reverse Bet** | Up and Down / SSA | Two-way if-bet |
| **Prop Bet** | Special / Player Market | Market |
| **Futures** | Ante-post / Outright | Direct equivalent |
| **Juice / Vig** | Overround / Margin | Direct equivalent |
| **Chalk** | Favourite | Slang |

---

## 13. Modifiers & Promotions

These are **not bet types**. They attach to bets. Model them as flags or a modifiers array (§18).

### 13.1 Free bets

| Type | Behaviour | Value to punter |
|---|---|---|
| **Stake Not Returned (SNR)** | Returns = `stake × (odds − 1)`. The token itself is consumed | ~70–80% of face value when converted properly |
| **Stake Returned (SR)** | Returns = `stake × odds`. Behaves like cash | ~95%+ of face value |
| **Bet Credits** | Usually SNR; often restricted by market or minimum odds | Varies |
| **Bet Builder Token** | SNR, restricted to bet builders only | Materially lower — hard to hedge |
| **Acca Token** | SNR, restricted to multiples with minimum legs | Lower — hedging burden |

⚠️ Token restriction is the industry's primary counter-measure against matched betting. The trend is strongly toward restricted tokens.

### 13.2 Odds and price modifiers

- **Price Boost / Enhanced Odds** — operator raises the price on a selection. The core source of +EV plays.
- **Best Odds Guaranteed (BOG)** — racing. If SP exceeds your taken price, you are paid at SP. A free option on the upside.
- **Acca Boost / Acca Flex** — percentage uplift on winning accumulator returns, scaling with legs. Betfred's Acca Flex boosts winnings on a successful accumulator and refunds if a single leg fails.
- **Extra Places** — additional place terms on an each-way market beyond the industry standard. The highest-EV recurring offer type in racing.

### 13.3 Refund and insurance modifiers

- **Acca Insurance** — stake refunded (usually as a free bet) if exactly one leg loses
- **Bore Draw Money Back** — refund if the match finishes 0–0
- **Bet Builder Refund** — refund if a builder fails by a defined margin. Betfred runs regular promotions boosting or refunding losing builders on selected Premier League fixtures.
- **Risk-Free Bet** — first bet refunded if it loses
- **Early Payout / 2-Up** — bet paid out as a winner if your team goes two goals ahead, regardless of final result. Parimatch, running on BetVictor's platform, offers a 2 Up Early Payout feature.
- **Money Back If** — a catch-all family: money back if your horse falls, if a player is sent off, if it goes to extra time, etc.

### 13.4 Structural modifiers

- **Cash Out** — see §10.6
- **Each-Way** — see §4.2
- **Non-Runner No Bet** — see §4.3
- **Rule 4** — a deduction, not a promotion. See §14.3

---

## 14. Settlement Rules & Edge Cases

This section is the difference between a bet-tracking tool that works and one that quietly produces wrong P&L.

### 14.1 Void selections

A selection is void when the event doesn't happen, the participant doesn't take part, or the market is cancelled.

| Structure | Behaviour |
|---|---|
| **Single** | Stake returned. Settles at odds 1.0 |
| **Multiple** | Leg removed; bet reduces (fivefold → fourfold). **Some operators void the whole bet — verify per operator** |
| **Full cover** | Recursive reduction: Yankee with one void → Trixie plus dead lines |
| **ATC** | Downstream stakes recalculate. Genuinely complex |
| **Each-Way** | Both parts void |

### 14.2 Dead heat

Two or more selections tie for a position.

```
settled_stake = original_stake ÷ number_tied_for_position
```

The reduced stake is settled at **full odds**; the remainder is lost. This applies to win markets, place markets, and each-way place parts independently.

**Example:** £10 on a horse at 5.0 that dead-heats for a two-way win. Settled as £5 at 5.0 = £25 returned. Net +£15 instead of +£40.

### 14.3 Rule 4 deductions

When a horse is withdrawn after the market has formed but before the off, remaining bets are subject to a deduction proportional to the withdrawn runner's implied chance.

| Withdrawn horse's odds | Deduction from winnings |
|---|---|
| 1/9 or shorter | 90p in the £ |
| 2/11 to 2/17 | 85p |
| 1/4 to 1/5 | 80p |
| 3/10 to 2/7 | 75p |
| 2/5 to 1/3 | 70p |
| 8/15 to 4/9 | 65p |
| 8/13 to 4/7 | 60p |
| 4/5 to 4/6 | 55p |
| 20/21 to 5/6 | 50p |
| Evens to 6/5 | 45p |
| 5/4 to 6/4 | 40p |
| 8/5 to 7/4 | 35p |
| 9/5 to 9/4 | 30p |
| 12/5 to 3/1 | 25p |
| 16/5 to 4/1 | 20p |
| 9/2 to 11/2 | 15p |
| 6/1 to 9/1 | 10p |
| 10/1 to 14/1 | 5p |
| 14/1 or longer | No deduction |

⚠️ This table follows the standard Tattersalls Rule 4 scale. Confirm the current scale before implementing — it has been revised historically.

**Matched-betting impact:** Rule 4 applies at the bookmaker but **exchanges apply their own reduction factor**, and the two do not always match. This creates uncontrolled residual exposure on racing hedges. It is one of the main reasons racing matched betting carries more variance than football.

### 14.4 Palpable error

Operators reserve the right to void bets struck at obviously wrong prices. Relevant because "too good to be true" boosts sometimes are. Any tool tracking positions should support a manual void/adjust path.

### 14.5 Non-runner effects on place terms

If a field shrinks below a place-terms threshold before the off, place terms may change. Whether they change for already-struck bets is operator-specific. This directly affects extra-place matched-betting plays: your edge can evaporate between placement and off.

### 14.6 Maximum payout caps

Every operator caps payouts, typically by sport. Large full-cover and acca wins can hit the cap. A settlement engine that ignores caps will overstate returns.

---

## 15. Matched Betting: The Complete Picture

### 15.1 The core mechanic

Matched betting extracts value from bookmaker promotions by neutralising the outcome risk.

1. **Back** a selection at a bookmaker (where the promotion is)
2. **Lay** the same selection at an exchange (where the true price is)
3. Whatever happens, your position is approximately flat — the small difference is your **qualifying loss**
4. The promotion's value exceeds the qualifying loss. That difference is your profit

The mechanic requires the **exchange**, not the bookmaker's own exchange-branded sportsbook. Matched betting requires the Exchange, not the Sportsbook.

### 15.2 Why singles dominate

Every additional leg:
- multiplies the number of exchange positions you must hold
- multiplies the liquidity you must find
- introduces timing risk (you must be present when each leg starts)
- compounds the spread cost

Consequently, well over 90% of matched-betting volume goes through **singles** on liquid markets: football Match Odds, Over/Under 2.5 Goals, and horse racing Win.

### 15.3 The two-phase structure of most offers

**Phase 1 — Qualifying bet.** Place a real-money bet meeting the offer's conditions. Back and lay so the loss is minimal. Typical qualifying loss: 2–5% of stake on a tight market.

**Phase 2 — Free bet conversion.** Use the resulting free bet. Because SNR free bets return only the profit, you deliberately choose **higher odds** to maximise conversion.

```
Conversion rate = profit ÷ free_bet_face_value
```

A well-executed SNR conversion lands around 75–80%. Higher odds increase conversion but also increase liability and exchange spread cost, so there is an optimum — typically somewhere in the 4.0–8.0 range depending on market liquidity.

### 15.4 Extra places — the highest-value recurring play

An extra-place offer pays an additional place beyond standard terms (e.g. 5 places when the market pays 4).

**The play:**
1. Back each-way at the bookmaker with the extra place
2. Lay the **win** market at the exchange
3. Lay the **place** market at the exchange at standard terms

If your horse finishes in the extra place, the bookmaker pays your place part but the exchange place market settles as a loser — you collect the difference. Every other outcome is roughly neutral.

**Why it is the best repeatable play:**
- Positive EV on every qualifying selection, not just when the offer triggers
- Runs most Saturdays and every major festival
- Scales with bankroll

**Why it is difficult:**
- Requires place-market liquidity, which is thinner than win-market liquidity
- Non-runners change place terms (§14.5)
- Rule 4 mismatches (§14.3)
- Requires being present at the off across many races

### 15.5 Acca insurance

**The play:** place an acca where the bookmaker refunds your stake (usually as a free bet) if exactly one leg loses.

**Two approaches:**
- **Lay each leg sequentially** — after each leg wins, adjust the lay stake on the next. Correct, but requires attendance and carries interim risk
- **Lay the acca as a whole** at an exchange offering multiples — simpler, worse pricing

The EV comes from the refund probability. It is a genuinely profitable but operationally demanding offer type.

### 15.6 Early payout / 2-Up

**The play:** a bookmaker pays your team as a winner if they go two goals clear at any point. You back at the bookmaker, lay at the exchange, and the offer triggers whenever the 2-goal lead occurs — even if the final result differs.

**The maths:** the edge lives in the offer, not the hedging structure.

```
Edge per unit staked = (B × P_true) − 1
```

where `B` is the effective back odds including the early-payout option value and `P_true` is the genuine probability of the trigger occurring. Correlation between hedge legs affects **variance, not expected value** — a point that is widely misunderstood.

**Modelling requirement:** to price `P_true`, you need the probability of a team leading by two goals at *any point*, which is not derivable from full-time odds alone. A calibrated goal model (Dixon-Coles or similar), fitted from exchange odds and enumerated over goal sequences, is the standard approach.

### 15.7 Mug betting

Placing normal-looking recreational bets — small accas, cash-outs, in-play punts, occasional casino spins — to disguise the pattern of promotion-only betting.

**Why it matters:** stake limits ("gubbings") silently reduce your maximum bet, typically to £1–£10, and this affects most bookmaker accounts within 6–12 months. Being gubbed means you are no longer eligible for promotions on that account, and it can happen quickly as you work through sign-up offers.

Mug betting is where the exotic bet types in §6–§9 finally earn their place in a matched bettor's life: a Lucky 15, a Placepot, or a £2 Saturday acca is exactly what a recreational punter places, and exactly what an advantage player never would.

**Design implication:** a matched-betting tool should let users log intentional-loss mug bets **separately** from EV plays, or the P&L reporting becomes meaningless.

### 15.8 Dutching

Where no lay market exists — bet builders, some props, obscure markets — you can approximate a hedge by backing **all** outcomes across different bookmakers.

```
stake_i = total_stake × (1/odds_i) ÷ Σ(1/odds_j)
```

Guarantees an equal return on every outcome. Profitable only if the combined implied probability is below 1 (i.e. the combined overround is negative — an arb), or if a promotion makes it so.

### 15.9 Underlay and overlay

Rather than laying for an exactly equal outcome, you can deliberately skew:

- **Underlay** — lay less than the neutral amount. You profit more if the back wins
- **Overlay** — lay more. You profit more if the back loses

Both leave the same EV but change the distribution. Overlaying is common on free-bet conversions when you would rather realise profit at the exchange (where funds are liquid) than at the bookmaker (where they may be restricted).

### 15.10 The realistic constraints

| Constraint | Reality |
|---|---|
| **Gubbing** | Inevitable. Plan for account attrition |
| **Bankroll** | Exchange liability at high odds requires meaningful float |
| **Time** | Extra places and acca insurance demand presence at specific times |
| **Liquidity** | The binding constraint at scale |
| **Commission** | 2% vs 5% is a material long-run difference |
| **Tax (UK)** | Gambling winnings are not taxed in the UK. This is not tax advice — confirm your own position |
| **Diminishing offers** | Restricted tokens and bet-builder-only free bets are shrinking the extractable pool |

⚠️ Matched betting is a legal advantage-play technique, but it involves real money at real risk. Execution errors, void legs, and Rule 4 mismatches produce genuine losses. Anyone finding that betting has stopped being a calculated activity should step away and seek support — GamCare and BeGambleAware are the UK starting points.

---

## 16. Matched-Betting Utility Matrix

| Bet type | Layable? | Utility | Primary use in matched betting |
|---|---|---|---|
| **Single** | Yes | **High** | The workhorse. Qualifying bets, free bet conversion |
| **Each-Way Single** | Yes (two markets) | **High** | Extra-place offers — highest recurring EV |
| **Ante-post / Outright** | Partially | **Low–Medium** | Occasional boosts; capital-inefficient |
| **Double** | Yes (sequentially) | **Low** | Only when an offer requires 2+ legs |
| **Treble** | Yes (sequentially) | **Low** | Only when an offer requires 3+ legs |
| **Accumulator** | Sequentially, awkward | **Medium** *(with offer)* | Acca insurance, acca boosts |
| **Bet Builder** | **No** | **Low–Medium** | +EV plays on builder-specific offers; requires own model |
| **Bet Builder Acca** | **No** | **Low** | Rarely worth it |
| **Trixie / Yankee / Heinz / Goliath** | No | **None** | Mug betting only |
| **Patent / Lucky 15 / 31 / 63** | No | **None** | Mug betting only |
| **Round Robin / Flag / Alphabet / Union Jack** | No | **None** | Mug betting only |
| **Forecast / Tricast** | No | **None** | Mug betting only |
| **Tote / Placepot / Scoop6** | No | **None** | Mug betting; occasional guaranteed-pool promos |
| **Exchange Back** | n/a | **Medium** | Cross-exchange arbing, better-than-bookie prices |
| **Exchange Lay** | n/a | **Critical** | The hedging mechanism itself |
| **Cash Out** | n/a | **Low** | Usually −EV; useful for mug-bet appearance |
| **Spread Bet** | No | **None** | Unbounded downside; avoid |

---

## 17. Formula Reference

### 17.1 Odds and probability

```
implied_probability = 1 / decimal_odds
decimal_from_fractional = (numerator / denominator) + 1
overround = Σ(1 / odds_i) − 1
```

### 17.2 Multiples

```
acca_odds     = Π odds_i
acca_returns  = stake × acca_odds
compounded_margin ≈ (1 + m)^N − 1
```

### 17.3 Line counts

```
full_cover_no_singles(N)   = 2^N − N − 1
full_cover_with_singles(N) = 2^N − 1
flag(N)                    = full_cover_no_singles(N) + 2 × C(N,2)
combination_forecast(N)    = N × (N−1)
combination_tricast(N)     = N × (N−1) × (N−2)
```

### 17.4 Lay stake calculations

**Qualifying bet (or Stake-Returned free bet) — neutral lay:**
```
lay_stake = (back_odds × back_stake) / (lay_odds − commission)
```

**Stake-Not-Returned free bet — neutral lay:**
```
lay_stake = ((back_odds − 1) × back_stake) / (lay_odds − commission)
```

Where `commission` is expressed as a decimal (0.02 for 2%, 0.05 for 5%).

**Liability:**
```
liability = lay_stake × (lay_odds − 1)
```

**Profit if the back wins:**
```
profit = (back_stake × (back_odds − 1)) − liability
```

**Profit if the lay wins:**
```
profit = (lay_stake × (1 − commission)) − back_stake
```
(For an SNR free bet, drop the `− back_stake` term — the stake was never yours.)

### 17.5 Qualifying loss and conversion

```
qualifying_loss  = back_stake − guaranteed_return
conversion_rate  = free_bet_profit / free_bet_face_value
```

### 17.6 Dutching

```
stake_i = total_stake × (1/odds_i) / Σ(1/odds_j)
guaranteed_return = total_stake / Σ(1/odds_j)
```
Profitable when `Σ(1/odds_j) < 1`.

### 17.7 Expected value

```
EV_per_unit = (effective_odds × P_true) − 1
EV_total    = stake × EV_per_unit
```

For an unlaid price boost at odds `B` where the true price is `T`:
```
EV_per_unit = (B / T) − 1
```

### 17.8 Each-way returns

```
win_part_return   = stake × win_odds                       (if wins)
place_part_return = stake × (((win_odds − 1) × fraction) + 1)   (if placed)
```

### 17.9 Dead heat

```
settled_stake = original_stake / n_tied
return        = settled_stake × odds
```

### 17.10 Rule 4

```
net_winnings_after_r4 = gross_winnings × (1 − deduction_rate)
```
Deduction applies to winnings only, never to returned stake.

---

## 18. Data Model Recommendations

For anyone building a betting tracker, calculator, or sportsbook front end.

### 18.1 Core entity shape

```jsonc
{
  "id": "bet_01H...",
  "placed_at": "2026-08-06T14:22:00Z",
  "structure": "yankee",          // enum — see §18.2
  "each_way": false,
  "unit_stake": 1.00,
  "lines": 11,                    // derived, but store it
  "total_stake": 11.00,
  "legs": [
    {
      "event_id": "evt_...",
      "market": "match_odds",
      "selection": "Arsenal",
      "odds_decimal": 1.85,
      "status": "pending"         // pending | won | lost | void
    }
  ],
  "modifiers": ["free_bet_snr", "acca_insurance"],
  "bookmaker_id": "bk_...",
  "hedges": [
    {
      "exchange_id": "ex_...",
      "type": "lay",
      "market": "match_odds",
      "selection": "Arsenal",
      "odds_decimal": 1.90,
      "stake": 10.60,
      "liability": 9.54,
      "commission_rate": 0.02
    }
  ],
  "classification": "ev_play",    // ev_play | qualifying | mug_bet | arb
  "settled_at": null,
  "returns": null
}
```

### 18.2 Structure enum

```
single | each_way_single | outright
double | treble | accumulator | bet_builder | bet_builder_acca
trixie | yankee | canadian | heinz | super_heinz | goliath
patent | lucky_15 | lucky_31 | lucky_63 | lucky_127 | lucky_255
up_and_down | ssa | dsa | rounder | roundabout | round_the_clock
round_robin | flag | super_flag | heinz_flag | super_heinz_flag | goliath_flag
alphabet | union_jack
forecast_straight | forecast_reverse | forecast_combination
tricast_straight | tricast_combination
tote_win | tote_place | exacta | trifecta | swinger
placepot | quadpot | jackpot | scoop6
exchange_back | exchange_lay
spread_buy | spread_sell
```

### 18.3 Design principles

1. **Separate structure from market from modifier.** Non-negotiable — see §2.
2. **Store decimal odds only.** Convert at the display layer.
3. **Derive lines from structure + leg count**, but persist the value so historical bets survive rule changes.
4. **Model hedges as a first-class collection**, not a single field. Each-way requires two hedges; accas require one per leg.
5. **Classification field is essential for matched betting.** Mug bets must be excludable from performance reporting.
6. **Commission is per-account, per-market**, not global. Racing rates differ from football rates at some exchanges.
7. **Support partial settlement.** ATC bets and in-play cash-outs both need it.
8. **Void handling must be recursive** for full covers. Write tests for a Yankee with two voids.
9. **Track liability separately from stake** in all exposure calculations.
10. **Store place terms on the bet**, not by reference — terms can change after placement.

### 18.4 Navigation hierarchy — sportsbook pattern

```
├── Home
│   ├── In-Play
│   ├── Today's Featured
│   └── Boosts & Offers
├── Sports
│   ├── Football → Competitions · Bet Builder · Outrights
│   ├── Horse Racing → Racecards · Forecast & Tricast · Tote
│   └── [Other sports…]
├── Bet Types
│   ├── Singles → Win · Each-Way · Outright
│   ├── Multiples → Double/Treble/Acca · Bet Builder · E/W Multiple
│   ├── Full Cover
│   │   ├── Without Singles → Trixie · Yankee · Canadian · Heinz · Super Heinz · Goliath
│   │   └── With Singles → Patent · Lucky 15 · 31 · 63 · 127 · 255
│   ├── Any-To-Come → Up & Down · Round Robin · Flag family · Alphabet · Union Jack
│   └── Pool & Exotic → Forecast · Tricast · Placepot · Jackpot · Scoop6
├── My Bets → Open · Cashed Out · Settled
└── Account
```

### 18.5 Navigation hierarchy — matched-betting tool pattern

Offer-led rather than bet-type-led, because advantage players browse by *available edge*, not by structure.

```
├── Dashboard → Today's Actions · Live Positions · P&L Snapshot
├── Opportunities
│   ├── Early Payout (2-Up)
│   ├── Extra Places
│   ├── Price Boosts
│   ├── Acca Insurance
│   ├── Risk-Free / Reload
│   └── Sign-up Offers
├── Calculators
│   ├── Back/Lay → Qualifying · Free Bet SNR · Free Bet SR · Underlay/Overlay
│   ├── Each-Way → Extra Place · E/W Arb
│   ├── Multiples → Acca Lay · Acca Insurance · Bet Builder EV
│   ├── Dutching
│   └── Early Payout (goal model)
├── Bet Log → Open · Settled · By Offer Type · By Bookmaker
├── Bankroll → Bookmaker Balances · Exchange Balances · Reconciliation
├── Accounts → Bookmakers (limits, gubbing status) · Exchanges (commission)
└── Settings → Notifications · Preferences
```

**Navigation constraints:**
- Three levels maximum. Deeper belongs in filters.
- Bet type is a **cross-cutting facet**, not a branch under each sport — nesting it per sport duplicates the entire subtree.
- Collapse the ATC/Flag branch behind "More bet types". Low traffic, long list.
- Keep the full bet-type taxonomy in the **log/classification** layer of a matched-betting tool, not the primary nav.
- Progressive disclosure: hide Full Cover and ATC behind an "Advanced" toggle by default.
- Encode taxonomy in routes (`/bets/multiples/yankee`) for legible deep links and analytics.

---

## 19. Quick Reference Tables

### 19.1 Line counts at a glance

| Selections | No-singles full cover | With-singles full cover | Flag |
|---|---|---|---|
| 2 | 1 (Double) | 3 | 2 (Up & Down) |
| 3 | 4 (Trixie) | 7 (Patent) | 10 (Round Robin) |
| 4 | 11 (Yankee) | 15 (Lucky 15) | 23 (Flag) |
| 5 | 26 (Canadian) | 31 (Lucky 31) | 46 (Super Flag) |
| 6 | 57 (Heinz) | 63 (Lucky 63) | 87 (Heinz Flag) |
| 7 | 120 (Super Heinz) | 127 (Lucky 127) | 162 (Super Heinz Flag) |
| 8 | 247 (Goliath) | 255 (Lucky 255) | 303 (Goliath Flag) |

### 19.2 Popularity ranking (UK market)

| Rank | Method | Driver |
|---|---|---|
| 1 | **Single** | Dominant by bet count. Racing default, universal fallback |
| 2 | **Accumulator** | Dominant in football engagement. Low stake, lottery payout, heavily promoted |
| 3 | **Bet Builder** | Fastest-growing product; free-bet tokens increasingly issued as builder-only |
| 4 | **Each-Way** | Racing staple; golf and darts outrights |
| 5 | **Lucky 15** | Most popular full-cover bet by a wide margin |
| 6 | **Double / Treble** | Steady, unglamorous |
| 7 | **Yankee / Trixie / Patent** | Regular racing punters |
| 8 | **Forecast / Tricast** | Niche but persistent |
| 9 | **Flag / ATC / Union Jack / Alphabet** | Very low volume; legacy high-street products |

**Market context:** Football is the most bet-on sport in the UK, generating around £1.1bn in gross gambling yield, with roughly 5.8% of the population betting on it. British bettors wager more on football than any other sport, within an online betting market worth around £3bn in gross gambling yield annually.

⚠️ Precise share-of-turnover figures for individual bet types are not reliably published. Affiliate sites recycle unsourced numbers. The only credible sources are Gambling Commission returns and operator annual reports.

### 19.3 Minimum winners needed for a return

| Structure | Minimum winners |
|---|---|
| Single | 1 |
| Double / Treble / Acca | All |
| Bet Builder | All legs |
| Patent / Lucky family | 1 |
| Trixie / Yankee / Heinz / Goliath | 2 |
| Round Robin / Flag | 1 (via ATC components) |
| Union Jack | 3 (a complete line) |
| Alphabet | 1 (via Patent components) |

---

## 20. Glossary

**Acca** — accumulator.
**Ante-post** — a bet placed well before the event, usually with no refund for non-participation.
**Arb (arbitrage)** — a position guaranteeing profit regardless of outcome, from price discrepancies.
**ATC (Any To Come)** — conditional bet where returns fund a subsequent bet.
**Back** — betting on something to happen.
**BOG (Best Odds Guaranteed)** — racing promotion paying the better of your taken price and SP.
**Cash Out** — early settlement at an operator-computed price.
**Commission** — exchange fee on net winnings.
**CSF (Computer Straight Forecast)** — the formula deriving forecast dividends.
**Dead heat** — a tie, causing proportional stake reduction.
**Dutching** — backing all outcomes across bookmakers to guarantee a return.
**EV (Expected value)** — the average outcome of a bet over infinite repetitions.
**Each-Way** — a bet split into a win part and a place part.
**Exchange** — peer-to-peer betting marketplace.
**Free Bet SNR** — stake-not-returned free bet; returns profit only.
**Free Bet SR** — stake-returned free bet; behaves like cash.
**Gubbed** — restricted by a bookmaker; excluded from promotions and/or stake-limited.
**Lay** — betting on something not to happen.
**Liability** — maximum loss on a lay bet.
**Liquidity** — money available to match at a given price.
**Matched betting** — extracting promotional value by hedging outcome risk.
**Mug bet** — a deliberately recreational-looking bet placed to avoid detection.
**Overround** — the bookmaker's built-in margin across a market.
**Palpable error** — an obvious pricing mistake, voidable by the operator.
**Pari-mutuel** — pooled betting where the dividend depends on total stakes.
**Qualifying loss** — the small cost of placing the bet that unlocks a promotion.
**Rule 4** — deduction applied when a horse is withdrawn.
**SNR / SR** — stake not returned / stake returned.
**SP (Starting Price)** — the price returned at the off of a race.
**Spread** — (1) the gap between back and lay prices; (2) a betting product with variable stake and unbounded outcome.
**Underlay / Overlay** — deliberately laying less or more than the neutral amount.
**Void** — a bet or leg cancelled; stake returned.

---

## Appendix — Sources & Verification Notes

Time-sensitive material in this guide (commission rates, place terms, promotional structures, Rule 4 scale, bonus terms on Lucky bets) should be verified before commercial use. Recommended primary sources:

- **UK Gambling Commission** — industry statistics and operator returns
- **Operator T&Cs** — authoritative for place terms, void rules, payout caps, bonus structures
- **Tattersalls Committee** — Rule 4 deduction scale
- **Exchange fee schedules** — commission tiers change without much notice

Everything structural — line counts, composition, formulas — is arithmetic and stable.

---

*18+. Gambling should be an activity you can stop. If it isn't, GamCare (0808 8020 133) and BeGambleAware offer free, confidential support.*
