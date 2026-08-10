# Edgeways — Privacy Policy

> **DRAFT v0.1 — 10 Aug 2026. For solicitor review (EDGE-8) before any public
> use. Not legal advice. Placeholders in [SQUARE BRACKETS] must be resolved
> before publication. Processor list depends on EDGE-2 (payments) and EDGE-23
> (hosting).**

**Effective date:** [PUBLICATION DATE]
**Controller:** [LEGAL ENTITY NAME], trading as Edgeways ("we", "us")
**Contact:** [PRIVACY EMAIL]
**ICO registration:** [REGISTRATION NUMBER — EDGE-9]

## 1. The short version (local-first)

**Your betting records never leave your device by default.** Edgeways stores
your bets, balances, offers, and analytics in a database on your own computer.
We cannot see them, sell them, or lose them — because we never have them.

We only receive the small amount of data described in section 3: account
details if you subscribe, feedback you choose to send, and product analytics.

## 2. Who is responsible for your data

[LEGAL ENTITY NAME] is the "data controller" under UK GDPR for the personal
data described in this policy. We are registered with the Information
Commissioner's Office [REGISTRATION NUMBER — EDGE-9].

## 3. What we collect

| Data | When | Examples |
|------|------|----------|
| **Account data** | When you create an account or subscribe | Email address, name (optional), subscription tier, authentication identifiers |
| **Payment data** | When you pay | Handled entirely by our payment processor [STRIPE / PADDLE — EDGE-2]; we receive only a customer reference and subscription status. **We never see or store your card details.** |
| **Feedback you send** | When you use the in-app feedback form | Your message, optional reply email, and technical diagnostics (app version, page URL, browser type, timezone) |
| **Usage analytics** | While you use the app | Product events and error reports via PostHog [CONFIRM at EDGE-35 setup: event allowlist, IP anonymisation, EU vs US cloud] |
| **Waitlist email** | If you join the launch waitlist | Email address and signup date |
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
| Product analytics and error monitoring | **Legitimate interests** — reliability and improvement. [CONFIRM: consent banner needed? Depends on EDGE-35 config — see open points] |
| Waitlist and launch emails | **Consent** (Art. 6(1)(a)) — unsubscribe any time |
| Legal and accounting records | **Legal obligation** (Art. 6(1)(c)) |

## 5. Who processes data for us

| Processor | Purpose | Location |
|-----------|---------|----------|
| PostHog | Product analytics and error tracking | [EU/US — CONFIRM AT EDGE-35] |
| [Stripe / Paddle / Lemon Squeezy — EDGE-2] | Payments | [PER CHOICE] |
| [Hosting provider — EDGE-23] | Website and account hosting | [PER CHOICE] |
| [Email provider — TBD] | Transactional and waitlist email | [PER CHOICE] |

Each processor is bound by a data processing agreement. Where data is
transferred outside the UK, we rely on adequacy regulations or UK-approved
safeguards (e.g. the UK Addendum to EU SCCs).

## 6. Retention

- **Account and subscription data:** kept while your account is active, then
  [24 months] after closure unless law requires longer.
- **Payment records:** kept for [6 years] to meet tax and accounting obligations.
- **Feedback and diagnostics:** kept [12 months], or longer if attached to an
  open issue.
- **Analytics:** retained per our PostHog configuration, [12 months].
- **Waitlist:** until launch communication completes or you unsubscribe.

## 7. Your rights

You have the right to: access your data; correct it; delete it; receive a
portable copy; restrict or object to processing; and withdraw consent where
processing is based on consent. Email [PRIVACY EMAIL] and we will respond
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
necessary, no consent banner required. [CONFIRM at EDGE-35: whether PostHog
config sets any non-essential cookies; if so, add a consent mechanism or
configure cookieless tracking.]

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
4. Processor list to be finalised once EDGE-2 (payments) and EDGE-23 (hosting)
   are decided; both are Sam's near-term queue.
