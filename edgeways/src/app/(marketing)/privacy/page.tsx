import type { Metadata } from "next";
import { MarketingDocPage } from "@/components/marketing/marketing-doc-page";
import { SUPPORT_EMAIL, mailtoHref } from "@/lib/marketing/site-contacts";
import {
  ICO_REGISTRATION_NOTE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
} from "@/lib/legal/public";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <MarketingDocPage
      title="Privacy Policy"
      wide
      lede={
        <>
          <p>Effective date: {LEGAL_EFFECTIVE_DATE}</p>
          <p>
            Controller: {LEGAL_OPERATOR} (&quot;we&quot;, &quot;us&quot;)
          </p>
          <p>
            Contact:{" "}
            <a href={mailtoHref(SUPPORT_EMAIL)}>{SUPPORT_EMAIL}</a>
          </p>
          <p>ICO registration: {ICO_REGISTRATION_NOTE}</p>
        </>
      }
    >
      <h2>1. The short version (local-first)</h2>
      <p>
        <strong className="font-semibold text-white/80">
          Your betting records never leave your device by default.
        </strong>{" "}
        Edgeways stores your bets, balances, offers, and analytics in a
        database on your own computer. We cannot see them, sell them, or lose
        them, because we never have them.
      </p>
      <p>
        We only receive the small amount of data described in section 3:
        account details if you subscribe, feedback you choose to send, and
        product analytics.
      </p>

      <h2>2. Who is responsible for your data</h2>
      <p>
        {LEGAL_OPERATOR} is the &quot;data controller&quot; under UK GDPR for
        the personal data described in this policy. ICO registration:{" "}
        {ICO_REGISTRATION_NOTE}
      </p>

      <h2>3. What we collect</h2>
      <div className="legal-table">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>When</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Account data</td>
              <td>When you create an account or subscribe</td>
              <td>
                Email address, name (optional), subscription tier,
                authentication identifiers
              </td>
            </tr>
            <tr>
              <td>Payment data</td>
              <td>When you pay</td>
              <td>
                Handled entirely by Stripe. We receive only a customer
                reference and subscription status. We never see or store your
                card details.
              </td>
            </tr>
            <tr>
              <td>Feedback you send</td>
              <td>When you use the in-app feedback form</td>
              <td>
                Your message, optional reply email, and technical diagnostics
                (app version, page URL, browser type, timezone)
              </td>
            </tr>
            <tr>
              <td>Usage analytics</td>
              <td>While you use the app</td>
              <td>
                Product events and error reports via PostHog (EU cloud,
                cookieless, no autocapture)
              </td>
            </tr>
            <tr>
              <td>Waitlist email</td>
              <td>If you join the launch waitlist</td>
              <td>Email address and signup date</td>
            </tr>
            <tr>
              <td>Onboarding profile</td>
              <td>When you complete first-run setup</td>
              <td>
                Matched-betting experience, why you signed up, how you heard
                about us. Not your bets. Used to improve the product.
              </td>
            </tr>
            <tr>
              <td>Referral codes</td>
              <td>If you share or redeem a referral</td>
              <td>
                Your code, who referred you, and whether a credit was granted.
                No betting records.
              </td>
            </tr>
            <tr>
              <td>Support correspondence</td>
              <td>When you contact us</td>
              <td>Messages and our replies</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong className="font-semibold text-white/80">
          What we do not collect:
        </strong>{" "}
        your bets, stakes, balances, bookmaker accounts, betting history, or
        any content of your local database. There is no advertising tracking,
        no data sale, and no profiling of your betting behaviour by us.
      </p>

      <h2>4. Lawful bases (UK GDPR)</h2>
      <div className="legal-table">
        <table>
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Lawful basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Provide the service and manage your subscription</td>
              <td>Contract (Art. 6(1)(b))</td>
            </tr>
            <tr>
              <td>Process payments via our processor</td>
              <td>Contract. The processor has its own obligations</td>
            </tr>
            <tr>
              <td>Respond to feedback and support requests</td>
              <td>
                Legitimate interests (Art. 6(1)(f)), running a responsive
                product
              </td>
            </tr>
            <tr>
              <td>Product analytics and error monitoring</td>
              <td>
                Legitimate interests, reliability and improvement. PostHog is
                cookieless, so we do not show a cookie banner
              </td>
            </tr>
            <tr>
              <td>Waitlist and launch emails</td>
              <td>Consent (Art. 6(1)(a)). Unsubscribe any time</td>
            </tr>
            <tr>
              <td>
                Onboarding profile answers (experience, why you signed up,
                attribution)
              </td>
              <td>
                Legitimate interests (Art. 6(1)(f)), understanding who the
                product is for. Not used for advertising
              </td>
            </tr>
            <tr>
              <td>Legal and accounting records</td>
              <td>Legal obligation (Art. 6(1)(c))</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>5. Who processes data for us</h2>
      <div className="legal-table">
        <table>
          <thead>
            <tr>
              <th>Processor</th>
              <th>Purpose</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Clerk</td>
              <td>Sign-in and account identity</td>
              <td>United States, with UK-approved safeguards</td>
            </tr>
            <tr>
              <td>PostHog</td>
              <td>Product analytics and error tracking</td>
              <td>EU (eu.posthog.com), cookieless</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payments and billing portal</td>
              <td>Stripe Payments Europe / Stripe, Inc. as applicable</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Website and account hosting</td>
              <td>EU and US regions as configured</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Transactional and waitlist email</td>
              <td>United States, with UK-approved safeguards</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Each processor is bound by a data processing agreement. Where data is
        transferred outside the UK, we rely on adequacy regulations or
        UK-approved safeguards (for example, the UK Addendum to EU SCCs).
      </p>

      <h2>6. Retention</h2>
      <ul>
        <li>
          Account and subscription data: kept while your account is active,
          then 24 months after closure unless law requires longer.
        </li>
        <li>
          Payment records: kept for 6 years to meet tax and accounting
          obligations.
        </li>
        <li>
          Feedback and diagnostics: kept 12 months, or longer if attached to an
          open issue.
        </li>
        <li>Analytics: retained per our PostHog configuration, 12 months.</li>
        <li>
          Waitlist: until launch communication completes or you unsubscribe.
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>
        You have the right to: access your data; correct it; delete it; receive
        a portable copy; restrict or object to processing; and withdraw consent
        where processing is based on consent. Email{" "}
        <a href={mailtoHref(SUPPORT_EMAIL)}>{SUPPORT_EMAIL}</a> and we will
        respond within one month.
      </p>
      <p>
        You can complain to the{" "}
        <strong className="font-semibold text-white/80">
          Information Commissioner&apos;s Office
        </strong>{" "}
        (
        <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
          ico.org.uk
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        , 0303 123 1113) at any time. We would appreciate the chance to resolve
        things first.
      </p>
      <p>
        Because your betting records live on your device, you already hold
        them: the app&apos;s built-in backup/export (Settings → Data &amp;
        backup) is your data-portability tool, and deleting the local database
        erases them.
      </p>

      <h2>8. Security</h2>
      <p>
        Account data is held behind authenticated access with encryption in
        transit (TLS). The local-first design means the most sensitive data,
        your betting records, is protected by your own device&apos;s security.
        No method is 100% secure. If a breach affects your personal data we
        will notify you and the ICO as the law requires.
      </p>

      <h2>9. Cookies and local storage</h2>
      <p>
        The app uses local storage for preferences and session sign-in. Those
        are strictly necessary. PostHog runs in cookieless mode and does not
        set analytics cookies, so we do not show a cookie banner. If that
        changes, we will update this page and add a consent step.
      </p>

      <h2>10. Children</h2>
      <p>
        Edgeways is for over-18s only (see our Terms). We do not knowingly
        collect data from anyone under 18. If you believe a minor has an
        account, contact us and we will delete it.
      </p>

      <h2>11. Changes</h2>
      <p>
        We will post any changes here and, for material changes, notify
        subscribers by email or in-app message. The effective date is at the
        top.
      </p>
    </MarketingDocPage>
  );
}