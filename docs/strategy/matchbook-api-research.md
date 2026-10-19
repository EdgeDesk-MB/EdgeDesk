# Matchbook API research (EDGE-239)

> Research spike, desk research and public docs only. No code, no Matchbook
> account, no paid provider (NG9, PX3). Output is a roadmap section 9 entry
> (PX2). **Sam records the verdict**; this document only gives the evidence and
> a recommendation.

Last updated: **19 Oct 2026**.

---

## 1. Short answer

- The Matchbook API is real, documented, and open to any registered customer
  with their normal login. It covers prices, markets, bet placement, account,
  and settled bets (with commission). It is good enough technically for both
  ideas.
- **The blocker is not technology, it is data rights.** The Fair Usage Policy
  bars redistributing the API or "Matchbook Content" to any third party
  "without Matchbook's prior written consent". That is a hard line for a
  customer-facing pooled feed. It sits against D8 (comply-on-contact), which was
  built for providers with no explicit rule; Matchbook has one.
- **There is no "personal tool" inside a hosted multi-tenant product (D6).** Any
  Add bet button ships to every user's browser. A Sam-only version needs a
  per-user flag and Sam's credentials server-side, which is already a one-user
  version of the customer-facing problem.
- **Time-sensitive finding:** Sam's daily exchange, Betdaq, stops trading on
  **21 Oct 2026** (withdrawals open to 4 Nov, accounts do not transfer to
  Matchbook). The J9 extension supports Betdaq only. A Matchbook map for the
  extension is the cheapest in-guardrail response (see section 7).

Recommendation: **park the API ideas, promote only the extension map** (section
7). Details and the reasoning follow.

---

## 2. What the API offers

Source: developers.matchbook.com (Getting Started, Login, reference index,
`llms.txt`). REST, JSON or XML, HTTPS only.

| Need | Endpoint | Notes |
|------|----------|-------|
| Auth | `POST /bpapi/rest/security/session` | Username, password, optional MFA code. Returns a `session-token` (cookie or header). Session lives about 6 hours. **No API key, no OAuth, no app key.** |
| Navigate | Get Sports, Navigation, Events, Event, Markets, Market, Runners, Runner | Search and filter by sport, event, market. Needed to map a logged selection to a Matchbook runner id. |
| Prices | `GET .../events/{e}/markets/{m}/runners/{r}/prices` | `depth` (default 3), `price-mode` (expanded or aggregated), `odds-type`, `minimum-liquidity` (default 2), side filter, currency. Back and lay ladders. |
| Place bets | Submit / Edit / Cancel Offers (v2) | Fields: `runner-id`, `side` (back, lay, win, lose), `odds`, `stake`, `keep-in-play`. Responses carry offer status, matched bets, commission rates, `potential-profit`. Statuses include open, matched, flushed, failed, delayed. |
| Account | Get Account, Get Balance | Balance and account preferences (odds type). |
| History | Get Current Offers, Current Bets, **Get Settled Bets** (`/edge/rest/reports/v2/bets/settled`), Get Positions, Wallet Transactions | Settled bets return event, market, runner, side, odds, stake, result, `commission`, `profit-and-loss`, `net-profit-and-loss`, settled time. Filter by `after` and `before`. |
| Other | Heartbeat API | Keeps offers alive or cancels them if the client dies. |

Gaps in the public docs (could not confirm, do not assume):

- No streaming or websocket feed is documented; prices are polled.
- Whether standard-tier prices are live or delayed is not stated. Betfair's
  free tier is delayed; nothing equivalent is documented for Matchbook.
- Racing coverage and runner naming (for matching to The Racing API names) is
  untested. That needs a real account to check, so it cannot be done in this
  spike.

---

## 3. Cost, limits, approval

