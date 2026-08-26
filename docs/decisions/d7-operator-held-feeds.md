# D7 — Operator-held feeds

> Locked **22 Aug 2026**. Decision owner: Sam.
> Product rule: the customer brings money. Sam brings every provider account.

## The rule

Subscribers never buy, paste, or manage Racing API, API-Football, or Betfair
keys. Edgeways holds the keys, polls once, caches, and fans the data out to
entitled desks. The only thing a customer pays is the Edgeways subscription
(or uses the trial / Free tier).

**BYOK is not the hosted product.** It is not a launch fallback, not an
onboarding path, and not a sentence agents should offer.

This is roadmap §7.2 scenario C pulled forward from "later". D6 already
assumed a feed proxy. D7 forbids the BYOK alternative that
`docs/legal/api-terms-review.md` had kept as the "first hosted shape".

## What the customer sees

- Sign up, pay (or trial), use the desk.
- Fixtures, live scores, racecards, and (when licensed) exchange prices appear
  because their plan includes them, not because they configured a vendor.
- Settings may show feed health. It must not show a key field.

## What Sam owns

- Paid provider accounts sized for **pooled** use: API-Football **Pro**
  (~$19/mo, 7,500 req/day), not All-Sports ($99). Racing API Basic/Standard
  as the racecard/results contract needs.
- Quota, caching, and fail-soft when a provider dies (manual settle and the
  simulator stay as the safety net, not as "go get a key").
- Written redistribution permission before charging strangers for those
  feeds — [EDGE-45](https://linear.app/samhayter/issue/EDGE-45). D6 is done;
  this email is now on the go-live path, not optional later work.
- Betfair: operator-held data only under the correct Flutter licence (Vendor
  and/or Company Exchange Data). A personal live key must not be fanned out.
  Until that licence exists, ship without customer-facing exchange keys:
  paste odds, estimates, or no live lays. Never "bring your Betfair key".

## Cost model

Subscription revenue funds the keys. Gate live feeds by **plan** (N0: Edge
carries API cost), not by who pasted a secret. The existing §7.2 target
stands: one poller, cache per race/match, COGS in the low pounds per month
at tens of subscribers. Free/Core can stay on demo + manual settle to
protect quota. That is an entitlement decision, not a key-collection one.

## Agent rule

If a reply would say "bring your own key" or "subscribers enter provider
keys", stop. The hosted shape is operator-held keys + entitlement.
