import Link from "next/link";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { MarketingLogo } from "@/components/marketing/marketing-logo";
import { MarketingGlimpseRail } from "@/components/marketing/marketing-glimpse-rail";
import { MarketingSocialLinks } from "@/components/marketing/marketing-social-links";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";
import { moneyPositiveClass } from "@/components/money-flow";
import { TRIAL_DAYS, betaOfferSummary } from "@/lib/billing/public-offer";
import { cn } from "@/lib/utils";

const FAQ = [
  {
    q: "What is Edgeways?",
    a: "A matched betting command centre. What to do next, clean execution, and what you kept.",
  },
  {
    q: "Is this an oddsmatcher?",
    a: "No. Matchers help you find bets. Edgeways runs the day and shows what you kept.",
  },
  {
    q: "What does the trial include?",
    a: `${TRIAL_DAYS} days of Edge, the top tier. One trial per person. Cancel before it ends and you are not charged. Then pick Core or Edge at the list price.`,
  },
  {
    q: "What do beta testers get?",
    a: betaOfferSummary(),
  },
  {
    q: "Who is it for?",
    a: "UK matched bettors who are done juggling spreadsheets and half-built trackers.",
  },
  {
    q: "Is this for 18+ only?",
    a: "Yes. Adults only. Betting involves risk.",
  },
] as const;

const ALSO_ON_DESK = [
  {
    title: "Automatic bet results",
    body: "Fixtures and races settle when results land. No retyping outcomes.",
  },
  {
    title: "Account health",
    body: "Healthy, cooling, gubbed. Dead books leave the queue.",
  },
  {
    title: "Full bet-type depth",
    body: "Accas, systems, each-way, 2UP, sequential lays. Your tickets, not tip sheets.",
  },
  {
    title: "Your desk, your look",
    body: "Accent, font, header patterns. Set it once and get on with it.",
  },
  {
    title: "Checkers on tap",
    body: "Paste a price. Get a fair-odds call. No matcher required.",
  },
] as const;

function LaunchNav() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-4 sm:gap-4 sm:px-8 sm:py-5">
      <MarketingLogo />
      <Link
        href="/login"
        className="rounded-md px-2 py-1.5 text-sm text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)] sm:hidden"
      >
        Log in
      </Link>
      <nav
        aria-label="Marketing"
        className="hidden shrink-0 items-center gap-1 text-sm text-white/70 sm:flex sm:gap-3 md:gap-4"
      >
        <a
          href="#how-it-helps"
          className="hidden rounded-md px-2 py-1.5 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)] md:inline-flex"
        >
          How it helps
        </a>
        <a
          href="#pricing"
          className="hidden rounded-md px-2 py-1.5 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)] md:inline-flex"
        >
          Plans
        </a>
        <Link
          href="/login"
          className="rounded-md px-2 py-1.5 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
        >
          Log in
        </Link>
        <a
          href="#pricing"
          className="rounded-md bg-[var(--marketing-brand)] px-3 py-1.5 font-semibold whitespace-nowrap text-[var(--marketing-ink)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
        >
          Start free trial
        </a>
      </nav>
    </header>
  );
}

