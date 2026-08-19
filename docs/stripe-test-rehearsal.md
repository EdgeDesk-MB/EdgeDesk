# Stripe test details (localhost)

> Sam’s cheat sheet for Checkout on `:3000`. Not customer-facing.
> Live-mode rehearsal is [EDGE-7](https://linear.app/samhayter/issue/EDGE-7) later.
> Do **not** put secrets here. Offer: `docs/strategy/subscriptions.md`.

Last updated: **15 Aug 2026**.

---

## Before you pay

1. Desk server on `http://localhost:3000` (keep supervisor, do not start a second `next dev`).
2. Signed in (Clerk).
3. For EDGE-5 (tier write), in a **separate** terminal:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

4. Paste the `whsec_…` **this** listen prints into `edgeways/.env.local` as `STRIPE_WEBHOOK_SECRET`. Never commit it. Restart the desk server after changing it (Next only reads `.env.local` at boot).
5. `stripe login` must be the **Edgeways app** account (`acct_1U4fTB…`), not an older personal account. After you log in again, listen prints a **new** `whsec_`. The old one will 400 every event.

Dashboard test mode: [https://dashboard.stripe.com/test/payments](https://dashboard.stripe.com/test/payments).

---

## URLs

| What | URL |
|------|-----|
| Edge monthly (14-day trial, £0 today) | http://localhost:3000/subscribe?plan=edge&interval=month |
| Edge yearly | http://localhost:3000/subscribe?plan=edge&interval=year |
| Core monthly (charged today) | http://localhost:3000/subscribe?plan=core&interval=month |
| Core yearly | http://localhost:3000/subscribe?plan=core&interval=year |
| Success slip | `/subscribe/success?session_id=…&plan=…&interval=…` |
| After pay | **Set up the desk** → `/setup` |
| Manage / cancel | Settings → Subscription, or `/settings?tab=subscription` |

Cancel from Checkout returns to `/#pricing`.

---

## Card that succeeds

Use these on hosted Checkout. Any future expiry and any 3-digit CVC work.

| Field | Value |
|-------|--------|
| Card | `4242 4242 4242 4242` |
| Expiry | `12 / 34` (any future month / year) |
| CVC | `123` (any 3 digits) |
| Name | Anything |
| Postcode | `SW1A 1AA` (any) |

That is a Visa. Currency is GBP. Country can stay United Kingdom.

---

## Other useful test cards

| What happens | Number |
|--------------|--------|
| Succeeds (same as above) | `4242 4242 4242 4242` |
| Requires 3DS, then succeeds | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |

Full list: [Stripe test cards](https://docs.stripe.com/testing#cards).

Do not use a real card on test Checkout. Do not use these numbers on **live** Checkout.

---

## What you should see

**Edge trial:** Stripe green tick → our slip. Paid today **£0**. Then £24.99/mo (or £249.90/yr) after the trial. Headline: “Your 14 days start now”.

**Core:** charged today at list. Headline: “Core is live”.

Listen terminal: `checkout.session.completed` and `customer.subscription.updated` → **200**.

`app_users` after a good Edge pay: `plan = edge`, `billing_status = trialing`. Settings → Subscription should show **Edge · Trial**. Desk features are **not** locked yet (EDGE-22).

---

## Do not

- Reuse test Price IDs in live mode (recreate the catalogue before EDGE-7).
- Commit `.env.local`, `sk_`, `rk_`, or `whsec_`.
- Flip `SITE_SURFACE=app` or `LANDING_VARIANT=launch` on production for a local pay.
