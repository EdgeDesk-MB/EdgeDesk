/**
 * Curated release notes - user-facing highlights, newest first. Sourced from
 * the git history but written for the person using the app, not the diff.
 * Add a group per release day (or milestone) as work ships.
 */

export type ReleaseNoteKind = "feature" | "improvement" | "fix";

export interface ReleaseNoteEntry {
  kind: ReleaseNoteKind;
  /** Short area tag, e.g. "Home", "Mobile", "Racing Desk" */
  area: string;
  /** In-app route for the upgraded experience - the area tag links here */
  href?: string;
  text: string;
}

export interface ReleaseNoteGroup {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  summary: string;
  entries: ReleaseNoteEntry[];
}

export const RELEASE_NOTE_KIND_LABELS: Record<ReleaseNoteKind, string> = {
  feature: "New",
  improvement: "Improved",
  fix: "Fixed",
};

export const RELEASE_NOTES: ReleaseNoteGroup[] = [
  {
    date: "2026-07-14",
    title: "The workbench: Match Checker, alerts inbox, push and the palette",
    summary:
      "Found a price? Get a verdict in seconds. Missed a notification? It's waiting for you, or on your phone. And everything is two keystrokes away.",
    entries: [
      {
        kind: "feature",
        area: "Match Checker",
        href: "/match-checker",
        text: "New Match Checker page: enter the back and lay odds and get a good/ok/poor verdict with the qualifying cost or locked-in free-bet profit, commission prefilled from your default exchange, and one tap into the full calculator. It checks the match you found - it never lists markets.",
      },
      {
        kind: "feature",
        area: "Alerts",
        href: "/alerts",
        text: "Alerts inbox: every alert EdgeDesk raises is kept with an unread badge in the navigation. Notifications and toasts deliver in the moment; the inbox is the record - tap an alert to jump to the right desk.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Background push: flip \"Push to this device\" in Settings → Alerts and sentinel alerts reach your phone with the app closed. Works anywhere your phone has signal, as long as the EdgeDesk server is running at home.",
      },
      {
        kind: "feature",
        area: "Navigation",
        text: "Command palette: Cmd/Ctrl+K anywhere jumps to any page, open offer or bookie wallet, and runs the quick actions - add a bet, start an offer, open the calculator, adjust a balance.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Your rules: tuning, Home layout and data custody",
    summary:
      "EdgeDesk bends to how you operate - every behaviour-defining threshold is yours to set, Home shows the widgets you choose, and your data has a proper backup, restore and import story.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "New Tuning card: unhedged-back grace windows, the offer-drought nudge, the retention prior and its weight, the mistake-tag prompt threshold, the Edge Report minimum, and per-action effort minutes behind the £/hr sort. Defaults match how EdgeDesk has always behaved, each row shows its default and resets in one tap.",
      },
      {
        kind: "feature",
        area: "Home",
        href: "/",
        text: "Home layout is yours: show or hide any widget per mode and reorder the mobile deck. Desktop keeps its two-column design and adapts - hide the chart and the plan takes the full width. Hidden widgets stay reachable from their own pages.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Data custody: one-tap backup (.db or JSON), validated restore that always saves a pre-restore safety copy first, and a CSV import wizard that brings spreadsheet bet history in - imported bets never change balances and never count towards EV capture.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "The Coach",
    summary:
      "EdgeDesk now tells you whether you actually captured your edge - and where the leaks are: a monthly Edge Report, one-tap mistake tags and a bookmaker league table with manual health.",
    entries: [
      {
        kind: "feature",
        area: "Edge Report",
        href: "/report",
        text: "New Edge Report page: cumulative expected edge (stepped at lock time) vs realised P&L (stepped at settle time), with capture rate, commission drag and free-bet retention for the month. Months with fewer than five settled campaigns show a not-enough-data state instead of noisy lines.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Mistake ledger: when a settled campaign captures under 90% of its locked EV, the post-mortem line offers one-tap tags (laid late, wrong market, odds moved, bookie voided, other). The Edge Report totals the £ lost per tag - \"Where the leak is\".",
      },
      {
        kind: "feature",
        area: "Accounts",
        href: "/accounts",
        text: "Bookmaker league table: realised profit, ROI, free-bet retention, offer count and days since the last offer per bookie. Health is yours to set - mark a bookie as cooling, and a 40-day offer drought earns a gentle \"mark as cooling?\" nudge.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/",
        text: "Gubbed bookies' offers sink to the bottom of Do next (and wear a Gubbed chip) but are never hidden - closed accounts drop out entirely.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Guardian sentinels",
    summary:
      "EdgeDesk now watches your positions: unhedged backs and triggered 2UP payouts raise alerts the moment they matter.",
    entries: [
      {
        kind: "feature",
        area: "Alerts",
        href: "/",
        text: "Naked-exposure sentinel: an open qualifying or risk-free back with no lay raises an amber Home banner and an alert after 10 minutes (3 minutes near the off). One tap marks it intentional.",
      },
      {
        kind: "feature",
        area: "Alerts",
        href: "/calculators/ep-desk",
        text: "Live 2UP sentinel: when your team goes two up, the alert includes an exact lock-in suggestion - the equalising in-play back, stake and guaranteed profit, priced from the live model.",
      },
      {
        kind: "improvement",
        area: "Settings",
        href: "/settings",
        text: "Both sentinels have their own alert toggles alongside the existing three.",
      },
    ],
  },
  {
    date: "2026-07-13",
    title: "The mobile experience",
    summary:
      "A dedicated phone experience: swipeable Home, full-page layouts, bottom sheets, three-tap bet capture and an installable app.",
    entries: [
      {
        kind: "feature",
        area: "Mobile",
        href: "/",
        text: "Home is a swipeable deck on the phone - Overview, Today's plan, Chart, Feed and Do next as full-screen cards with pagination dots, remembered position and a context-aware start card (pin it in Settings).",
      },
      {
        kind: "feature",
        area: "Mobile",
        href: "/tracker",
        text: "Quick-log: a floating + on every mobile screen captures a bet in three taps - paste a slip, tap a plan slot, or log bookie/stake/odds. Captured bets are flagged for desktop review in the tracker.",
      },
      {
        kind: "feature",
        area: "Mobile",
        href: "/settings",
        text: "EdgeDesk installs to your Home Screen as an app, with local notifications for expiring offers, race off-times and settled results (toggleable per type).",
      },
      {
        kind: "improvement",
        area: "Mobile",
        text: "Full-page layouts with no desktop gutters; dialogs open as bottom sheets (small confirms stay centred); tracker and accounts tables become card lists; the Racing Desk leads with the offer workflow and tucks the runner grid behind a tap.",
      },
      {
        kind: "improvement",
        area: "Navigation",
        text: "The full main navigation now lives in the burger menu on mobile.",
      },
    ],
  },
  {
    date: "2026-07-13",
    title: "The Daily Plan and honest P&L",
    summary:
      "One time-ordered run-sheet for the day, and a chart that can show exactly what commission costs.",
    entries: [
      {
        kind: "feature",
        area: "Home",
        href: "/",
        text: "Today's plan: offer deadlines, race off-times and kick-offs in one timeline, each slot with its expected £. Completed slots collapse but never reorder.",
      },
      {
        kind: "feature",
        area: "Chart",
        href: "/",
        text: "Retained | Gross toggle - gross adds back exchange commission so the cost of commission is visible rather than silently netted.",
      },
      {
        kind: "improvement",
        area: "Chart",
        href: "/",
        text: "Markers are directional triangles (green up = profit in, red down = loss out), sit exactly on the plotted line, and balance corrections get their own markers at the foot of their step.",
      },
      {
        kind: "fix",
        area: "Chart",
        href: "/",
        text: "Markers no longer drift off the line after a P&L-affecting balance adjustment.",
      },
    ],
  },
  {
    date: "2026-07-13",
    title: "EV truth completed",
    summary:
      "Every expected-value figure is now locked at the moment it becomes real, so expected vs realised is finally an honest comparison.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "EV lock + capture rate: expected profit snapshots when a campaign starts and is never silently changed - edits create visible re-locks. Settled campaigns show \"Expected → Realised · % captured\".",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Expired campaigns record their realised-to-date honestly - lost EV is real signal.",
      },
    ],
  },
  {
    date: "2026-07-12",
    title: "Offer command centre foundations",
    summary:
      "The groundwork sprint: measured retention, provenance badges, edge on Home, smarter ranking and paste-to-log.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Free-bet retention is measured from your own conversions (Bayesian-blended for small samples) instead of a hardcoded 80%.",
      },
      {
        kind: "feature",
        area: "Home",
        href: "/",
        text: "Every £-EV on screen carries a provenance badge - live, estimated or heuristic - and Home leads with the edge on the table.",
      },
      {
        kind: "feature",
        area: "Do next",
        href: "/",
        text: "£/hr rate sort, bankroll-aware ranking with funding shortfall chips, and paste-to-log that turns bookie confirmation text into a prefilled bet.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        href: "/racing",
        text: "No-vig fair odds per runner, straight from the well-tested calc engine.",
      },
    ],
  },
];
