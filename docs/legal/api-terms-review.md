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
| **B. Hosted, bring-your-own-key** | Subscribers enter their own provider keys; data flows provider → subscriber, Edgeways never stores or re-serves it | Likely first hosted shape |
| **C. Hosted pooled feed proxy** | Edgeways holds paid provider keys and serves the data to all subscribers (roadmap §7.2) | Later; **this is where terms bite** |

## Provider positions (quoted from current terms)

### The Racing API

- "The resale of data acquired directly from use of The Racing API service
  **without permission is forbidden**."
- "The Racing API's data, analysis and models are for use in the **creation of
  applications, websites, and data analysis** only."
- "Not permitted for use in any commercial or operational capacity by
  **betting operators and sportsbooks**." — Edgeways is neither (never takes a
  wager), but expect the question in any permission conversation.

**Reading:** A and B are fine (their data in our app is the sanctioned use).
C — serving pooled racecard/odds data to paying subscribers — is resale-shaped
and **needs written permission** first.

### API-Football (API-Sports)

- "We do not provide a 'license' for the use and **publication** of the data…
  on applications, websites or any other products made by the user."
- Third-party IP (leagues/federations) is the **user's responsibility** to
  clear.
- "Use of our data for **betting platforms**, television broadcasting, fantasy
  sports platforms, or any mass media distribution **may require additional
  licenses** from the relevant rights holders."

**Reading:** A and B are fine. C is two problems: their no-publication-license
stance needs a written OK, and league data rights sit with us to clear.
Football is a secondary sport for Edgeways — do not let it gate launch.

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

**Reading:** A is fine (today). B likely triggers the Vendor licence the moment
we distribute exchange-integrated software to Betfair customers. C definitely
requires a commercial agreement. **Betfair is the strictest of the three.**

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
| **Personal betting** (Live App Key) | £499 one-off activation | The account holder's own live betting via API. **Read-only live keys are not permitted** | Each subscriber's own key (BYOK) |
| **Software Vendor Licence** | £1,499 + security certification | Distributing an API-built app to other Betfair customers; includes the Vendor Services API to manage/monetise user subscriptions | Hosted Edgeways with exchange integration, BYOK |
| **Company Exchange Data Licence** | Bespoke, via Flutter B2B data services | A company *using/redistributing* Betfair Exchange data | Pooled live-price proxy (§7.2) — the expensive path |

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

**Recommended path:** Edge-tier exchange integration ships as **BYOK live key**
(subscriber pays their own £499 if they want live; delayed free key otherwise)
under a **Software Vendor Licence** once hosted. A pooled live-price proxy is a
Flutter B2B data-licence negotiation — treat as later/never unless subscriber
revenue justifies it. This keeps the ticket's design intent intact: cache
aggressively, live-lay polling stays gated to the top tier (N0 matrix already
puts `exchange_lay` in Edge only).

## Actions

| # | Action | Owner | When |
|---|--------|-------|------|
| 1 | Email The Racing API + API-Football for written redistribution permission (pooled subscriber feeds) | Sam | Before §7.2 feed proxy work — EDGE-45 |
| 2 | Decide Betfair path for hosted: Software Vendor Licence + BYOK (recommended) vs no exchange integration at v1 | Sam | With D6 (EDGE-18) |
| 3 | Include this review in the solicitor pack | Sam | EDGE-8 |
| 4 | Keep free-tier onboarding (paste odds, manual settle, simulator) as the default path so attrition never burns API budget | Product rule, already in `docs/strategy/api-dependencies-and-tiers.md` | Ongoing |
