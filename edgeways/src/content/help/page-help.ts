import { ACCA_DESK_HELP_BULLETS } from "@/content/help/acca-methods";

export type PageHelpId =
  | "dashboard"
  | "fixtures"
  | "racing"
  | "tracker"
  | "offers"
  | "calculators"
  | "casino"
  | "boosts"
  | "acca"
  | "bet-builder"
  | "systems"
  | "tracked-events"
  | "settings"
  | "history"
  | "accounts";

export interface PageHelpContent {
  title: string;
  summary: string;
  bullets: string[];
  guideSlug?: string;
}

export const PAGE_HELP: Record<PageHelpId, PageHelpContent> = {
  dashboard: {
    title: "Dashboard",
    summary: "Settled profit plus the provisional value of open bets.",
    bullets: [
      "Profit = settled + Prov. Prov is always the worst outcome of open positions. A lock-in and its parent count as one pair.",
      "Home → Live → Events shows if ended now on football, plus live exchange match-odds backs when the exchange feed is connected. Positions still lists each leg.",
      "The Liveline chart streams while tracked matches or races are live.",
      "History column shows goals (with a 2UP mark when a side goes two ahead) and settlements in real time.",
    ],
    guideSlug: "getting-started",
  },
  fixtures: {
    title: "Fixtures",
    summary: "Browse today, then track what you care about.",
    bullets: [
      "Hit + on any row to add it to Tracked Events.",
      "Football stays on this page on every plan. Live UK and Irish racecards are on Edge.",
      "Football: live scores update about once a minute on a tracked match.",
      "Racing feed: today and tomorrow racecards with proxy bookie odds.",
    ],
    guideSlug: "getting-started",
  },
  racing: {
    title: "Racing Desk",
    summary: "Racecards and one-click lays for place-refund offers.",
    bullets: [
      "Proxy odds are labelled estimates. Use Lay to open the matched calculator with your real odds.",
      "Intelligence scores races by offer fit, field size, and estimated EV - higher is better, not a guarantee.",
      "Qualifying loss is the small cost of unlocking a free bet; compare to expected value from the offer.",
      "When the exchange feed is connected, runner rows show real exchange lay prices.",
    ],
    guideSlug: "racing-desk",
  },
  tracker: {
    title: "Profit Tracker",
    summary: "Log, settle, and see wallets and basic P&L. Link an event and the result can settle it.",
    bullets: [
      "Add bets manually, from calculators, or via OCR screenshot import.",
      "Placing a deliberate back-only bet (e.g. a mug bet)? Pick the No lay bet type - the lay panel disappears and the outcomes show the bookie side only.",
      "Flag a bet as a Mug bet (camouflage): it stays in real P&L but is excluded from every edge metric, never links an offer, and stamps the bookie's cadence plan.",
      "Link an event once - score changes settle match odds, BTTS, O/U 2.5 and 2UP together.",
      "Use “The bet wins IF …” for goalscorer and combo triggers - settles at the decisive moment.",
      "Advanced lay mode supports part lays, underlay and overlay for boosted-odds plays.",
      "Lock in on any open single: enter today's exchange prices and close the position for a guaranteed P&L - slide to lock part and let the rest ride. 2UP bets lock on the 2UP Desk instead.",
    ],
    guideSlug: "calculators",
  },
  acca: {
    title: "Acca Desk",
    summary: "Multi-day accas. Lay each leg when it is due.",
    bullets: [...ACCA_DESK_HELP_BULLETS],
    guideSlug: "desk-how-tos",
  },
  "bet-builder": {
    title: "Bet Builder Desk",
    summary: "Same-event builders with one kick-off and one combined lay.",
    bullets: [
      "Selections share one event — unlike Acca Desk, which spans multiple kick-offs.",
      "Combined lay: one equalising stake/odds (correct-score collapse, or any single exchange market you found).",
      "No lay: deliberate back-only — common for free-bet clears and +EV qualifiers that are hard to match.",
      "Free-bet converts debit the lot as free_snr; a lose settles at £0 P&L.",
      "The back and lay are real Profit Tracker bets.",
    ],
    guideSlug: "desk-how-tos",
  },
  systems: {
    title: "Systems Desk",
    summary: "Log full-cover tickets, settle selections, track P&L.",
    bullets: [
      "Paste a bookie or Lucky Finder slip to pre-fill structure, unit stake, each-way and selections.",
      "No Acca-style lay workflow: these tickets are for organisation, mug cover, and value-play tracking.",
      "Mark each selection Won / Lost / Void (Placed on each-way when it finishes in the places but not first).",
      "Each-way doubles stake; win and place parts settle from stored place terms (1/4 or 1/5).",
      "Classify as EV play, mug bet, or qualifying so Report can separate edge from camouflage.",
    ],
    guideSlug: "desk-how-tos",
  },
  boosts: {
    title: "Boosts",
    summary: "Fair-price verdicts for boosts and builders.",
    bullets: [
      "Price boost: fill the Back Bet and Lay Bet panels - fair price is the exchange back/lay no-vig midpoint, and the verdict shows the edge at the boosted odds.",
      "Advanced (on the Lay Bet panel) unlocks part lays and the underlay/standard/overlay slider - Underlay is the boost play: £0 back if it loses, the full edge if it wins.",
      "Bet builder: enter fair odds per leg; same-match legs are correlated, so set a haircut to shorten the naive product. Builders are verdict-only - they can't be laid as one bet.",
      "Log for later saves an EV check (Logged). Place bet creates that row then opens Add bet as type Boost - confirm to commit balances, In-bets and Profit Tracker.",
      "Diary tabs: All / Logged / Placed. Click a Logged row to place. Settle Won/Lost/Void only on Placed rows - same action as Profit Tracker.",
      "Check from anywhere: the + on the Boosts nav row (or Quick actions on mobile) opens this checker as a dialog.",
    ],
  },
  casino: {
    title: "Casino",
    summary: "Wagering campaigns with an honest EV per step.",
    bullets: [
      "Log offer: name the campaign, then add steps - qualifying wager, cash, bonus, free spins, golden chips or cashback. Paste the promo to prefill.",
      "Repeats: tick Repeats on create for daily/weekly/monthly reloads - each occurrence is its own campaign with the same steps and freshly derived EV. Stop from any card when the promo ends.",
      "Calendar / Campaigns: the desk splits like Offers - calendar by expiry, campaigns for the full list.",
      "The eligible-games picker stars the highest-RTP slot; the Game library holds published base RTPs - operators can license lower variants, so verify in the game info.",
      "EV here is an expectation across many attempts, never a lock - Simulate runs the whole campaign (10,000 sessions) with a volatility preset.",
      "Completing a campaign updates the bookie wallet, posts a Casino settled row to History and the Home feed, and counts the net result in total P&L as Casino P&L (separate from Betting P&L).",
    ],
    guideSlug: "desk-how-tos",
  },
  offers: {
    title: "Offers",
    summary: "Track promos, next actions, and what to do today.",
    bullets: [
      "Campaigns: pipeline stages, filters, and edit/complete. Calendar: Today / This week / Later.",
      "Got a promo email? Drop the .eml straight into Paste offer (or paste its text) - it parses locally into the same preview, subject line included.",
      "Racing offers drive Intelligence on the Racing Desk - add a place-refund offer first.",
      "Expiry is the earlier of the Expires field or a scoped race/match time - missed windows show as Missed race / Missed match.",
      "Daily tasks digest (Settings → Automation) sends one morning briefing of Do Next work due in the next few days; same-day / race interrupts still use Alerts.",
    ],
    guideSlug: "offers",
  },
  calculators: {
    title: "Calculators",
    summary: "Matched betting toolkit. Core calcs go to the tracker.",
    bullets: [
      "Matched Betting - qualifiers, free bets (SNR/SR) and risk-free offers.",
      "Dutching - equal-profit splits; 2UP dutch mode for early-payout windfalls.",
      "Each Way & Extra Place - lay win and place separately for extra-place offers.",
      "Fill slip: the lay-stake banner (and Lock in / Acca Desk) can fill your exchange betslip via the Edgeways browser extension - fill only, you always place the bet yourself. Without the extension the stake still lands on your clipboard.",
    ],
    guideSlug: "calculators",
  },
  "tracked-events": {
    title: "Tracked Events",
    summary: "Matches and races you follow. Scores refresh live.",
    bullets: [
      "Events are grouped by kick-off day, same Today / Yesterday split as Campaigns.",
      "All, Today, Upcoming, Past, or Jump to day to open a past date.",
      "Add a match or race from Fixtures with +, or add one manually.",
      "Goal timelines fetch only when you have an open trigger bet on the match.",
      "Racing results usually land automatically while the desk is open; if not, use Set winner.",
      "Finished events stay here until you remove them.",
    ],
    guideSlug: "getting-started",
  },
  settings: {
    title: "Settings",
    summary: "Defaults, appearance, and data export.",
    bullets: [
      "Subscription: plan, trial, Preview Edge and Manage subscription. Card, invoices and cancel open in Stripe.",
      "Default bookie and exchange are set in Preferences - saved as you pick them.",
      "Exchanges and bookie status: Accounts → Manage venues.",
      "Racing cards refresh about every 15 minutes. Exchange prices are delayed about 1–3 minutes. Football live scores update about once a minute.",
      "Export bets, settlements and accounts as CSV anytime from Data & backup.",
    ],
    guideSlug: "faq",
  },
  history: {
    title: "History",
    summary: "Bets, casino, promos, and live match moments.",
    bullets: [
      "Filter by bets, settlements, casino, promos or match events.",
      "Times align to when things happened - kick-off, goals, full time, casino complete.",
      "Settled bets and completed casino campaigns appear with realised P&L highlighted.",
      "Builds automatically as you track events, log bets and complete casino campaigns.",
    ],
    guideSlug: "getting-started",
  },
  accounts: {
    title: "Accounts",
    summary: "Bookie and exchange wallets, free bets, and the ledger.",
    bullets: [
      "Banks fund deposits; Transfer moves cash to bookies (withdrawals can stay pending).",
      "Manage venues: exchange commission, colours, bookie status and notes.",
      "Set wagering requirements on a bookie - cash bets auto-burn WR when odds qualify.",
      "Free bets show on Accounts and Home; Convert opens Add bet prefilled.",
      "First bet at a new bookie creates the account automatically.",
      "Rename a bookie to cascade the name across bets, offers and prefs.",
      "Mark bookies Available, Gubbed or Closed to filter offer next-actions.",
      "Household sets (J8): tag each account with its operator in Manage venues → Owner. Owner chips then filter Accounts, the league and the Edge Report; the top-bar total shows the household combined. Edgeways tracks accounts operated by their owner - it never encourages operating someone else's accounts. Shared wallet names attribute to you until renamed.",
      "Mug plans (league table → Plan): set a camouflage cadence and monthly budget per bookie. Due plans surface as low-priority Do next items and the league shows the month's mug cost on its own line.",
    ],
    guideSlug: "getting-started",
  },
};
