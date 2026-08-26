# API provider terms review — redistribution & commercial use

> **EDGE-16 — reviewed 10 Aug 2026 against the providers' live terms pages.**
> Not legal advice; the launch-gate question is flagged for the solicitor pack
> (EDGE-8) and the pre-pooled-feeds permission emails are Sam's action.
> Sources: theracingapi.com/terms-of-service, api-football.com/terms,
> support.developer.betfair.com (Developer Program).

## The three scenarios this matters for

| Scenario | Description | Status |
|----------|-------------|--------|
| **A. Local-first personal** | Today's app: each install uses the owner's own API keys on their own machine | Current state |
| **B. Hosted, bring-your-own-key** | Subscribers enter their own provider keys | **Rejected 22 Aug 2026 (D7).** Not the product. |
| **C. Hosted pooled feed proxy** | Edgeways holds paid provider keys and serves the data to entitled subscribers (roadmap §7.2) | **The hosted product.** Customers bring money only. |

## Provider positions (quoted from current terms)

### The Racing API

- "The resale of data acquired directly from use of The Racing API service
  **without permission is forbidden**."
- "The Racing API's data, analysis and models are for use in the **creation of
  applications, websites, and data analysis** only."
- "Not permitted for use in any commercial or operational capacity by
  **betting operators and sportsbooks**." — Edgeways is neither (never takes a
  wager), but expect the question in any permission conversation.

**Reading:** A is today's personal desk. B is rejected (D7). C is the hosted
product and is resale-shaped: **written permission is a go-live item**
(EDGE-45), not optional later work.

### API-Football (API-Sports)

- "We do not provide a 'license' for the use and **publication** of the data…
  on applications, websites or any other products made by the user."
- Third-party IP (leagues/federations) is the **user's responsibility** to
  clear.
- "Use of our data for **betting platforms**, television broadcasting, fantasy
  sports platforms, or any mass media distribution **may require additional
  licenses** from the relevant rights holders."

**Reading:** A is fine. B is rejected (D7). C needs a written OK plus league
rights clearance. Football is still a secondary sport; if permission is
refused, ship football on demo + manual settle, do **not** fall back to
asking the customer for a key.

### Betfair Exchange

- "App Key generation is for **personal betting purposes only**. All data/API
  usage in any commercial context **must be approved by Betfair**. Unauthorised
  commercial usage will be identified & blocked."
- Delayed App Key: free, development/personal use, delayed prices (what we use).
- Live App Key: £499 activation, betting use.
- **Software Vendor Licence** (£1,499 + security certification): required to
  "provide software applications developed using the Betfair API to other
  Betfair customers" — which is exactly what a hosted Edgeways with exchange
  integration does, *even with BYOK*.

**Reading:** A is fine (today). B is rejected as a customer experience (D7)
and would still trigger the Vendor licence if we shipped it. C definitely
requires a commercial agreement. **Betfair is the strictest of the three:**
Sam's personal live key must not be fanned out. Until Flutter licenses C,
Edgeways ships without customer-facing exchange keys (paste / estimates /
no live lays).

## Conclusions

1. **Nothing blocks Sam's personal desk or the Free tier.** All three
   providers are fine with personal, own-key use on his machine.
2. **Hosted product is C, not B (D7, 22 Aug 2026).** Subscribers never enter
   provider keys. Sam holds the accounts; Edgeways proxies and caches.
3. **Pooled feeds launch without written permission (D8, 23 Aug 2026).**
   Supersedes the earlier ask-first framing: no permission emails are sent
   in advance. If a provider makes contact, we comply within days, degrade
   that feed (demo / paste / manual settle), and open the licence
   conversation from reserved revenue — reply templates in
   `docs/legal/provider-permission-emails.md`. Do not ask the customer for
   a key.
4. **Betfair is the hard one.** A personal live key must not be fanned out.
   Hosted exchange prices need a Flutter commercial path (Vendor and/or
   Company Exchange Data). Until that is signed, no customer-facing Betfair
   key field, and no live lays from Sam's personal key.
5. **The app already mitigates a refusal:** ORF-estimated odds, manual odds
   paste, and manual settlement mean Core features do not *require*
   redistributed provider data. Live feeds stay Edge-gated (N0).

## Betfair licence paths in detail (EDGE-14)

Betfair's own decision tree ("Which API Licence Do I Require?", Developer
Program) has exactly three lanes:

| Licence | Cost | What it covers | Edgeways fit |
|---------|------|----------------|--------------|
| **Personal betting** (Live App Key) | £499 one-off activation | The account holder's own live betting via API. **Read-only live keys are not permitted** | Sam's own desk only. Must not serve subscribers. |
| **Software Vendor Licence** | £1,499 + security certification | Distributing an API-built app to other Betfair customers; includes the Vendor Services API to manage/monetise user subscriptions | Needed if hosted Edgeways talks to Betfair at all. Does **not** let customers bring keys (D7). |
| **Company Exchange Data Licence** | Bespoke, via Flutter B2B data services | A company *using/redistributing* Betfair Exchange data | Operator-held pooled prices (D7 / §7.2). The path that matches the product. |

Hard facts that shape the architecture:

- **There is no cheap pooled-live-prices option.** One live key serving many
  users is precisely what "unauthorised commercial usage will be identified &
  blocked" targets, and read-only live keys are not permitted at all.
- **Delayed data stays free** (1–180s delay) and is the documented fallback in
  vendor apps for unfunded/restricted accounts — fine for pre-race matched
  betting, which is Edgeways' use case.
- The Vendor Services API exists to let vendors **monetise per-user
  subscriptions** — Betfair has already built the billing hook a hosted
  Edgeways Edge tier would want.

**Recommended path (D7):** customers never hold a Betfair key. Delayed
operator-held prices first, only if Flutter permits that use; live pooled
prices only after a Company Exchange Data Licence (and Vendor licence if the
app talks to Betfair at all). Until then: paste odds, estimates, or no live
lays. Cache aggressively; live-lay polling stays Edge-only (N0). Do not
ship a "paste your app key" field to paper over the licence gap.

## Actions

| # | Action | Owner | When |
|---|--------|-------|------|
| 1 | Email The Racing API + API-Football for written redistribution permission (operator-held pooled feeds) | Sam | Go-live path — EDGE-45. D6 is done. |
| 2 | Betfair hosted path: Flutter conversation for operator-held delayed, then data licence for live. No customer keys. | Sam | EDGE-14. D7 locked 22 Aug 2026. |
| 3 | Include this review + D7 in the solicitor pack | Sam | EDGE-8 |
| 4 | Free/Core stay on demo, paste odds, manual settle, simulator so quota is a plan gate, not a key-collection gate | Product rule (D7 + `docs/strategy/api-dependencies-and-tiers.md`) | Ongoing |
