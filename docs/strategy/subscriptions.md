# Subscription offer (locked 12 Aug 2026)

Canonical commercial offer for Edgeways. List prices and trial copy on the
**public homepage** come from here (and from `edgeways/src/lib/billing/public-offer.ts`
once that module exists). Processor is **Stripe direct** (L1, 15 Aug 2026, EDGE-2). VAT is not
included on the homepage until Sam registers. Does not change these terms.

Roadmap matrix (what each tier includes): `edgeways/docs/roadmap/product-roadmap.md` §7.5
and `edgeways/src/lib/entitlements/plans.ts`.

Linear: [EDGE-3](https://linear.app/samhayter/issue/EDGE-3) products,
[EDGE-4](https://linear.app/samhayter/issue/EDGE-4) checkout,
[EDGE-21](https://linear.app/samhayter/issue/EDGE-21) landing + login,
[EDGE-22](https://linear.app/samhayter/issue/EDGE-22) enforcement.

---

## Public offer (homepage)

Show these on the launch landing. Do not put Founding or feedback credits on
the public cards. If the homepage says early adopters pay less, everyone waits.

| Tier | Monthly | Annual (≈ 2 months free) | Role |
|------|---------|--------------------------|------|
| **Free** | £0 | — | Calculators, manual log, basic P&L, demo Racing Desk |
| **Core** | £9.99 | £99.90/yr | Pipeline, Do Next, Daily Plan, Edge Report, tracker, free-bet lots. Near-zero COGS. |
| **Edge** | £24.99 | £249.90/yr | Offer Edge / race picks, live racing feeds, 2UP + push, exchange lay. Carries API cost. |

**Trial (everyone, one per person):** 14 days of **Edge**, then they choose Core
or Edge at list price (or Founding, if the account qualifies). Cancel before
day 14 and they are not charged. Aligns with the UK 14-day cooling-off window
in the ToS draft.

**VAT:** prices are GBP, tax exclusive in Stripe until Sam registers. Homepage
says “Prices in GBP”. Do not invent “inc VAT”.

**Elite** (direct exchange partner APIs) stays a later maybe. Not on the table.

---

## Founding (waitlist / invited beta)

Not a second public price list. Status on the **account**, shown in waitlist
thanks mail, beta invite, and a small in-app note.

**Term:** after the 14-day Edge trial, **three months of Edge billed at Core
price (£9.99/mo)**, then Edge at £24.99/mo.

**Who:** confirmed waitlist emails (still subscribed). Match the Clerk account
email at Checkout. Empty waitlist at launch is fine: Founding simply does not
apply. `?founding=1` stays as a test/invite override. Core-only founders stay
on Core at list. We are not giving Core away.

**Do not:** lifetime discount, “free until launch”, or stack this with a
sitewide £9.99 first month on every plan.

---

## Feedback thank-you (beta only)

In-app product feedback (already files to Linear). Not public reviews.

- **Once per person:** one extra month of their then-current paid or Founding
  term, if the feedback is used or they complete a structured beta pass
  (EDGE-33).
- **Grant, do not automate** on every submit. Cap is one. Flag on `app_users`.
- Do not trade subscription credit for Trustpilot / Google reviews without
  disclosure.

---

## How this maps to tickets

| Ticket | What it owes this offer |
|--------|-------------------------|
| EDGE-21 | Launch landing **variant** (waitlist `/` stays default). Login CTA. Comparison table of the **public** offer. Subscribe now hits `/subscribe` (EDGE-4). |
| EDGE-3 | Catalogue: Free, Core monthly/annual, Edge monthly/annual, 14-day Edge trial, Founding Edge-at-Core for 3 months. **Done 15 Aug 2026** in Stripe test mode (see below). |
| EDGE-4 | Hosted Checkout + still thermal slip + portal (cancel / invoices / card / Core↔Edge). Waitlist email gets Founding on Edge monthly. Live catalogue still empty. |
| EDGE-5 | Webhooks write tier + trial/founding window onto `app_users`. **Done locally 15 Aug.** |
| EDGE-58 | Settings → Subscription: plan, trial, **Manage billing** (Stripe portal). Go-live must. Clerk is identity only. |
| EDGE-22 | Desk reads Neon tier (including trial = Edge, Founding = Edge). Settings preview is not the live gate. |
| EDGE-2 | Processor only. Does not change prices or Founding. |

`SITE_SURFACE=waitlist` still blocks `/desk` on production until beta desk is
ready. A signed-in Free user on a future app surface sees upgrade, not the
full desk (soft gate; real feature locks are EDGE-22).

---

## Homepage versions

Iterate landings. Do not silently replace the live waitlist page.

- Production `/` stays the waitlist until we flip `LANDING_VARIANT=launch`
  (or promote a preview).
- Launch variant: Login + public pricing table + Subscribe stub. Waitlist
  form can remain as a secondary “get founding” path until invites go out.
- Code: `LANDING_VARIANT=waitlist|launch`, prices in
  `edgeways/src/lib/billing/public-offer.ts`. Stripe IDs in
  `edgeways/src/lib/billing/stripe-prices.ts`.

---

## Stripe test catalogue (15 Aug 2026)

Account `acct_1U4fTBCOWjjJHXGs`, **livemode false**. One Product per plan.
Trial is Checkout `subscription_data.trial_period_days = 14` on Edge, not a Price.
Do not look for a Trial product in the Stripe catalogue. Price-level trials are
deprecated and Checkout ignores them.

Customer Portal (test): `bpc_1U4fynCOWjjJHXGspM7CqwNq` (cancel at period end,
invoices, payment method, name/email). Upgrade/downgrade is on: Core and Edge
list prices only (month/year). Founding is not in the portal catalogue.
Downgrades and year→month wait until period end. Quantity is locked.
Waitlist Founding: if the signed-in email is on the confirmed waitlist,
`/subscribe?plan=edge&interval=month` uses the founding price, 14-day trial,
then a 3-month schedule, then Edge list. `?founding=1` is a test override.

| Slot | Product | Lookup key | Amount | Price ID |
|------|---------|------------|--------|----------|
| Core monthly | `edgeways_core` | `core_month` | £9.99 | `price_1U4fVhCOWjjJHXGslhoF9ruI` |
| Core annual | `edgeways_core` | `core_year` | £99.90 | `price_1U4fViCOWjjJHXGs07dyqGvn` |
| Edge monthly | `edgeways_edge` | `edge_month` | £24.99 | `price_1U4fVjCOWjjJHXGsM3Pj2Rr8` |
| Edge annual | `edgeways_edge` | `edge_year` | £249.90 | `price_1U4fVjCOWjjJHXGsotdJZ05Q` |
| Edge founding monthly | `edgeways_edge` | `edge_founding_month` | £9.99 | `price_1U4fVkCOWjjJHXGsXGvcKoqq` |

Env map: `edgeways/.env.example`. Local and Preview stay on these test IDs.

Local pay how-to (cards, listen, URLs): `docs/stripe-test-rehearsal.md`.

## Stripe live catalogue (19 Aug 2026)

Account `acct_1U4fTBCOWjjJHXGs`, **livemode true**. Same product IDs and lookup
keys as test. Price IDs are new. Do not put these in `.env.local`.

| Slot | Product | Lookup key | Amount | Price ID |
|------|---------|------------|--------|----------|
| Core monthly | `edgeways_core` | `core_month` | £9.99 | `price_1U66r5COWjjJHXGsSS2BEYBI` |
| Core annual | `edgeways_core` | `core_year` | £99.90 | `price_1U66r6COWjjJHXGsZbrCOCdx` |
| Edge monthly | `edgeways_edge` | `edge_month` | £24.99 | `price_1U66r7COWjjJHXGsaS2Ni8re` |
| Edge annual | `edgeways_edge` | `edge_year` | £249.90 | `price_1U66r8COWjjJHXGs7weU17vH` |
| Edge founding monthly | `edgeways_edge` | `edge_founding_month` | £9.99 | `price_1U66r9COWjjJHXGsPrEen3Rt` |

Live Customer Portal is still empty. Create it in the Dashboard (live mode)
to match test: cancel at period end, Core↔Edge list prices only, quantity
locked, downgrades at period end. Then paste `STRIPE_PORTAL_CONFIGURATION_ID`
into Vercel Production only.
