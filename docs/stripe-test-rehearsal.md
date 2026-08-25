# Stripe test details (localhost)

> Sam’s cheat sheet for Checkout on `:3000`. Not customer-facing.
> Live-mode rehearsal is [EDGE-7](https://linear.app/samhayter/issue/EDGE-7) later.
> Do **not** put secrets here. Offer: `docs/strategy/subscriptions.md`.

Last updated: **24 Aug 2026** (automated drill added).

---

## Automated webhook drill (EDGE-7 prep, 24 Aug)

`npm run billing:rehearsal` (from `edgeways/`) drives a throwaway test
customer through the whole lifecycle and verifies each webhook lands the
right Neon `app_users` entitlement — no clicking:

1. Create customer + Edge monthly with 14-day trial → `edge / trialing`
2. Attach test card, end trial early → `edge / active`
3. Downgrade to Core monthly → `core / active`
4. Upgrade back to Edge monthly → `edge / active`
5. Schedule cancel at period end (portal-style) → `cancel_at` set, still `edge / active`
6. Resume → `cancel_at` cleared
7. Cancel → `free / canceled` (subscription id retained for audit, trial and cancel_at cleared)
8. Refund the charge → entitlement untouched (`charge.refunded` is ignored by design)

Cleans up after itself (deletes the Stripe customer and the Neon row).
**Requires** `stripe listen --forward-to localhost:3000/api/billing/webhook`
running in another terminal (the `whsec_…` it prints already matches
`.env.local` while the CLI login stays the same). Last run 24 Aug: **11/11
PASS**. Catalogue audit the same day: all 5 test prices match
`stripe-prices.ts` and `.env.local` (ids, pence, intervals, founding flag).

Note: test mode has **no registered webhook endpoint** in the dashboard —
events only reach the app via `stripe listen` (localhost) until we register
an endpoint for the preview/production URL at go-live.

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

---

## EDGE-7: Sam's 15-minute click-through (test mode)

The drill above already proves the webhook → Neon entitlement machine. What
it cannot do is click hosted Checkout or the portal in a browser — that's
this list. ~15 min, one browser, `stripe listen` running so you can watch
events land (`--> checkout.session.completed … [200]`).

1. **Fresh sign-up → trial** (5 min)
   - In an incognito window: `/sign-up` with a new throwaway Google/email
     account → land on `/setup`.
   - Go to `http://localhost:3000/subscribe?plan=edge&interval=month`.
   - On hosted Checkout: card `4242 4242 4242 4242`, any future expiry, any
     CVC. Confirm **£0 today**, trial wording visible.
   - Success slip shows "Your 14 days start now" → **Set up the desk** →
     `/setup`.
   - Settings → Subscription shows **Edge · Trial** with an end date.
2. **Portal round-trip** (4 min)
   - Settings → Subscription → Manage → Stripe portal opens.
   - Update the card to `4000 0025 0000 3155` (3DS) or just view invoices;
     back out to Settings.
   - Cancel in the portal → Settings shows the cancelled/free state after
     the webhook lands (a few seconds). If the portal schedules the cancel
     for period end instead, Settings shows a **Cancelling** badge and the
     access-end date until then.
3. **Core paid path** (3 min)
   - `/subscribe?plan=core&interval=month` with the same account: charged
     **£9.99 today**, slip headline "Core is live", Settings shows Core.
4. **Decline path** (2 min, optional but cheap)
   - Start another Checkout with `4000 0000 0000 0002` → Stripe shows the
     decline on the hosted page; no entitlement change on our side.
5. **3DS path** (1 min, optional)
   - `4000 0025 0000 3155` → complete the fake 3DS challenge → succeeds.

If every step matches, test-mode EDGE-7 is done. What remains for the
**live** rehearsal at M3 (launch): recreate the 5 prices in live mode, set
live `STRIPE_*` env vars in Vercel production, register the live webhook
endpoint (`https://edgeways.app/api/billing/webhook`, events:
`checkout.session.completed`, `customer.subscription.created/updated/deleted`),
then re-run this list once with a real card and refund it.