| Item | Finding | Source |
|------|---------|--------|
| Access | "Any registered Matchbook customer can begin using the API immediately using their standard login credentials." No approval step. | Pricing, FAQ |
| API fee | "Each set of 1 million GET requests in a calendar month will be charged at 100 GBP." Write requests "not chargeable" at reasonable frequency. Deducted automatically from the Matchbook balance. | Pricing |
| Free allowance | The pricing page does not state one. An older third-party article says accounts under 1,000,000 GETs a month are free. **Unverified, ask before relying on it.** | Pricing, third party |
| Higher limits | Upgrade to an API Plan (Trader or Commercial tier) by emailing api@matchbook.com. FAQ says upgrade before "significant API usage" to avoid rate limiting. | Pricing, FAQ |
| Rate limits (per account or IP, per minute) | Account 300, Events 700, Security 200, Navigation 100, Reports 40, Betting Write 3,000. | Fair Usage Policy 4.2, FAQ |
| Breach handling | 10 minute default block; access can be suspended or terminated "with or without notice" for persistent breaches. | Fair Usage Policy 5 |
| Commission (trading, not API) | Third-party reviews: flat 2% on net profit for UK and Irish customers, against Betfair's 5% base. One source says maker-taker; another 2.5% with volume discounts. **Check Matchbook's own commission page.** | Third party, conflicting |

Cost scale check: a store-first pooled price cache (HR5) polling a few hundred
racing runners would use far less than 1M GETs a month (1M a month is about 23 a
minute, well inside the 700 a minute Events limit). Even if charged, the first
million is £100 a month, which is above the CM1 COGS assumption of £2 to £6 a
month. So cost only works if there is a free allowance or revenue to fund it.

---

## 4. Terms of use

Verbatim or close paraphrase from the Fair Usage Policy (section 3.5):

- No use of the API for any purpose beyond the licence agreement.
- No selling, renting, leasing, sublicensing, **redistributing or syndicating the
  API or Matchbook Content to any third party without Matchbook's prior written
  consent.**
- No monitoring of competitors' products or benchmarking.
- Matchbook may monitor API use for compliance.

What it permits: the FAQ says customers "typically" use the API for automatic
trading bots and third-party sites for live pricing. So **a user's own
automation on their own account is expected use.** Matchbook's own account
terms for a third-party tool holding someone else's login were not reachable;
that is a gap.

Other terms found:

- The Matchbook 0% welcome offer (110 days, COMMFREE110) excludes sign-ups from
  Oddsmonkey, Outplayed and others, and excludes "customers who access
  Matchbook through an API or trading software". The separate Oddsmonkey 0%
  page (`/promo/0comms-om`) was JavaScript-rendered and could not be read, so
  its terms are not verified here. Commission promos are Sam's personal P&L
  matter, not a product input.
- Matchbook's page for the Oddsmonkey integration was also unreadable. The
  Oddsmonkey side is confirmed in section 5.

---

## 5. How Oddsmonkey integrates (what that proves)

- Oddsmonkey's OddsMatcher page says users can "integrate with Smarkets,
  Betfair, Matchbook and BetConnect to place your lay bets directly from the
  Oddsmatcher", with 1-click lay placement and no need to log into the exchange.
- Flow, from their Betfair and BetConnect guides: user links the exchange
  account inside Oddsmonkey, enters or authorises credentials, clicks a row,
  enters the back stake, bookie and exchange odds are pre-filled, and if the odds
  move the user is alerted and asked to confirm.
- **Inference, not confirmed:** Matchbook has no OAuth in its public docs, so
  Oddsmonkey must hold each user's Matchbook username and password (plus MFA
  handling) to place bets. That is a commercial arrangement (they list Matchbook
  as a partner) and probably involves terms Matchbook has not published.

What it tells us:

1. One-click lay placement from a tool is a normal, partner-supported pattern in
   this niche. It is not fringe.
2. It only works with user-held credentials. That is exactly the shape NG5/D7
   reject (see section 6).
3. Oddsmonkey is an oddsmatcher, so its integration sits on the discovery side
   that D2 and NG3 keep us out of. Ours would start from a bet the user already
   chose.

---

## 6. Options against the guardrails

Four options, because "pricing", "placement", "import" and "customer-facing"
are different risks.

### Option A. Lay price lookup for a selection the user already logged (read only)

Prices for the race or match on the Add bet screen, or as a second exchange on
the Racing Desk lay price.

