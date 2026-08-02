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
    title: "Live Dashboard",
    summary:
      "Your command centre for running P&L. Settled profit plus provisional value of open bets, updated as results land.",
    bullets: [
      "Live P&L = settled profit + provisional open value (worst-case guaranteed until settle; live revaluation in-play).",
      "Matched free bets and lays count their known worst outcome immediately - the figure updates when the result settles.",
      "The Liveline chart streams while tracked matches or races are live.",
      "History column shows goals, 2UP triggers and settlements in real time.",
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
      "Proxy odds are ORF estimates - labelled clearly. Use Lay to open the matched calculator with your real odds.",
      "Intelligence scores races by offer fit, field size, and estimated EV - higher is better, not a guarantee.",
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
    summary:
      "Run acca offers as guided multi-day workflows - the desk says when and how much to lay, leg by leg.",
    bullets: [
      "Sequential lock: each leg is laid to cover the stake plus every liability paid so far - £0 if any leg loses; the final leg is equalised so the run ends the same either way.",
      "Insurance runs (refund if exactly one leg loses): lay leg-by-leg with the same cover rhythm, or lay the whole acca once at the combined price - pick per run.",
      "A leg turns LAY DUE once the previous result is in and kick-off is within 30 minutes - alert + push (mutable per run), plus a Daily Plan slot.",
      "Legs linked to a tracked event auto-result from the score; anything else settles with the Won/Lost/Void buttons.",
      "The acca back and every lay are real Profit Tracker bets - the desk orchestrates, the tracker owns the money.",
    ],
  },
  boosts: {
    title: "Boosts",
    summary:
      "Fair-price verdicts for price boosts and bet builders - and a diary of the EV you banked.",
    bullets: [
      "Price boost: fill the Back Bet and Lay Bet panels - fair price is the exchange back/lay no-vig midpoint, and the verdict shows the edge at the boosted odds.",
      "Advanced (on the Lay Bet panel) unlocks part lays and the underlay/standard/overlay slider - Underlay is the boost play: £0 back if it loses, the full edge if it wins.",
      "Bet builder: enter fair odds per leg; same-match legs are correlated, so set a haircut to shorten the naive product. Builders are verdict-only - they can't be laid as one bet.",
      "Log a check to the diary, then settle it Won/Lost/Void - the header keeps the running EV banked vs realised.",
      "Check from anywhere: the + on the Boosts nav row (or Quick actions on mobile) opens this checker as a dialog.",
      "Nothing is fetched: you type the prices you see, so verdicts carry an estimated basis (heuristic until you set a builder haircut).",
    ],
  },
  casino: {
    title: "Casino",
    summary:
      "Wagering campaigns with honest EV - each step (qualifying wager, bonus, spins, chips, cashback) has its own verdict, summed to a campaign total.",
    bullets: [
      "Log offer: name the campaign, then add steps - qualifying wager, cash, bonus, free spins, golden chips or cashback. Paste the promo to prefill.",
      "Repeats: tick Repeats on create for daily/weekly/monthly reloads - each occurrence is its own campaign with the same steps and freshly derived EV. Stop from any card when the promo ends.",
      "Calendar / Campaigns: the desk splits like Offers - calendar by expiry, campaigns for the full list.",
      "The eligible-games picker stars the highest-RTP slot; the Game library holds published base RTPs - operators can license lower variants, so verify in the game info.",
      "EV here is an expectation across many attempts, never a lock - Simulate runs the whole campaign (10,000 sessions) with a volatility preset.",
      "Casino money stays out of the matched P&L on purpose - this desk keeps its own score.",
    ],
    guideSlug: "desk-how-tos",
  },
  offers: {
    title: "Offers",
    summary:
      "Campaigns and calendar - track promos, next actions, and what to do today. Settled profit lives in the top bar.",
    bullets: [
      "Campaigns: pipeline stages, filters, and edit/complete. Calendar: Today / This week / Later.",
      "Got a promo email? Drop the .eml straight into Paste offer (or paste its text) - it parses locally into the same preview, subject line included.",
      "Racing offers drive Intelligence on the Racing Desk - add a place-refund offer first.",
      "Expiry is the earlier of the Expires field or a scoped race/match time - missed windows show as Missed race / Missed match.",
      "Expiry reminders fire at 7, 3 and 1 days before - toggle in Settings → Preferences.",
    ],
    guideSlug: "offers",
  },
  calculators: {
    title: "Calculators",
    summary: "The matched betting toolkit. Core calculators push straight to the profit tracker.",
    bullets: [
      "Matched Betting - qualifiers, free bets (SNR/SR) and risk-free offers.",
      "Dutching - equal-profit splits; 2UP dutch mode for early-payout windfalls.",
      "Each Way & Extra Place - lay win and place separately for extra-place offers.",
      "Fill slip: the lay-stake banner (and Lock in / Acca Desk) can fill your exchange betslip via the EdgeDesk browser extension - fill only, you always place the bet yourself. Without the extension the stake still lands on your clipboard.",
    ],
    guideSlug: "calculators",
  },
  "tracked-events": {
    title: "Tracked Events",
    summary: "Matches and races you're following. Live scores refresh automatically.",
    bullets: [
      "Simulate a 2UP match for the 60-second demo loop - no API keys needed.",
      "Goal timelines fetch only when you have an open trigger bet on the match.",
      "Racing: Basic tier auto-settles while the app is open; Free tier uses Set winner.",
      "Finished events stay here until you remove them.",
    ],
    guideSlug: "getting-started",
  },
  settings: {
    title: "Settings",
    summary: "Defaults, API connections and data export.",
    bullets: [
      "Default bookie and exchange are set in Preferences - saved as you pick them.",
      "Exchanges and bookie status: Accounts → Manage venues.",
      "Data & API shows connection status for API-Football, Racing API and Betfair.",
      "Free stack: Racing API + Betfair delayed key + optional API-Football = £0/month.",
      "Refresh rates: racing cards cached ~15 min; Betfair delayed ~1–3 min; football live ~60s.",
      "Restart the dev server after changing .env.local keys.",
      "Email intake: forward promo emails to a dedicated mailbox folder and the desk drafts them as Planned campaigns for review - the app password is stored locally unencrypted, so never use a main account.",
      "Export bets, settlements and accounts as CSV anytime.",
    ],
    guideSlug: "faq",
  },
  history: {
    title: "History",
    summary: "Full timeline of bets, settlements, promos and live match moments.",
    bullets: [
      "Filter by sport, settlements, promos or match events.",
      "Times align to when things happened - kick-off, goals, full time.",
      "Settled bets leaving Live positions appear here with realised P&L highlighted.",
      "Builds automatically as you track events and log bets.",
    ],
    guideSlug: "getting-started",
  },
  accounts: {
    title: "Accounts",
    summary:
      "Bookie and exchange wallets - balances, free bets, status and ledger. Top bar shows Exchange · In-bets · Total (Ultimatcher-style).",
    bullets: [
      "Banks fund deposits; Transfer moves cash to bookies (withdrawals can stay pending).",
      "Manage venues: exchange commission, colours, bookie status and notes.",
      "Set wagering requirements on a bookie - cash bets auto-burn WR when odds qualify.",
      "Free bets show on Accounts and Home; Convert opens Add bet prefilled.",
      "First bet at a new bookie creates the account automatically.",
      "Rename a bookie to cascade the name across bets, offers and prefs.",
      "Mark bookies Available, Gubbed or Closed to filter offer next-actions.",
      "Household sets (J8): tag each account with its operator in Manage venues → Owner. Owner chips then filter Accounts, the league and the Edge Report; the top-bar total shows the household combined. EdgeDesk tracks accounts operated by their owner - it never encourages operating someone else's accounts. Shared wallet names attribute to you until renamed.",
      "Mug plans (league table → Plan): set a camouflage cadence and monthly budget per bookie. Due plans surface as low-priority Do next items and the league shows the month's mug cost on its own line.",
    ],
    guideSlug: "getting-started",
  },
};