function HeroArtefact() {
  return (
    <div className="mx-auto mt-8 w-full max-w-5xl sm:mt-12" aria-hidden>
      <div className="marketing-panel marketing-panel-hero rounded-[var(--radius-button)] px-5 py-4 sm:px-6 sm:py-5">
        <span className="marketing-panel-shine" aria-hidden />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-white/55">
              Do next
            </p>
            <p className="mt-1.5 truncate text-lg font-semibold text-white sm:text-xl">
              Paddy Power · £20 qualifier
            </p>
            <p className="mt-1 text-sm text-white/55">
              Free bet if 2nd or 3rd
            </p>
          </div>
          <div className="shrink-0 border-t border-white/10 pt-3 text-left sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8 sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-white/55">
              Potential edge
            </p>
            <p
              className={cn(
                "mt-1.5 text-lg font-bold tabular-nums sm:text-xl",
                moneyPositiveClass,
                "text-[var(--marketing-money)]"
              )}
            >
              +£15.00
            </p>
            <p className="mt-1 text-sm text-white/55">£20 free bet value</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LaunchHome() {
  return (
    <>
      <LaunchNav />

      <main>
        <section
          id="hero"
          className="marketing-fade-up relative mx-auto max-w-5xl px-5 pb-12 pt-6 text-center sm:px-8 sm:pb-16 sm:pt-14"
        >
          <div className="marketing-atmosphere pointer-events-none absolute inset-0 -z-10" />
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/55">
            {TRIAL_DAYS}-day Edge trial
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-tight text-white sm:mt-4 sm:text-5xl md:text-6xl md:leading-[1.05]">
            Know what&apos;s next.
            <br />
            <span className="text-[var(--marketing-brand)]">
              See what paid.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/65 sm:mt-5 sm:text-lg">
            Edgeways is the matched betting command centre. One desk for the
            day. No spreadsheet pile-up.
          </p>
          <div className="mx-auto mt-7 flex w-full max-w-md flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center">
            <a
              href="#pricing"
              className="inline-flex justify-center rounded-[var(--radius-button)] bg-[var(--marketing-brand)] px-4 py-2.5 text-sm font-semibold text-[var(--marketing-ink)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
            >
              See plans
            </a>
            <Link
              href="/login"
              className="inline-flex justify-center rounded-[var(--radius-button)] border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
            >
              Log in
            </Link>
          </div>
          <HeroArtefact />
        </section>

        <section
          id="how-it-helps"
          className="border-t border-white/10 bg-[var(--marketing-band-deep)] px-5 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Built to make the day simpler.
            </h2>
            <p className="mt-3 max-w-2xl text-base text-white/55 sm:text-lg">
              Matchers help you find bets. Edgeways helps you run them, then
              shows what paid. Less tab-hopping. Fewer missed steps.
            </p>
            <ul className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-8">
              {[
                {
                  title: "Know what to do next",
                  body: "Ranked Do Next and a Daily Plan. Offers, races and fixtures on one run-sheet.",
                },
                {
                  title: "Keep execution clean",
                  body: "Pipelines, Racing Desk and account health. No naked backs or stuck free bets.",
                },
                {
                  title: "See what you kept",
                  body: "Results settle automatically. Expected versus realised, after commission.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="border-t border-[color-mix(in_srgb,var(--marketing-brand)_40%,transparent)] pt-4 text-left"
                >
                  <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60 sm:text-base">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="glimpses"
          className="marketing-band border-t border-white/10 px-5 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Key features
            </h2>
            <p className="mt-3 max-w-xl text-base text-white/55 sm:text-lg">
              The tools that run the day. Daily Plan, pipelines, P&amp;L.
            </p>
            <div className="mt-10">
              <MarketingGlimpseRail />
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[var(--marketing-band-deep)] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Also on the desk
            </h2>
            <p className="mt-3 max-w-xl text-base text-white/55 sm:text-lg">
              Supporting tools that keep the main queue clear.
            </p>
            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {ALSO_ON_DESK.map((item) => (
                <li
                  key={item.title}
                  className="border-t border-white/10 pt-4 text-left"
                >
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--marketing-brand)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <MarketingPricing />

        <section
          id="faq"
          className="marketing-band border-t border-white/10 px-5 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Straight answers
            </h2>
            <dl className="mt-10 divide-y divide-white/10 border-y border-white/10">
              {FAQ.map((item) => (
                <div key={item.q} className="py-5">
                  <dt className="text-lg font-semibold tracking-tight text-white">
                    {item.q}
                  </dt>
                  <dd className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60 sm:text-base">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[var(--marketing-band-deep)] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Join the beta waitlist
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 sm:text-base">
              {betaOfferSummary()}
            </p>
            <div className="mx-auto mt-8 w-full max-w-lg">
              <WaitlistForm id="waitlist-footer" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <MarketingLogo className="opacity-90" />
            <MarketingSocialLinks className="mt-4" />
            <p className="mt-3 text-xs text-white/55">
              © {new Date().getFullYear()} Edgeways. All rights reserved.
            </p>
          </div>
          <div className="max-w-md space-y-3">
            <ResponsibleGamblingNote className="text-white/55 [&_a]:text-[var(--marketing-brand)]" />
            <p className="text-xs text-white/55">
              We keep your email for the waitlist and launch updates.
              Unsubscribe any time. Full privacy policy before public launch.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
