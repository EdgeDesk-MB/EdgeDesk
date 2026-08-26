import type { Metadata } from "next";
import Link from "next/link";
import { MarketingDocPage } from "@/components/marketing/marketing-doc-page";
import { SUPPORT_EMAIL, mailtoHref } from "@/lib/marketing/site-contacts";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
  LEGAL_PATHS,
} from "@/lib/legal/public";
import { canonicalUrl } from "@/lib/marketing/share-metadata";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: canonicalUrl(LEGAL_PATHS.terms) },
};

export default function TermsPage() {
  return (
    <MarketingDocPage
      title="Terms of Service"
      wide
      lede={
        <>
          <p>Effective date: {LEGAL_EFFECTIVE_DATE}</p>
          <p>
            Service: Edgeways, a subscription web application for tracking and
            analysing matched betting activity
          </p>
          <p>Operator: {LEGAL_OPERATOR} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)</p>
          <p>
            Contact:{" "}
            <a href={mailtoHref(SUPPORT_EMAIL)}>{SUPPORT_EMAIL}</a>
          </p>
        </>
      }
    >
      <h2>1. What Edgeways is (and is not)</h2>
      <p>
        1.1 Edgeways is record-keeping and analysis software. It helps you log
        your own bets, track bookmaker promotions, and understand your results.
      </p>
      <p>
        1.2 Edgeways is <strong className="font-semibold text-white/80">not</strong>{" "}
        a bookmaker, betting exchange, or gambling operator. We never accept,
        place, or settle wagers, hold betting funds, or pay out winnings. No
        money you stake ever passes through Edgeways.
      </p>
      <p>
        1.3 Edgeways does{" "}
        <strong className="font-semibold text-white/80">not</strong> provide
        gambling advice, tipping, or financial advice. Content in the app
        (including calculators, EV figures, and &quot;edge&quot; estimates) is
        arithmetic on data you provide or on third-party odds feeds. It is
        information, not a recommendation to bet.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        2.1 You must be{" "}
        <strong className="font-semibold text-white/80">18 or over</strong> to
        use Edgeways. By creating an account or confirming the in-app age gate,
        you declare that you are 18 or over. We may suspend accounts we
        reasonably believe are used by minors.
      </p>
      <p>
        2.2 Edgeways is intended for personal, non-commercial use by individuals
        in jurisdictions where matched betting is lawful. You are responsible
        for checking your local law.
      </p>

      <h2>3. Accounts</h2>
      <p>
        3.1 You need an account to use subscriber features. Keep your sign-in
        details confidential. You are responsible for activity on your account.
      </p>
      <p>3.2 One account per person. Do not share, sell, or transfer your account.</p>

      <h2>4. Subscriptions, trials, and payments</h2>
      <p>
        4.1 <strong className="font-semibold text-white/80">Tiers.</strong>{" "}
        Edgeways offers a Free tier and paid tiers (Core, Edge) as described on
        the pricing page. Features per tier may change between versions. Changes
        will not remove core functionality from an active paid term.
      </p>
      <p>
        4.2 <strong className="font-semibold text-white/80">Billing.</strong>{" "}
        Paid subscriptions renew automatically each month or year (as selected
        at checkout) until cancelled. Prices are in GBP. VAT is not included
        until we register.
      </p>
      <p>
        4.3 <strong className="font-semibold text-white/80">Trial.</strong> The
        Edge plan starts with a 14-day trial. At the end of the trial, Edge
        billing begins unless you cancel before then. Core is billed from the
        day you subscribe. One trial per person.
      </p>
      <p>
        4.3a <strong className="font-semibold text-white/80">Founding.</strong>{" "}
        Invited beta / waitlist accounts may receive a Founding term: after the
        trial, three months of the Edge tier billed at the Core monthly price,
        then Edge at the then-current list price. Founding is granted on the
        account, not advertised as a public sitewide sale.
      </p>
      <p>
        4.3b{" "}
        <strong className="font-semibold text-white/80">Feedback credit.</strong>{" "}
        During beta we may grant one extra month of a paid or Founding term for
        useful product feedback, once per person. This is not payment for public
        reviews.
      </p>
      <p>
        4.4 <strong className="font-semibold text-white/80">Cancellation.</strong>{" "}
        You can cancel at any time in Settings or via the checkout portal.
        Cancellation takes effect at the end of the current billing period. You
        keep paid features until then. No partial-period refunds except where
        required by law (see 4.5). Our{" "}
        <Link href={LEGAL_PATHS.refund}>Refunds</Link> page is the short
        version of this section.
      </p>
      <p>
        4.5{" "}
        <strong className="font-semibold text-white/80">
          Your statutory rights.
        </strong>{" "}
        If you are a UK/EU consumer, you have a 14-day &quot;cooling off&quot;
        right under the Consumer Contracts Regulations 2013. If you ask us to
        start your subscription immediately, you acknowledge you lose the right
        to a full refund once the service has been fully supplied within that
        period. We will refund a proportionate amount for any unused period
        where the law requires. Nothing in these terms limits your statutory
        rights.
      </p>
      <p>
        4.6 <strong className="font-semibold text-white/80">Price changes.</strong>{" "}
        We will give at least 30 days&apos; notice of price increases. Continued
        use after the notice period constitutes acceptance. You may cancel
        instead.
      </p>
      <p>
        4.7 <strong className="font-semibold text-white/80">Failed payments.</strong>{" "}
        If a renewal payment fails, we may retry and then suspend paid features
        until payment succeeds. We will not delete your data for at least 90
        days after a lapse.
      </p>

      <h2>5. Your betting activity</h2>
      <p>
        5.1{" "}
        <strong className="font-semibold text-white/80">
          No guarantee of profit.
        </strong>{" "}
        Matched betting outcomes depend on odds, stake limits, bookmaker
        restrictions (&quot;gubbing&quot;), human error, and factors outside our
        control. Expected-value figures are estimates, not promises.{" "}
        <strong className="font-semibold text-white/80">You can lose money.</strong>{" "}
        We accept no liability for betting losses (see section 10).
      </p>
      <p>
        5.2{" "}
        <strong className="font-semibold text-white/80">
          Bookmaker and exchange terms.
        </strong>{" "}
        You are solely responsible for complying with the terms of every
        bookmaker and exchange you use. Bookmakers may restrict or close
        accounts that take promotions. That risk is yours.
      </p>
      <p>
        5.3{" "}
        <strong className="font-semibold text-white/80">
          Responsible gambling.
        </strong>{" "}
        Edgeways is a tracking tool, not encouragement to gamble. Only ever
        stake money you can afford to lose. If gambling stops feeling like a
        choice, contact BeGambleAware.org (free, confidential, 24/7) or call the
        National Gambling Helpline on 0808 8020 133.
      </p>
      <p>
        5.4{" "}
        <strong className="font-semibold text-white/80">
          Accuracy of your records.
        </strong>{" "}
        Reports, profit figures, and analytics are only as accurate as the bets
        and balances you enter. We do not verify your entries against bookmaker
        records.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        6.1 Do not: misuse the service (probe, overload, reverse engineer except
        as permitted by law); scrape or resell our content or odds data; use the
        service for money laundering or any unlawful purpose; or misrepresent
        your age.
      </p>
      <p>
        6.2 We may suspend or terminate accounts that breach these terms
        (section 11).
      </p>

      <h2>7. Your data</h2>
      <p>
        7.1 Edgeways is{" "}
        <strong className="font-semibold text-white/80">local-first</strong>:
        your betting records are stored on your own device by default and never
        leave it unless you choose a cloud/sync feature or contact support with
        diagnostics. Our{" "}
        <Link href={LEGAL_PATHS.privacy}>Privacy Policy</Link> explains what we
        collect and why.
      </p>
      <p>
        7.2{" "}
        <strong className="font-semibold text-white/80">
          Backups are your responsibility
        </strong>{" "}
        while the service is local-first. The app provides one-tap backup and
        restore (Settings → Data &amp; backup). Use it. We cannot recover data
        lost from your device.
      </p>
      <p>
        7.3 You can export or delete your data at any time. Deleting your
        account deletes data we hold about you per the Privacy Policy. Local
        data on your device is yours to keep or delete.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        8.1 We own the Edgeways software, brand, and content (excluding your
        data and third-party odds data). Your subscription gives you a personal,
        non-exclusive, non-transferable licence to use the service while
        subscribed.
      </p>
      <p>
        8.2 You own your data. You grant us only the rights needed to operate
        the service (for example, storing feedback you submit).
      </p>
      <p>
        8.3 Bookmaker names, logos, and odds remain the property of their owners
        and are used for identification only.
      </p>

      <h2>9. Third-party services and data</h2>
      <p>
        9.1 Odds, racecards, and results come from third-party providers. We do
        not guarantee their accuracy, availability, or timeliness. Always verify
        odds and terms on the bookmaker&apos;s own site before staking.
      </p>
      <p>
        9.2 Links to bookmakers, exchanges, and support organisations are
        provided for convenience. We are not responsible for their content or
        terms.
      </p>

      <h2>10. Disclaimers and limitation of liability</h2>
      <p>
        10.1 The service is provided &quot;as is&quot;. We do not warrant that
        it will be uninterrupted, error-free, or that odds data will be accurate
        or timely.
      </p>
      <p>
        10.2{" "}
        <strong className="font-semibold text-white/80">
          Nothing in these terms excludes or limits our liability for
        </strong>{" "}
        death or personal injury caused by negligence, fraud, or anything else
        that cannot be excluded by law.
      </p>
      <p>
        10.3 Subject to 10.2, we are not liable for: (a) betting losses or lost
        profits; (b) bookmaker account restrictions or closures; (c) loss of
        data where you have not used the provided backup tools; (d) indirect or
        consequential loss.
      </p>
      <p>
        10.4 Subject to 10.2 and 10.3, our total liability to you in any
        12-month period is capped at the fees you paid us in that period (or
        £100 for free-tier users).
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        11.1 You may stop using Edgeways and cancel at any time (section 4.4).
      </p>
      <p>
        11.2 We may suspend or terminate your account if you breach these terms,
        with notice where practicable. You may export your data before
        termination takes effect unless we are legally prevented.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        12.1 We may update these terms. For material changes we will give at
        least 14 days&apos; notice by email or in-app message. Continued use
        after the effective date constitutes acceptance. If you disagree, cancel
        before then.
      </p>

      <h2>13. General</h2>
      <p>
        13.1 These terms are governed by the law of England and Wales. Courts of
        England and Wales have exclusive jurisdiction, except that consumers may
        bring proceedings in their home jurisdiction where the law allows.
      </p>
      <p>13.2 If any clause is found unenforceable, the rest remain in force.</p>
      <p>
        13.3 These terms, plus the{" "}
        <Link href={LEGAL_PATHS.privacy}>Privacy Policy</Link>, are the entire
        agreement between us about the service.
      </p>
    </MarketingDocPage>
  );
}