| Guardrail | Standing |
|-----------|----------|
| NG1 / NG3 | **Clear if scoped.** Price lookup for one user-chosen selection is the Match Checker line. The moment it browses or ranks markets it becomes an oddsmatcher. Mapping a selection to a runner needs Get Events search, so the UI must stay "find this selection", never "list markets". |
| V2 | Clear. Read only, the user still logs the bet. |
| NG5 / D7 | Personal (Sam's login on the server): fine. Customer-facing: operator-held Matchbook account only, never a customer login field. |
| NG8 / D8 | Customer copy says "exchange feed". D8 comply-on-contact is **weaker here** because the FUP states a consent requirement up front (not silence), so the accepted-risk framing in RK3 is a worse bet than for providers without such a clause. |
| NG9 | Needs a Matchbook account (free, but still a new provider account). Sam would need to lift NG9 for this, or wait for a phase trigger. |
| NG10 | Not applicable (that is Betfair), but the same reasoning of not fanning out a personal key applies. |

Value: low today. Racing lay prices already come from Betfair delayed
(D9, EDGE-88). Reviews disagree on whether Matchbook racing liquidity is any
good, and Matchbook is usually described as a complementary exchange, not a
replacement. The Betdaq merger might help, but the evidence for that is
qualitative.

### Option B. One-click lay placement from Add bet (Sam only)

| Guardrail | Standing |
|-----------|----------|
| NG1 / NG3 | **Placement is not arbitrage or discovery** in itself, because the user picked the bet. It must stay one click per bet, with a visible confirm, no scheduled or rule-based placing. |
| V2 | **Ambiguous, needs Sam's call.** Placement then auto-logging records the true matched odds and stake, which helps Q3 (did it pay), and the J9 extension already shows Sam accepts execution help ("Fill only, you always place the bet yourself"). But the Exchange auto-import row was parked because logging "consciously" is the loop. Placing from Add bet is closer to the extension than to auto-import, but it is a step past the extension (which never places). |
| NG5 / D7 | Fails if built for anyone but Sam: needs a username and password per user, worse than an API key field. For Sam alone, secrets live in env, which is allowed only if the code path is gated to him. |
| NG8 / D8 | No exposure while it stays on Sam's own account (FUP allows own-account bots). |
| NG9 | Needs Matchbook account, funded. |
| Other | Money risk: a live write path to a funded account from a hosted multi-tenant app. HR1 and HR3 apply (exact stake maths). Failure modes (withdrawn horse, flushed offers, delayed status, odds moved) need a real design. |

Value: medium for Sam, zero for anyone else. Cost: a new surface that can lose
money, to save one click that the extension can already approximate.

### Option C. Settled-bet import for Matchbook (the Exchange auto-import analogue)

`Get Settled Bets` returns commission and net P&L, which would fill lay-side
settlement without typing. Technically the best-defined piece of the API.

| Guardrail | Standing |
|-----------|----------|
| NG5 / D7 | Needs the user's own Matchbook login, so customer-facing is out. Personal only. |
| V2 | Same objection that parked Betfair auto-import: it weakens deliberate logging. |
| NG8 / D8 | No redistribution (own data), so low exposure. |
| Compared with Betfair | Matchbook is simpler on auth (login, no app key, no OAuth, no delayed-key tier) but gives no OAuth-style delegated consent either. The Betfair ToS "proper read" is still outstanding; Matchbook's FUP is clearer. |

### Option D. Customer-facing (any of the above for paying users)

| Guardrail | Standing |
|-----------|----------|
| NG5 / D7 | **A works only through an operator-held account.** B, C, and any placement need each customer's Matchbook username and password, which NG5 forbids ("no customer API-key fields, ever"); a password is worse than an API key. |
| NG8 / D8 | A needs Matchbook's written consent, or an accepted C&D risk (RK3) that this time is stated in advance. |
| NG9 / CM1 | API fees and a new operator account before a phase trigger. |
| T1 | "Exchange integration" is already an Edge tier feature, so there is a commercial home for it, but only via a funded licence conversation. |

Conclusion for D: **not viable as designed.** Only operator-held read-only
pricing (Option A) is compatible, and it needs Matchbook's consent first.

---

## 7. Comparison with the parked Exchange auto-import (Betfair)

| | Betfair auto-import (parked) | Matchbook API |
|---|---|---|
| Auth | App key plus session; delayed key free, live key about £499 | Username and password plus optional MFA; no key, no tiers |
| Pricing data | Delayed ~1 to 3 min on free key; NG10 bars live pooled prices without a funded licence | Live or delayed not documented |
| Fees | Free delayed; £499 live | Per 1M GETs £100, free allowance unconfirmed |
| Redistribution | Needs a funded licence (D8, NG10) | Needs prior written consent (explicit in FUP) |
| Settled bets | Account API, ToS needs a proper read | Documented, with commission |
| Bet placement | Available | Available |
| Why parked or not | ToS, auth scope, V2 | Same V2 point; data rights are stricter; auth is simpler |
| Liquidity for racing | Best | Mixed reviews, merger effect unproven |

Net: Matchbook is easier to integrate than Betfair but no easier to *ship to
customers*. The V2 objection is identical.

### The extension (J9) is the cheap path

`extension/manifest.json` only matches `*.betdaq.com`, and the README says
"Betdaq first (Sam's daily exchange)". Betdaq stops trading **21 Oct 2026**.
Adding a Matchbook slip map to the extension:

- keeps "fill only, you always click the exchange's own confirm";
- needs no Matchbook API, no credentials, no redistribution, no account in the
  product (NG5, NG8, NG9 all clear);
- is already promoted work (J9, 2026-07-16), so it is a small follow-up, not a
  new idea.

It needs a Matchbook account on Sam's side to test selectors, which is Sam's
own betting account, not a provider account for the product.

---

## 8. Recommendation

1. **Park** Option A and D, status "Parked, under research (EDGE-239), verdict
   pending". Revisit only after a funded licence conversation and a verified
   free allowance. Ask Matchbook (api@matchbook.com) for: free GET allowance,
   whether standard-tier prices are live, and written consent terms for a
   pooled, delayed, display-only feed. Do that at the phase trigger, not now
   (NG9).
2. **Decide no, or park hard,** on Option B for customers. For Sam alone, it
   is only worth building if the extension proves too slow, and it needs an
   explicit V2 ruling.
3. **Park** Option C with the Betfair auto-import entry. Same reasons.
4. **Promote a small follow-up for Sam to approve:** Matchbook slip map for the
   J9 extension, given the Betdaq closure. This is a separate ticket (outside
   this spike).

---

## 9. Open questions for Sam

1. Is Betdaq to Matchbook your plan after 21 Oct? That decides how urgent the
   extension map is.
2. V2 ruling: is place-then-log from Add bet acceptable for you personally, or
   is "fill, then you click" the ceiling?
3. Are you willing to lift NG9 for a free Matchbook account to test pricing and
   racing liquidity? It would settle the live/delayed and liquidity unknowns.

---

## Sources

- Matchbook: [Getting started](https://developers.matchbook.com/docs/getting-started),
  [Login](https://developers.matchbook.com/reference/login),
  [Pricing](https://developers.matchbook.com/docs/pricing),
  [Fair Usage Policy](https://developers.matchbook.com/docs/fair-usage-policy),
  [FAQ](https://developers.matchbook.com/docs/faq),
  [Submit Offers](https://developers.matchbook.com/reference/submit-offers-v2),
  [Get Prices](https://developers.matchbook.com/reference/get-prices),
  [Get Settled Bets](https://developers.matchbook.com/reference/get-settled-bets-v2),
  [docs index](https://developers.matchbook.com/llms.txt)
- Betdaq acquisition (14 Oct 2026):
  [SBC News](https://sbcnews.co.uk/sportsbook/2026/10/14/matchbook-builds-on-prediction-markets-momentum-with-betdaq-takeover/),
  [European Gaming](https://europeangaming.eu/portal/latest-news/2026/10/15/216005/matchbook-acquires-betdaq-brand/)
- Oddsmonkey: [OddsMatcher](https://www.oddsmonkey.com/matched-betting/oddsmatcher-new/),
  [Betfair linking](https://www.oddsmonkey.com/blog/tools/linking-your-oddsmonkey-and-betfair-accounts/),
  [BetConnect guide](https://www.oddsmonkey.com/blog/matched-betting/the-oddsmonkey-guide-to-betconnect/)
- Commission and liquidity (third-party, qualitative, partly affiliate):
  [Extra Place](https://extraplace.co.uk/review/matchbook-review/),
  [BotBlog](https://botblog.co.uk/matchbook-vs-smarkets-vs-betdaq/)

Not read (JavaScript-rendered or unreachable): Matchbook's Oddsmonkey
integration page, Matchbook's Oddsmonkey 0% promo page, Matchbook's main account
terms. Findings that depend on them are marked as unverified above.
