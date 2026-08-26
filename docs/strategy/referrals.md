# Referral strategy

> Drafted 26 Aug 2026. Feeds EDGE-67 (codes MVP) and the post-revenue
> affiliate decision. Commercial terms interact with
> `docs/strategy/subscriptions.md` — that file stays canonical for prices,
> trial and Founding.

## Why referrals carry this product

Betting-adjacent products cannot buy the normal channels. Google and Meta
gambling-ad policies make paid acquisition effectively unavailable at our
scale, and SEO takes a year. What remains is the community itself:
r/MatchedBettingUK, the Discord servers, and "what tool do you use?" threads
that run weekly. Word of mouth is not a nice-to-have channel for Edgeways —
it is *the* channel. A referral code turns that channel from "search for
Edgeways" into a trackable, incentivised link your happiest users can drop
into a thread in five seconds.

Oddsmonkey proves the ceiling of this motion: 40% recurring affiliate
commission, uncapped, with a dashboard and asset pack — a financed affiliate
operation that has paid out millions. We are not that (payouts, tax,
self-billing, Connect, abuse desk). But it proves the community shares links
when there is something in it for them.

## The offer (EDGE-67 MVP)

**Double-sided, one-time, non-cash:**

- **Referee:** 50% off the first *paid* invoice after the 14-day trial
  (Stripe coupon, `duration: once`, mapped to a personal promotion code).
- **Referrer:** £10 flat credit to their Stripe Customer Balance —
  tier-agnostic (works the same for Core and Edge referrers), granted only
  when the referee's first paid invoice succeeds, never at signup or trial
  start.
- **Abuse blocks:** same Clerk user, same Stripe customer, same card
  fingerprint → no credit. One qualifying credit per referee.

Total acquisition cost per converted referral: ~£15 (Core referee) to ~£22.50
(Edge referee) of *foregone revenue*. Zero cash leaves the business.

## Why this shape wins

**Why 50% off the first paid invoice — not a free month.** The trial already
gives 14 days of Edge free. A free first month after a free trial blurs into
"free until whenever" and pushes the first payment signal to day 44 — you
learn nothing about willingness to pay until six weeks in. 50% off preserves
the payment event on day 14: a card is charged, real money moves, the
customer has skin in the game. Someone who pays £4.99 is a customer; someone
who pays £0 is still a trialist. And because it is `duration: once`, there is
no forgotten lifetime-discount tail.

**Why the referrer credit is balance, not cash.** Cash payouts make you an
affiliate programme with tax and abuse obligations. A balance credit can only
ever be spent on Edgeways — which means the referral reward doubles as a
retention mechanic: a founding member sitting on £30 of credit does not
churn. It also keeps CAC as foregone revenue rather than cash, which matters
while revenue is thin.

**Why the credit waits for the first paid invoice.** This is the farming
killer. If credit landed at signup or trial start, throwaway accounts with
disposable emails could farm it. Requiring a real card to be charged first
means every credit corresponds to a real paying human.

**Why not 40% recurring (yet).** On an Edge sub that is £10/mo *forever* —
£120/yr per referred customer, uncapped. Our one-off ~£15–22.50 is an order
of magnitude cheaper per acquisition. Recurring commission only makes sense
when revenue funds it and an abuse desk exists. Revisit at ~£1k MRR sustained;
a sane version might be 20–30% for 12 months, capped.

## Interaction with Founding (beta cohort)

Founding (locked in `subscriptions.md`): after the 14-day Edge trial, three
months of Edge at Core price (£9.99/mo), then Edge at list. Plus the
once-per-person feedback thank-you month, granted manually.

Rules for the overlap:

1. **Founding members get their referral code from day one.** They are the
   most motivated evangelists you will ever have — the beta cohort IS the
   seed of the referral graph.
2. **No stacking.** The referral 50% applies to list-price checkouts only. A
   referee who is themselves on the Founding schedule already has the better
   deal (Edge-at-Core for 3 months beats 50% off one month) — the code still
   earns the *referrer* their credit.
3. **Founding status is never public pricing** (subscriptions.md rule). Codes
   are the only discount a stranger will ever see.

What else founders get that costs nothing: founding status shown on the
account, the feedback thank-you month, and first-call on the referral graph
they are building. Do not add lifetime discounts (explicitly ruled out in
subscriptions.md).

## Expected impact, honestly

- Community-driven products with double-sided referral incentives typically
  see referrals drive a meaningful minority of signups; single-sided
  (referrer-only) underperforms badly — the referee needs a reason to bother
  typing the code. Hence double-sided.
- Codes will leak to coupon threads. That is fine: a leaked code still
  requires a real card charge to pay out, and a sign-up at 50% off one month
  is a sign-up we wanted anyway.
- The metric that matters is not shares — it is **referred paid conversion
  vs organic**. PostHog events (`referral_shared`, `referral_redeemed`,
  `referral_credited`) give us that funnel from day one.
- Watch the **outstanding credit liability** (sum of unredeemed balance
  credits). It is foregone future revenue; keep it visible in /admin.

## Programme phases

