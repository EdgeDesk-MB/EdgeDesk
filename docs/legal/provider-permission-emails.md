# Provider contact — response templates (EDGE-45)

> **Status: unsent, on file.** Under D8 (`docs/decisions/d8-staged-licensing.md`)
> we do not ask providers for permission in advance. These templates exist so
> that if a provider ever makes contact, we reply within days: comply
> immediately, flip the feed to its degrade path, and open the licensing
> conversation from revenue. Context: `docs/decisions/d7-operator-held-feeds.md`,
> `docs/decisions/d8-staged-licensing.md`, `docs/legal/api-terms-review.md`.
>
> **Never offered, to any provider or customer:** subscribers entering their
> own keys (BYOK is rejected, D7). If a provider refuses a licence, we stay
> on that feed's degrade path.

## Contact log

| Provider | Contacted us | Via | Our reply sent | Outcome | Filed |
|----------|--------------|-----|----------------|---------|-------|
| The Racing API | ☐ | theracingapi.com contact / support | — | — | — |
| API-Football (API-Sports) | ☐ | api-football.com / dashboard support | — | — | — |
| Betfair / Flutter | ☐ | Developer Program → B2B data services | — | — | — |

---

## 1. The Racing API — reply to provider contact

**Subject:** Re: [their subject] — Edgeways data use

Hello,

Thank you for getting in touch, and apologies — I should have raised this
with you first.

To confirm the shape of the product: Edgeways (https://edgeways.app) is a
subscription web app that helps matched bettors track and analyse their own
betting activity. It never takes a wager and is not a bookmaker or betting
operator. I hold a paid Racing API subscription on my own account; my
server polls racecards/results, caches them, and shows that cached data to
subscribers inside the tracking product. Subscribers never see or hold a
key, and the data is not republished as a standalone feed.

Effective immediately I have [disabled the racing feed for subscribers /
scoped it back to ___] while we sort this out properly.

I would like to licence this use correctly rather than switch it off
permanently. Could you tell me:

1. Is operator-held, cached, in-app display to paying subscribers something
   you permit, and under which plan or agreement?
2. If yes, what conditions apply (attribution, tier, fees)?
3. If any part is not permitted, which part, so I can keep that scoped back?

Expected volume is modest: tens of subscribers today, low hundreds within a
year at most, and I will size the plan to actual usage.

Thanks for your time,
Sam Hayter
Edgeways — https://edgeways.app
samhayter.design@gmail.com

---

## 2. API-Football (API-Sports) — reply to provider contact

**Subject:** Re: [their subject] — Edgeways data use

Hello,

Thank you for getting in touch, and apologies — I should have raised this
with you first.

Edgeways (https://edgeways.app) is a subscription web app that tracks the
user's own betting activity; fixtures, live scores and results sit
alongside the user's tracked bets. It never takes a wager and no bet is
placed through it. I hold an API-Football plan on my own account; my server
polls once per fixture set, caches, and serves the cached data to
subscribers inside the app. Subscribers never see or hold a key.

Effective immediately I have [disabled the football feed for subscribers /
scoped it back to ___] while we resolve this.

I would like to licence this properly. Could you confirm:

1. Is operator-held, cached, in-app display to paying subscribers permitted
   under my subscription, or does it need a different agreement?
2. If additional licences are required (from you or from league/rights
   holders), which ones apply to this use case?

Expected volume: tens of subscribers today, low hundreds within a year at
most; I will keep the plan tier sized to actual usage.

Thanks,
Sam Hayter
Edgeways — https://edgeways.app
samhayter.design@gmail.com

---

## 3. Betfair / Flutter — licence path enquiry (only when funded)

> Betfair is different: we never fan out a personal key, and live pooled
> prices wait for a real licence (D8). This note goes out **only** when
> revenue funds it, or in reply if Flutter make contact first.

**Subject:** Correct licence path for operator-held Exchange data in a subscription app

Hello,

I run Edgeways (https://edgeways.app), a subscription web app that helps
matched bettors track and analyse their own betting activity. Edgeways
never takes a wager; users record and settle bets they have placed
themselves at bookmakers and exchanges.

I hold a personal Betfair developer account. I am **not** asking to fan out
a personal key — I understand that is prohibited, and my app does not do
it. I am asking which commercial path fits the product:

**Phase 1 — delayed data, operator-held.** My server would poll Betfair
Exchange data under my account (delayed prices are fine — matched betting
is pre-race), cache it, and show it to subscribers as odds context next to
their tracked bets. Subscribers never hold or enter a Betfair key, and the
app never places a bet on anyone's account.

**Phase 2 — live data, later.** If the product grows into live exchange
prices for subscribers, I expect that needs a Company Exchange Data
Licence, and possibly the Software Vendor Licence given the app is
distributed to other Betfair customers.

Could you confirm:

1. Is Phase 1 (operator-held, cached, **delayed** Exchange data shown to
   paying subscribers) permitted, and under which agreement?
2. Is the Vendor Services API / Software Vendor Licence the right frame for
   Phase 2, or should I talk to Flutter B2B data services about a Company
   Exchange Data Licence directly?
3. Roughly what fees and certification steps should I budget for each?

Expected subscriber volume is small (tens, low hundreds within a year).

Thanks,
Sam Hayter
Edgeways — https://edgeways.app
samhayter.design@gmail.com

---

## Degrade paths (already shipping)

Per D7/D8, the answer is never "customers paste their own key":

| Feed | Degrade plan |
|------|--------------|
| Racing feed | Racecards/results on demo fixture + manual settle; simulator stays the safety net |
| Football feed | Football on demo + manual settle (football is the secondary sport anyway) |
| Exchange feed | Paste odds / ORF estimates / no live lays — already the shipping state |
