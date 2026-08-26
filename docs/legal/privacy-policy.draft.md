# Edgeways — Privacy Policy

> **Published 17 Aug 2026 (EDGE-61); storage sections rewritten 26 Aug 2026
> (EDGE-92) for the hosted Neon desk.** Customer page: `/privacy`. Sam read
> 16 Aug (EDGE-12). Solicitor (EDGE-8) before charging strangers. Not legal
> advice. Payments are Stripe direct (EDGE-2). Hosting is Vercel (EDGE-46),
> database is Neon Postgres in AWS eu-west-2 (London).
> ICO fee: retake self-assessment when trading starts (EDGE-9).

**Effective date:** 26 August 2026
**Controller:** Sam Hayter trading as Edgeways ("we", "us")
**Contact:** support@edgeways.app
**ICO registration:** Not yet required. We will register when we start trading
and add the number here.

## 1. The short version

**Edgeways is a hosted desk: your betting records live in our database, tied
to your account.** Your bets, balances, offers, and analytics are stored in a
Postgres database hosted by Neon in the UK (London), so your desk is the same
on every device you sign in from.

We do not sell your data, profile your betting behaviour for advertising, or
share your records with bookmakers, exchanges, or odds providers. Section 3
lists everything we hold.

## 2. Who is responsible for your data

Sam Hayter trading as Edgeways is the "data controller" under UK GDPR for the
personal data described in this policy. ICO registration: not yet required
until we start trading (EDGE-9).

## 3. What we collect

| Data | When | Examples |
|------|------|----------|
| **Account data** | When you create an account or subscribe | Email address, name (optional), subscription tier, authentication identifiers |
| **Desk records** | While you use the hosted desk | The records you create: bets, stakes, balances, offers you track, wallets, and betting history. Stored in our Neon Postgres database (London) and linked to your account. We do not send these records to bookmakers, exchanges, or odds providers. |
| **Payment data** | When you pay | Handled entirely by Stripe; we receive only a customer reference and subscription status. **We never see or store your card details.** |
| **Feedback you send** | When you use the in-app feedback form | Your message, optional reply email, and technical diagnostics (app version, page URL, browser type, timezone) |
| **Usage analytics** | While you use the app | Product events and error reports via PostHog (EU cloud, cookieless, no autocapture) |
| **Waitlist email** | If you join the launch waitlist | Email address and signup date |
| **Onboarding profile** | When you complete first-run setup | Matched-betting experience, why you signed up, how you heard about us. Not your bets. Used to improve the product. |
| **Referral codes** | If you share or redeem a referral | Your code, who referred you, and whether a credit was granted. No betting records. |
| **Support correspondence** | When you contact us | Messages and our replies |

**What we never do with your data:** no advertising tracking, no data sale, and
no profiling of your betting behaviour. We never see or store your card
details, and we never send your desk records to bookmakers, exchanges, or the
odds and fixture providers we read data from — those feeds receive only generic
fixture and race queries, never anything about you.

## 4. Lawful bases (UK GDPR)

| Purpose | Lawful basis |
|---------|--------------|
| Provide the service and manage your subscription | **Contract** (Art. 6(1)(b)) |
| Store and sync your desk records on the hosted service | **Contract** (Art. 6(1)(b)) |
| Process payments via our processor | **Contract**; the processor has its own obligations |
| Respond to feedback and support requests | **Legitimate interests** (Art. 6(1)(f)) — running a responsive product |
| Product analytics and error monitoring | **Legitimate interests** — reliability and improvement. PostHog is cookieless, so no cookie banner |
| Waitlist and launch emails | **Consent** (Art. 6(1)(a)) — unsubscribe any time |
| Onboarding profile answers (experience, why you signed up, attribution) | **Legitimate interests** (Art. 6(1)(f)) — understanding who the product is for. Not used for advertising. |
| Legal and accounting records | **Legal obligation** (Art. 6(1)(c)) |

## 5. Who processes data for us

| Processor | Purpose | Location |
|-----------|---------|----------|
| Clerk | Sign-in and account identity | United States, with UK-approved safeguards |
| PostHog | Product analytics and error tracking | EU (eu.posthog.com), cookieless |
| Stripe | Payments and billing portal | Stripe Payments Europe / Stripe, Inc. as applicable |
| Neon | Hosted Postgres database storing account and desk records | United Kingdom (AWS eu-west-2, London) |
| Vercel | Website and account hosting | EU and US regions as configured |
| Resend | Transactional and waitlist email | United States, with UK-approved safeguards |

Each processor is bound by a data processing agreement. Where data is
transferred outside the UK, we rely on adequacy regulations or UK-approved
safeguards (e.g. the UK Addendum to EU SCCs).

Odds, fixture, and race data is supplied to us by third-party providers. That
data flows one way — into the app. Our requests to those providers contain only
the fixture, race, or market being looked up, never your account details or
desk records, so they are not processors of your personal data.

## 6. Retention

- **Account and subscription data:** kept while your account is active, then
  24 months after closure unless law requires longer.
- **Desk records (bets, balances, offers, history):** kept while your account
  is active and deleted when you delete your account. Rows you delete in the
  app are removed from the live database immediately.
- **Payment records:** kept for 6 years to meet tax and accounting obligations.
- **Feedback and diagnostics:** kept 12 months, or longer if attached to an
  open issue.
- **Analytics:** retained per our PostHog configuration, 12 months.
- **Waitlist:** until launch communication completes or you unsubscribe.

## 7. Your rights

You have the right to: access your data; correct it; delete it; receive a
portable copy; restrict or object to processing; and withdraw consent where
processing is based on consent. Email support@edgeways.app and we will respond
within one month.

You can complain to the **Information Commissioner's Office** (ico.org.uk,
0303 123 1113) at any time. We would appreciate the chance to resolve things
first.

The app's built-in export (Settings → Data & backup) is your data-portability
tool: it downloads a full copy of your desk records. For access, correction, or
deletion of anything held server-side, email us and we will action it within
one month. Deleting your account erases the desk records attached to it.

## 8. Security

Account and desk data is stored in a Postgres database hosted by Neon in the
UK, behind authenticated access (Clerk), with encryption in transit (TLS) and
encryption at rest on the database platform. Each account's records are scoped
to that account at the query level. No method is 100% secure; if a breach
affects your personal data we will notify you and the ICO as the law requires.

## 9. Cookies and local storage

The app uses local storage for preferences and session sign-in — strictly
necessary, no consent banner required. PostHog is cookieless (EDGE-35).

## 10. Children

Edgeways is for over-18s only (see our Terms). We do not knowingly collect data
from anyone under 18. If you believe a minor has an account, contact us and we
will delete it.

## 11. Changes

We will post any changes here and, for material changes, notify subscribers by
email or in-app message. The effective date is at the top.

---

### Open points for the solicitor (EDGE-8)

1. Analytics lawful basis (section 4): legitimate interests vs consent depends
   on the final PostHog configuration (EDGE-35) — cookieless/event-allowlisted
   collection supports legitimate interests; anything cookie-based likely needs
   consent under PECR.
2. Retention periods in section 6 are proposals — confirm norms.
3. Desk records are now hosted (Neon Postgres, London) rather than local-first
   (EDGE-92). Confirm the controller/processor analysis and that "storage and
   sync under Contract 6(1)(b)" is the right basis for betting records a user
   creates in their own account.
4. Processor list: Stripe (payments, EDGE-2), Vercel (hosting, EDGE-46) and
   Neon (database, added 26 Aug 2026). Confirm DPA / transfer wording with the
   solicitor — Neon is UK-region so no transfer, but confirm the DPA position.
