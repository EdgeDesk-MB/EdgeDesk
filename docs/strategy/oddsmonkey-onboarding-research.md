# Oddsmonkey onboarding research — what we take, what we skip

> User research from Oddsmonkey’s hosted onboarding, checkout, dashboard,
> legal, affiliates and contact (screenshots 16 Aug 2026). They are a similar
> *niche*, not a similar *product*. They sell offer discovery plus live
> oddsmatching. We sell a desk for people who already have offers and have
> outgrown spreadsheets.
>
> **Not a copy job.** Steal the *questions*, not the chrome, not the
> “earn your first £100” funnel, not Gibraltar.
>
> Linear (M2 Beta): [EDGE-62](https://linear.app/samhayter/issue/EDGE-62) onboarding
> profile, [EDGE-63](https://linear.app/samhayter/issue/EDGE-63) empty-desk welcome,
> [EDGE-64](https://linear.app/samhayter/issue/EDGE-64) landing honesty,
> [EDGE-65](https://linear.app/samhayter/issue/EDGE-65) receipt date,
> [EDGE-66](https://linear.app/samhayter/issue/EDGE-66) contact + refund,
> [EDGE-67](https://linear.app/samhayter/issue/EDGE-67) referral codes,
> [EDGE-68](https://linear.app/samhayter/issue/EDGE-68) import from Oddsmonkey / Outplayed.

Last updated: **16 Aug 2026**.

---

## 1. Positioning (read this first)

Oddsmonkey can staff offer calendars, live chat 09:00–17:15 every day, and
matcher tools with live bookie/exchange prices. That workforce and those feed
contracts are their moat. Edgeways does **not** compete there at launch.

We **supplement** platforms like Oddsmonkey. Later, if Edge revenue funds it
and customers ask, product-roadmap §7.3 is the staged oddsmatching bridge.
Do not imply we send bookie offers. The launch FAQ already says we are not an
oddsmatcher; it still does not say we are not an offer feed ([EDGE-64](https://linear.app/samhayter/issue/EDGE-64)).

Their Starter / Advanced / Pro / Elite grid is a catalogue of *discovery*
tools (casino software, BOG matcher, EV finders, Steam Chaser). Ours stays
Free / Core / Edge as locked in `docs/strategy/subscriptions.md`. Do not add a
fourth public tier to look more like them.

---

## 2. Verdict per research point

| # | Oddsmonkey | Edgeways now | Do | Why |
|---|------------|--------------|----|-----|
| 1 | How did you hear about us? | Not asked | **Ship (EDGE-62)** | Cheap attribution. Optional skip. Reddit / Discord / Google / YouTube / Instagram / friend / other. |
| 2 | What’s your main goal? | Not asked | **Ship (EDGE-62)** | Spreadsheet breakdown will be the modal reason. Ask early. |
| 3 | Experience with matched betting | Not asked | **Ship (EDGE-62 + EDGE-64)** | Our users should be fairly advanced. Beginner option must say we do not supply offers. Expert: you’ll feel at home. |
| 4 | “What describes you best?” (preset £ bands) | Settings → monthly target, unused in setup | **Ship slider (EDGE-62)** | Capture the precise monthly goal. Show daily and yearly while they slide. Writes `monthlyProfitTarget`. |
| 5 | Four-tier matcher catalogue | Free / Core / Edge | **Keep ours** | Do not mirror their grid. Oddsmatching stays §7.3. |
| 6 | “Personalising your experience” (slow fake progress) | Finish → `/desk` | **Short real loader only** | One “Getting the desk ready…” while writes finish. No four-bar theatre. |
| 7 | How your free trial works + charge date | Slip says “then £24.99/mo, after the trial” | **Date on slip (EDGE-65)** | No extra trial screen. Show the calendar date Stripe already has. |
| 8 | Chargebee cart, US/AU address lookup | Hosted Stripe Checkout | **Keep Stripe** | Their checkout is worse. No work. |
| 9 | Welcome, Sam + Start Here / earn £100 | Empty desk: sim loop or “set up the desk” | **Ship (EDGE-63)** | Greet by name. Getting-started for *this* product. Do not touch filled-desk skeleton. |
| 10 | Gibraltar company, “aggregator of GC-licensed sites” | UK drafts, placeholders | **Stay UK** | Not a blocker. See §3. EDGE-15 is sole trader vs Ltd, not Gibraltar. |
| 11 | 14-day money-back after first payment | 14-day Edge trial + ToS 4.5 | **Public /refund (EDGE-66)** | Readable ToS, not a second goodwill window on top of a 14-day trial. |
| 12 | Privacy (DPA 1998 / Privacy Shield era) | UK GDPR draft, unpublished | **Publish ours (EDGE-61)** | Add onboarding answers + referrals to the draft. Their policy is not a model. |
| 13 | Affiliates, 40% recurring | Nothing | **Codes now (EDGE-67)** | Unique codes + Stripe coupons/credits before go-live. Full affiliate programme after revenue. |
| 14 | Contact + live chat 7 days | Email aliases exist, no page | **Public /contact (EDGE-66)** | Email + two working days. No live chat we cannot staff. |
| 15 | Export Data (profits CSV) | Generic E3 spreadsheet import only | **Ship dedicated importer (EDGE-68)** | Empty-Home CTA with their logo. Then Outplayed. Spec: `docs/strategy/platform-import.md`. |

Skip entirely: phone number collection (extra PII, no SMS product), copying
their experience smileys, copying “What describes you best?”, a fake
personalisation movie, live chat at launch, Gibraltar incorporation.

---

## 3. Gibraltar is not a blocker

Oddsmonkey’s Terms of Use: site operated by **Liquidity Trading Limited**,
Gibraltar company **122680**, registered office Madison Building, Midtown,
Queensway GX11 1AA. Footer: they act as an **aggregator of operator sites
which are licensed by the Gambling Commission**.

That shape is an *affiliate / discovery* business in the e-gaming cluster
(Gibraltar tax, remote-gambling neighbours, operator deep links). It is why
they collect phone numbers, run a 7-day trial then charge, and staff chat.

Edgeways is consumer software that never takes a wager, never holds betting
funds, and does not aggregate operator sites. The existing self-assessment
(`docs/legal/gambling-licence-assessment.md`) already says we must **not**
copy their aggregator line. Incorporating in Gibraltar would be expensive,
would not change UK consumer law for UK customers, and would look like we
were dodging the thing we are not even in. Stay UK. Company form is
[EDGE-15](https://linear.app/samhayter/issue/EDGE-15) (sole trader vs Ltd).

Their Privacy Policy still talks about the Data Protection Act 1998 and
Privacy Shield (invalidated). Ours is the better starting point. Publish it
([EDGE-61](https://linear.app/samhayter/issue/EDGE-61)); do not rewrite it
to match theirs.

Refund takeaway: they charge after **7** days, then offer **14** days
no-questions-asked on the first payment. We already give **14** days of Edge
for £0, which *is* the cooling-off window if they cancel in time. A public
`/refund` page should say that plainly. Do not add a second 14-day cash-back
after first payment unless Sam wants that support load.

---

## 4. Recommended first-run (hosted)

Keep `/setup` as one full page. Insert **four short questions** before the
existing bank step. Do not add a second wizard.

```text
Age gate (exists)
        │
        ▼
/setup  1. Experience with matched betting   ← comments per option
        2. Why you’re here                   ← spreadsheet first
        3. How did you hear about us?        ← optional skip
        4. Monthly profit target             ← slider, daily + yearly
        5. Bank (exists)
        6. Bookies (exists)
        7. Bet defaults (exists)
        8. Alerts (exists)
        │
        ▼
Short loader: “Getting the desk ready…”
        │
        ▼
Empty Home: Welcome, {name} + getting started + quick links
```

**Experience options (draft copy, not Oddsmonkey’s):**

| Option | Comment on the card |
|--------|---------------------|
| New to matched betting | Edgeways does not send you bookie offers. You still need a source of offers. This desk organises the work once you have it. |
| I match bets with spreadsheets or notes | This is why most people start an Edgeways account. |
| I already use a finder (Oddsmonkey, Outplayed, or similar) | We sit alongside those platforms. They find. We run the day. |
| I have been doing this a long time | You’ll feel at home. Calculators, execution, and what you kept. |

**Why you’re here (draft):** spreadsheets breaking down; missed steps or
expiry; unclear what I actually kept; one place for calculators and tracking;
other.

**Slider:** £0 to £2,000+, step £50 (or £25). Daily = monthly ÷ 30, labelled
“about £X a day”. Yearly = monthly × 12. Empty / £0 means no target (same as
Settings today). Writes `settings.monthlyProfitTarget`.

**Data split:** experience, why-here, attribution → Neon `app_users` profile
JSON + PostHog person properties (this is how we *learn*). Monthly target →
existing local settings (this is how the desk *paces*). Mention the profile
answers in the Privacy draft before collecting them.

**Welcome tour:** stop using the 4-step dialog as the default first-run for
hosted users. Empty Home is the welcome. Keep the tour in Help.

---

## 5. Empty desk (do not rebuild the app)

Filled Home stays the command centre. Only when
`shouldShowDashboardEmptyCta` is true and bank/bookies exist:

- Welcome, {Clerk first name}
- Cards: **Import from Oddsmonkey** (logo, EDGE-68), import a spreadsheet,
  log first bet / add an offer you already have, open calculators
- Desktop quick links: Calculators, Add bet, Offers, Accounts
- If setup is still missing, keep today’s “Set up the desk” empty

Not: “Earn your first £100”, training-centre completion bars, or a second
information architecture.

---

## 6. Referrals (pre-live) vs affiliates (later)

Oddsmonkey: 40% of subscription revenue, uncapped, dashboard, asset pack,
£3m paid. That is a financed affiliate operation.

**Before go-live ([EDGE-67](https://linear.app/samhayter/issue/EDGE-67)):**

- Unique code per user, shown in Settings
- Checkout `allow_promotion_codes`
- Referee (proposed, Sam to confirm): 50% off the first *paid* invoice after
  the 14-day trial
- Referrer: £9.99 Customer Balance credit after that first paid invoice, not
  at trial start
- Block self-referral (same user, customer, card fingerprint)

**After revenue:** revisit a real affiliate programme (payouts, tax,
self-billing, abuse). Do not build `/affiliates` marketing or Connect
payouts to ship the desk.

---

## 7. Support

[EDGE-34](https://linear.app/samhayter/issue/EDGE-34) already chose email
(`support@` / `hello@`). The gap is a public `/contact` page, not a widget.

Live chat at Oddsmonkey hours is a team. Best practice for a solo founder:
one inbox, a stated two-working-day reply, in-app feedback for product
bugs, billing queries in the same inbox. Crisp or Intercom can wait until
the inbox is the bottleneck.

---

## 8. Implementation order (before go-live)

Do not cut this in front of EDGE-58 (Settings manage billing), EDGE-61
(publish ToS/Privacy), or EDGE-22 (entitlement locks). Those remain the
gate. This work improves first-run *once the gate is in motion*.

| Order | Ticket | Effort | Notes |
|-------|--------|--------|-------|
| 1 | [EDGE-64](https://linear.app/samhayter/issue/EDGE-64) landing honesty | Small | Copy only. Unblocks the beginner conversation. |
| 2 | [EDGE-65](https://linear.app/samhayter/issue/EDGE-65) receipt date | Small | Uses Stripe `trial_end`. |
| 3 | [EDGE-66](https://linear.app/samhayter/issue/EDGE-66) `/contact` + `/refund` | Small | Pairs with EDGE-61 pages. |
| 4 | [EDGE-62](https://linear.app/samhayter/issue/EDGE-62) onboarding v2 | Medium | Schema + `/setup` screens + slider. |
| 5 | [EDGE-68](https://linear.app/samhayter/issue/EDGE-68) Oddsmonkey/Outplayed import | Medium | Blocked on Sam’s enum dump. Empty Home CTA. |
| 6 | [EDGE-63](https://linear.app/samhayter/issue/EDGE-63) empty-desk welcome | Medium | Includes the import tiles. |
| 7 | [EDGE-67](https://linear.app/samhayter/issue/EDGE-67) referral codes | Medium | Needs Sam’s sign-off on the 50% / £9.99 offer. |

Validate the new first-run with a stranger ([EDGE-33](https://linear.app/samhayter/issue/EDGE-33)),
not only Sam.

---

## 9. Sam decisions still open

1. Referee discount: 50% off first paid month, or something else?
2. Referrer credit: one Core month (£9.99) after first paid invoice, or
   extra trial days?
3. Company form (EDGE-15): sole trader vs UK Ltd. Gibraltar is off the table.
4. Public refund: statutory-only, or goodwill matching Oddsmonkey after
   they have already used a 14-day free trial? Recommendation: statutory-only.
5. Oddsmonkey import exactness: Sam will send a fuller profits CSV after
   filling the tracker with all record types. Not a blocker for the rest
   of first-run. See `docs/strategy/platform-import.md` §11.

*Not legal advice. Gibraltar / GC notes sit beside the self-assessment;
solicitor still only on trigger (EDGE-8).*
