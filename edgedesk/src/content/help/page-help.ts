export type PageHelpId =
  | "dashboard"
  | "fixtures"
  | "racing"
  | "tracker"
  | "offers"
  | "calculators"
  | "tracked-events"
  | "settings"
  | "history";

export interface PageHelpContent {
  title: string;
  summary: string;
  bullets: string[];
  guideSlug?: string;
}

export const PAGE_HELP: Record<PageHelpId, PageHelpContent> = {
  dashboard: {
    title: "Live Dashboard",
    summary:
      "Your command centre for running P&L. Settled profit plus every open live position, updated as scores change.",
    bullets: [
      "Live P&L = settled profit + provisional value of open bets on in-play events.",
      "The Liveline chart streams while tracked matches or races are live.",
      "History column shows goals, 2UP triggers and settlements in real time.",
      "Link bets to events in the Tracker — score changes auto-settle derived markets.",
    ],
    guideSlug: "getting-started",
  },
  fixtures: {
    title: "Fixtures",
    summary: "Browse today's football fixtures and horse racecards, then track what you care about.",
    bullets: [
      "Hit + on any row to add it to Tracked Events.",
      "Without API keys you get demo fixtures and sample racecards.",
      "API-Football free tier: ~one live-tracked match per day (100 req/day budget).",
      "Racing API free tier: today and tomorrow racecards with proxy bookie odds.",
    ],
    guideSlug: "getting-started",
  },
  racing: {
    title: "Racing Desk",
    summary:
      "Racecards, offer-aware Intelligence, and one-click lay workflow for UK & IRE place-refund offers.",
    bullets: [
      "Proxy odds are ORF estimates — labelled clearly. Use Lay to open the matched calculator with your real odds.",
      "Intelligence scores races by offer fit, field size, and estimated EV — higher is better, not a guarantee.",
      "Qualifying loss is the small cost of unlocking a free bet; compare to expected value from the offer.",
      "Add a Betfair delayed key (free) for real exchange lay prices on runner rows.",
    ],
    guideSlug: "racing-desk",
  },
  tracker: {
    title: "Profit Tracker",
    summary: "Every position linked to real events. Results settle bets automatically.",
    bullets: [
      "Add bets manually, from calculators, or via OCR screenshot import.",
      "Link an event once — score changes settle match odds, BTTS, O/U 2.5 and 2UP together.",
      "Use “The bet wins IF …” for goalscorer and combo triggers — settles at the decisive moment.",
      "Advanced lay mode supports part lays, underlay and overlay for boosted-odds plays.",
    ],
    guideSlug: "calculators",
  },
  offers: {
    title: "Offers",
    summary: "Track sign-ups, reloads and racing place-refund promos. Bets auto-link when labels match.",
    bullets: [
      "Racing offers drive Intelligence on the Racing Desk — add a place-refund offer first.",
      "Expected profit is your estimate; actual comes from settled bets linked to the offer.",
      "Expiry reminders fire at 7, 3 and 1 days before — toggle in Settings → Preferences.",
      "Mark complete when done to keep P&L summaries accurate.",
    ],
    guideSlug: "offers",
  },
  calculators: {
    title: "Calculators",
    summary: "The matched betting toolkit. Core calculators push straight to the profit tracker.",
    bullets: [
      "Matched Betting — qualifiers, free bets (SNR/SR) and risk-free offers.",
      "Dutching — equal-profit splits; 2UP dutch mode for early-payout windfalls.",
      "Each Way & Extra Place — lay win and place separately for extra-place offers.",
    ],
    guideSlug: "calculators",
  },
  "tracked-events": {
    title: "Tracked Events",
    summary: "Matches and races you're following. Live scores refresh automatically.",
    bullets: [
      "Simulate a 2UP match for the 60-second demo loop — no API keys needed.",
      "Goal timelines fetch only when you have an open trigger bet on the match.",
      "Racing: set winner manually on free tier, or upgrade Racing API Basic for auto results.",
      "Finished events stay here until you remove them.",
    ],
    guideSlug: "getting-started",
  },
  settings: {
    title: "Settings",
    summary: "Accounts, defaults, API connections and data export.",
    bullets: [
      "Exchanges power calculator lay panels — set commission and brand colours.",
      "Data & API shows connection status for API-Football, Racing API and Betfair.",
      "Free stack: Racing API + Betfair delayed key + optional API-Football = £0/month.",
      "Export bets, settlements and balances as CSV anytime.",
    ],
    guideSlug: "faq",
  },
  history: {
    title: "History",
    summary: "Full timeline of bets, settlements, promos and live match moments.",
    bullets: [
      "Filter by sport, settlements, promos or match events.",
      "Times align to when things happened — kick-off, goals, full time.",
      "Settled bets leaving Live positions appear here with realised P&L highlighted.",
      "Builds automatically as you track events and log bets.",
    ],
    guideSlug: "getting-started",
  },
};
