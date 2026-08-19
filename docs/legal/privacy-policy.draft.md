# Edgeways — Privacy Policy

> **Published 17 Aug 2026 (EDGE-61).** Customer page: `/privacy`. Sam read
> 16 Aug (EDGE-12). Solicitor (EDGE-8) before charging strangers. Not legal
> advice. Payments are Stripe direct (EDGE-2). Hosting is Vercel (EDGE-46).
> ICO fee: retake self-assessment when trading starts (EDGE-9).

**Effective date:** 17 August 2026
**Controller:** Sam Hayter trading as Edgeways ("we", "us")
**Contact:** support@edgeways.app
**ICO registration:** Not yet required. We will register when we start trading
and add the number here.

## 1. The short version (local-first)

**Your betting records never leave your device by default.** Edgeways stores
your bets, balances, offers, and analytics in a database on your own computer.
We cannot see them, sell them, or lose them — because we never have them.

We only receive the small amount of data described in section 3: account
details if you subscribe, feedback you choose to send, and product analytics.

## 2. Who is responsible for your data

Sam Hayter trading as Edgeways is the "data controller" under UK GDPR for the
personal data described in this policy. ICO registration: not yet required
until we start trading (EDGE-9).

## 3. What we collect

| Data | When | Examples |
|------|------|----------|
| **Account data** | When you create an account or subscribe | Email address, name (optional), subscription tier, authentication identifiers |
| **Payment data** | When you pay | Handled entirely by Stripe; we receive only a customer reference and subscription status. **We never see or store your card details.** |
| **Feedback you send** | When you use the in-app feedback form | Your message, optional reply email, and technical diagnostics (app version, page URL, browser type, timezone) |
| **Usage analytics** | While you use the app | Product events and error reports via PostHog (EU cloud, cookieless, no autocapture) |
| **Waitlist email** | If you join the launch waitlist | Email address and signup date |
| **Onboarding profile** | When you complete first-run setup | Matched-betting experience, why you signed up, how you heard about us. Not your bets. Used to improve the product. |
| **Referral codes** | If you share or redeem a referral | Your code, who referred you, and whether a credit was granted. No betting records. |
| **Support correspondence** | When you contact us | Messages and our replies |

**What we do not collect:** your bets, stakes, balances, bookmaker accounts,
betting history, or any content of your local database. There is no advertising
tracking, no data sale, and no profiling of your betting behaviour by us.

## 4. Lawful bases (UK GDPR)

| Purpose | Lawful basis |
|---------|--------------|
| Provide the service and manage your subscription | **Contract** (Art. 6(1)(b)) |
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
| Vercel | Website and account hosting | EU and US regions as configured |
| Resend | Transactional and waitlist email | United States, with UK-approved safeguards |

Each processor is bound by a data processing agreement. Where data is
transferred outside the UK, we rely on adequacy regulations or UK-approved
safeguards (e.g. the UK Addendum to EU SCCs).

## 6. Retention

- **Account and subscription data:** kept while your account is active, then
  24 months after closure unless law requires longer.
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

Because your betting records live on your device, you already hold them: the
app's built-in backup/export (Settings → Data & backup) is your data-portability
tool, and deleting the local database erases them.

## 8. Security

Account data is held behind authenticated access with encryption in transit
(TLS). The local-first design means the most sensitive data — your betting
records — is protected by your own device's security. No method is 100% secure;
if a breach affects your personal data we will notify you and the ICO as the
law requires.

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
3. Whether the local-first architecture changes any controller/processor
   analysis for the hosted account data (it should simplify, not complicate).
4. Processor list: Stripe (payments, EDGE-2) and Vercel (hosting, EDGE-46).
   Confirm DPA / transfer wording with the solicitor.
