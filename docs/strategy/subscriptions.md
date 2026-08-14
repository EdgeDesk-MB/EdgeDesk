# Subscription offer (locked 12 Aug 2026)

Canonical commercial offer for Edgeways. List prices and trial copy on the
**public homepage** come from here (and from `edgeways/src/lib/billing/public-offer.ts`
once that module exists). Processor choice (Stripe vs MoR) is EDGE-2 and does
not change these terms.

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

**VAT:** prices are GBP. Whether they include VAT depends on EDGE-2 (MoR vs
Stripe). Homepage copy can say “GBP” until L1 is recorded; do not invent
“inc VAT” until then.

**Elite** (direct exchange partner APIs) stays a later maybe. Not on the table.

---

## Founding (waitlist / invited beta)

Not a second public price list. Status on the **account**, shown in waitlist
thanks mail, beta invite, and a small in-app note.

**Term:** after the 14-day Edge trial, **three months of Edge billed at Core
price (£9.99/mo)**, then Edge at £24.99/mo.

**Who:** accounts created before a cut-off we set when beta opens (waitlist
email, invite, or first N). Core-only founders stay on Core at list. We are
not giving Core away.

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
| EDGE-21 | Launch landing **variant** (waitlist `/` stays default). Login CTA. Comparison table of the **public** offer. Subscribe CTA processor-agnostic until EDGE-4. |
| EDGE-3 | Catalogue: Free, Core monthly/annual, Edge monthly/annual, 14-day Edge trial, Founding Edge-at-Core for 3 months. |
| EDGE-4 | Checkout + portal honour trial then list or Founding. Receipt-printer success UX. |
| EDGE-5 | Webhooks write tier + trial/founding window onto `app_users`. |
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
  `edgeways/src/lib/billing/public-offer.ts`.