| Phase | When | Shape |
|---|---|---|
| **1. Codes MVP** | Before beta (EDGE-67) | Double-sided, one-time, balance credit. Every account gets a code. |
| **2. Measure** | Beta → launch | PostHog funnel; learn share rate, redemption, paid conversion. No changes until data. |
| **3. Affiliate programme** | ~£1k MRR sustained | Revisit recurring commission (20–30% / 12 mo capped, not 40% forever), payouts, tax, abuse desk. Not before. |

## Done-when for the MVP

A test user copies a code; a second test customer redeems it at Checkout;
the referee's first paid invoice is discounted 50%; the referrer's balance
shows £10; self-referral is rejected. Then the beta plan (EDGE-29) puts
codes in real hands.

## Build status (26 Aug 2026)

Built and tested locally (419/419 vitest, tsc clean):

- `app_users` gains `referral_code`, `referred_by`, `referral_credit_at`
  (SQLite `addColumn` + Neon lazy `ALTER TABLE`, same pattern as `role`).
- Codes are anonymous `XXXX-XXXX` (e.g. K7Q2-9XTM) — no name or email
  fragment, because matched betters operate in disguise. Lazy-created on
  first visit to Settings → Subscription, mirrored to Stripe Promotion
  Codes on the referral coupon. Test coupon: `dtyVuJTm`
  (`STRIPE_REFERRAL_COUPON_ID`).
- `?ref=CODE` threads sign-up → `/subscribe` or `/setup`; the claim is
  stored server-side on arrival (`referred_by`, first claim wins).
- Webhook `invoice.paid`: first non-zero paid invoice grants the referrer
  a −£10 customer-balance credit (tier-agnostic flat credit). Promo code on
  the invoice wins over `referred_by` for attribution. Abuse blocks: self,
  same Stripe customer, same card fingerprint, one credit per referee.
- PostHog: `referral_shared` (copy click), `referral_redeemed` (claim),
  `referral_credited` (webhook, server-side capture).

## Smoke test runbook (local, test mode)

Run after work with the dev server up (`npm run dev:detached` from
`edgeways/`) and `stripe listen --forward-to localhost:3000/api/billing/webhook`
running in a second terminal (paste the `whsec_…` into `.env.local` as
`STRIPE_WEBHOOK_SECRET` if not already there). Use two browsers/profiles so
Clerk sessions don't clash: your normal browser for account A, an incognito
window for account B.

**1. Account A gets a code**

1. Sign in as A → Settings → Subscription.
2. "Refer a friend" panel shows an anonymous code (e.g. `K7Q2-9XTM`).
3. Click **Copy referral link** → toast confirms; clipboard holds
   `http://localhost:3000/sign-up?ref=CODE`. (PostHog: `referral_shared`.)
4. In the Stripe dashboard (test mode) → Products → Coupons →
   `dtyVuJTm` → the matching promotion code appears under it.

**2. Account B redeems it**

1. Incognito: paste the link, sign up as B (different email).
2. You land on `/setup?ref=CODE` (free path) or `/subscribe?…&ref=CODE`
   (paid path) — either way the claim is stored server-side.
   (PostHog: `referral_redeemed`.)
3. B subscribes: Settings → Subscription → a plan CTA, or visit
   `/subscribe?plan=core&interval=month`. At Stripe Checkout, click
   **Add promotion code**, enter A's code → 50% off line appears.
4. Complete checkout with test card `4242 4242 4242 4242`, any future
   expiry/CVC. B is now trialing.

**3. First paid invoice → A gets the credit**

The credit fires on B's first **paid** invoice (trial end), not at trial
start. To avoid waiting 14 days, use a Stripe test clock:

1. Dashboard (test mode) → Subscriptions → B's subscription →
   **Actions → Advance test clock** (or create the subscription attached
   to a test clock via the CLI: `stripe test_clocks create --name ref-smoke`
   and pass `--test-clock` when creating the customer).
2. Advance past the trial. Watch the `stripe listen` terminal: an
   `invoice.paid` event arrives with `amount_paid` = 50% of the plan.
3. Dashboard → Customers → A's customer → **Balance** shows
   −£10.00 (a credit that applies to A's next invoice).
   (PostHog: `referral_credited`.)

**4. Abuse checks**

- B tries to claim their own code: `POST /api/referrals/claim` returns
   `409 { status: "self" }` (or just note no credit appears if B subscribes
   with their own code in the promo box — the webhook blocks it).
- B cancels and resubscribes: no second credit (`referral_credit_at` is set).

**If something's off:** `stripe listen` shows whether `invoice.paid`
arrived; the dev server log prints `[billing/webhook] referral credit` on
any grant failure and `[referrals] …` for promo-code issues. The decision
logic is unit-tested in `src/lib/referrals/credit-decision.test.ts`.

### Go-live checklist (not done — needs live mode)

1. Create the live coupon: 50% off, duration `once`, name "Referral — 50%
   off first paid month". Set its ID as `STRIPE_REFERRAL_COUPON_ID` in the
   Vercel **production** env (the test ID stays for local/preview).
2. Live webhook endpoint: add `invoice.paid` to the subscribed events
   (local `stripe listen` already forwards everything).
3. Smoke pass with two live test customers per the done-when above.
