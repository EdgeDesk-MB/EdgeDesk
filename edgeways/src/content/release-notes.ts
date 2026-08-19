/**
 * Curated release notes - customer-facing highlights, newest first.
 * Write for the person using the desk, not the diff. Skip rebrands,
 * internals, and anything a customer does not need to see.
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
    date: "2026-08-10",
    title: "Offer completion playbook: deposit codes to clear wagering",
    summary:
      "Paste or forward a sports promo and Edgeways walks the campaign step by step, with the code on Step 1, Mark done for soft gates, and auto-advance from bets, deposits and wagering when the ledger can prove it.",
    entries: [
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Paste offer expands a drop zone on the New offer form. Fields fill as you paste; green ticks mark paste-filled values until you edit them. Same pattern on Log a casino offer. Sticky Add offer / Continue stays reachable.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Completion playbook on campaign cards: Step N of M with deposit → qualify → await award → convert → clear wagering (when the T&Cs need it). Soft gates use Mark done; qualify and convert keep Place / Convert.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Paste and email intake capture promo codes, min deposit, reward event, winnings wagering, max conversion and payment exclusions. Dynobet-style Bet & Get emails land with the right stakes and Step 1 = deposit + code.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Deposit step shows the promo code for one-tap copy. After Mark done (or a matching Accounts transfer/top-up), Do next and Track move on to the qualifying bet, so you are not offered Place while a deposit is still due.",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Convert prefills lock the reward event when the offer names one (e.g. PSG vs Villa). Clear-wagering watches bookie WR after convert: shows pounds left, links to Accounts, and auto-completes only once outstanding WR has burned to £0.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/desk",
        text: "Do next surfaces playbook steps first (deposit / opt-in / clear wagering) so deposit-gated campaigns do not look like ready-to-qualify Track cards.",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Paste preview calls out deposit + code before you save. Classic bet&get without a deposit gate still starts at qualify.",
      },
    ],
  },
  {
    date: "2026-08-06",
    title: "Combo desks: Bet Builder, Systems, and place tools",
    summary:
      "Full-cover systems and bet builders sit beside Acca, and Racing Desk gains place-aware tools.",
    entries: [
      {
        kind: "feature",
        area: "Bet Builder",
        href: "/bet-builder",
        text: "Bet Builder Desk joins the Combo group: create a run, track selections, settle the whole ticket, and open it from offers, Do next or free-bet convert when the campaign is bet-builder shaped.",
      },
      {
        kind: "feature",
        area: "Systems",
        href: "/systems",
        text: "Systems Desk for Lucky / Patent / Trixie / Yankee / Canadian (Goliath): paste a slip, organise legs, settle per leg with combination returns (void refunds dead lines), and classify as an EV play or mug bet. Not a finder - it tracks the system you already built.",
      },
      {
        kind: "improvement",
        area: "Acca Desk",
        href: "/acca",
        text: "Acca runs share paste-slip create with Bet Builder, support combined and no-lay methods, and show a clearer leg timeline while a run is live.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        href: "/racing",
        text: "Active bets strip and place-zone bar on the card so each-way and place-refund work stays next to the runners, plus a clearer today P&L view for the desk.",
      },
      {
        kind: "feature",
        area: "Each Way",
        href: "/calculators/each-way",
        text: "Each Way / Extra Place calculator on the desk: place ladder and dual-lay settle paths.",
      },
      {
        kind: "feature",
        area: "Feedback",
        href: "/feedback",
        text: "Feedback in the top menu: pick Bug, Idea or Other, add a summary and details, then send or copy a report.",
      },
      {
        kind: "improvement",
        area: "Alerts",
        href: "/alerts",
        text: "Quieter toasts for actions you just took, and clearer settle-related copy.",
      },
    ],
  },
  {
    date: "2026-08-05",
    title: "Make it yours: appearance, reminders, and Acca from offers",
    summary:
      "Personalise the desk, set casino and offer reminders, and route multi-leg campaigns into the right combo desk.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Appearance: choose a brand accent, header pattern and UI font. The desk keeps your choices across visits.",
      },
      {
        kind: "feature",
        area: "Casino",
        href: "/casino",
        text: "Set a reminder on a campaign for free spins or bonuses that land later. It fires into the alerts inbox and as a push when due.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Qualifier and reward scope (Single / Acca / Bet builder): Place and Convert open the matching combo desk when entitled, with a chooser if more than one path applies. Free-bet Acca convert lands as SNR on the Acca run.",
      },
      {
        kind: "improvement",
        area: "Tracker",
        href: "/tracker",
        text: "Campaign sections, settle flows and P&L breakdown polish so multi-leg and offer-linked positions are easier to scan.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Monthly targets and demo mode",
    summary:
      "A target to pace the month against, and a safe parallel desk for showing Edgeways off.",
    entries: [
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "Monthly target: set one in Settings and the Monthly P&L chip shows factual pace - \"£162 of £250 · on pace\" or the £/day needed over the days left. No streaks, no confetti; a bad-variance week is not behind plan if the edge was captured.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Demo mode: a separate, seeded, clearly watermarked desk for screenshots and walkthroughs - six accounts, a month of settled campaigns, an open qualifier and a tagged leak, so every page looks lived-in. Your real data never mixes with it.",
      },
      {
        kind: "improvement",
        area: "Settings",
        href: "/settings",
        text: "Demo data can be wiped in one tap. The next demo run reseeds fresh, and a wipe can only ever touch the demo desk.",
      },
      {
        kind: "feature",
        area: "Edge Report",
        href: "/report",
        text: "Season summary: a Year tab on the Edge Report - profit, expected vs realised and capture month by month, commission drag, retention, and your best and worst bookmakers of the year. Months before your first EV lock show settled profit only, with the coverage window stated plainly rather than implying a capture rate that was never measured.",
      },
      {
        kind: "improvement",
        area: "Accessibility",
        href: "/help?guide=keyboard",
        text: "Screen readers name every switch and icon button, Reduce motion stills pulsing indicators and dialog animations, and a Keyboard & accessibility guide in Help documents the palette and everyday keys.",
      },
      {
        kind: "fix",
        area: "Mobile",
        href: "/help?guide=mobile",
        text: "Opening Edgeways on your phone no longer loads a dead page. A new On your phone guide covers installing the app and enabling notifications on Android.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Set up your desk: a four-step wizard for bank and bankroll, your bookies with balances, bet defaults, and notifications. A fresh install reaches a working desk in under a minute; re-run it any time from Settings → Help & about.",
      },
      {
        kind: "fix",
        area: "Alerts",
        text: "In-app notifications on Android now show reliably, with the same tap-to-open links as push.",
      },
      {
        kind: "improvement",
        area: "Navigation",
        text: "The sidebar groups into Betting, Live desks and Insight. On the phone the burger is a full-height drawer with the whole sectioned navigation, and appearance is a Light / Dark / System control.",
      },
      {
        kind: "feature",
        area: "Help",
        href: "/help?guide=site-map",
        text: "Site map: every page and where it lives, including sub-navigation, quick actions and the pages that sit outside the main nav.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Match Checker, alerts inbox, push and the palette",
    summary:
      "Found a price? Get a verdict in seconds. Missed a notification? It is waiting for you, or on your phone. And everything is two keystrokes away.",
    entries: [
      {
        kind: "feature",
        area: "Match Checker",
        href: "/match-checker",
        text: "New Match Checker page: enter the back and lay odds and get a good/ok/poor verdict with the qualifying cost or locked-in free-bet profit, the lay stake and liability, and both outcomes side by side. Commission prefills from your default exchange, and one tap opens the full calculator with everything carried over. It checks the match you found - it never lists markets.",
      },
      {
        kind: "improvement",
        area: "Match Checker",
        href: "/match-checker",
        text: "Risk-free offers stay in the full calculator. Their verdict depends on refund amount and retention, and a silent assumption here would mislead.",
      },
      {
        kind: "feature",
        area: "Alerts",
        href: "/alerts",
        text: "Alerts inbox: every alert Edgeways raises is kept, with an unread badge in the navigation. Notifications and toasts deliver in the moment; the inbox is the record. Tap an alert to mark it read and jump to the right desk, or clear the lot with one tap.",
      },
      {
        kind: "improvement",
        area: "Alerts",
        href: "/alerts",
        text: "A condition that fires again updates its inbox entry rather than stacking duplicates, and an alert you have already read stays read.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Background push: flip Push to this device in Settings → Alerts and sentinel alerts reach your phone with every Edgeways tab closed.",
      },
      {
        kind: "improvement",
        area: "Settings",
        href: "/settings",
        text: "Send test push proves delivery from Settings. Push sits on top of the inbox, so nothing is lost to a flaky connection.",
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
      "Edgeways bends to how you operate. Every behaviour-defining threshold is yours to set, Home shows the widgets you choose, and your data has a proper backup, restore and import story.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "New Tuning card: unhedged-back grace windows, the offer-drought nudge, the retention prior and its weight, the mistake-tag prompt threshold, the Edge Report minimum, and per-action effort minutes behind the £/hr sort. Defaults match how Edgeways has always behaved; each row shows its default and resets in one tap.",
      },
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "Home layout is yours: show or hide any widget per mode and reorder the mobile deck. Desktop keeps its two-column design and adapts - hide the chart and the plan takes the full width. Hidden widgets stay reachable from their own pages.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "Data custody: one-tap backup of your entire desk, and a validated restore flow. The upload is checked, you confirm what it contains, and a safety copy of your current data is always saved first. A failed restore leaves everything untouched.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "CSV import wizard: bring bet history in from a spreadsheet - map your columns, preview, import. UK dates, £ signs and quoted fields all handled; unreadable rows are reported, never silently dropped.",
      },
      {
        kind: "improvement",
        area: "Settings",
        href: "/settings",
        text: "Imported history shows in your P&L and bookmaker stats, but it never changes balances, never links itself to campaigns, and never counts towards EV capture. The Edge Report stays honest.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Edge Report, mistake tags, and the bookmaker league",
    summary:
      "Edgeways now tells you whether you actually captured your edge, and where the leaks are: a monthly Edge Report, one-tap mistake tags and a bookmaker league table with manual health.",
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
        href: "/desk",
        text: "Gubbed bookies' offers sink to the bottom of Do next (and wear a Gubbed chip) but are never hidden. Closed accounts drop out entirely.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Unhedged backs and 2UP lock-in alerts",
    summary:
      "Edgeways now watches your positions: unhedged backs and triggered 2UP payouts raise alerts the moment they matter.",
    entries: [
      {
        kind: "feature",
        area: "Alerts",
        href: "/desk",
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
        text: "Each sentinel has its own toggle in Settings → Alerts.",
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
        href: "/desk",
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
        text: "Edgeways installs to your Home Screen as an app, with notifications for expiring offers, race off-times and settled results (toggleable per type).",
      },
      {
        kind: "improvement",
        area: "Mobile",
        text: "Full-page layouts on the phone; dialogs open as bottom sheets (small confirms stay centred); tracker and accounts tables become card lists; the Racing Desk leads with the offer workflow and tucks the runner grid behind a tap.",
      },
      {
        kind: "improvement",
        area: "Navigation",
        text: "The full main navigation lives in the burger menu on mobile.",
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
        href: "/desk",
        text: "Today's plan: offer deadlines, race off-times and kick-offs in one timeline, each slot with its expected £. Completed slots collapse but never reorder.",
      },
      {
        kind: "feature",
        area: "Chart",
        href: "/desk",
        text: "Retained | Gross toggle - gross adds back exchange commission so the cost of commission is visible rather than silently netted.",
      },
      {
        kind: "improvement",
        area: "Chart",
        href: "/desk",
        text: "Markers are directional triangles (green up = profit in, red down = loss out), sit exactly on the plotted line, and balance corrections get their own markers at the foot of their step.",
      },
      {
        kind: "fix",
        area: "Chart",
        href: "/desk",
        text: "Markers no longer drift off the line after a P&L-affecting balance adjustment.",
      },
    ],
  },
  {
    date: "2026-07-13",
    title: "Honest expected vs realised",
    summary:
      "Every expected-value figure is locked at the moment it becomes real, so expected vs realised is an honest comparison.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "EV lock + capture rate: expected profit snapshots when a campaign starts and is never silently changed. Edits create visible re-locks. Settled campaigns show \"Expected → Realised · % captured\".",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Expired campaigns record their realised-to-date honestly. Lost EV is real signal.",
      },
    ],
  },
  {
    date: "2026-07-12",
    title: "Measured retention and smarter ranking",
    summary:
      "Retention from your own conversions, provenance on every £-EV, smarter Do next ranking, and paste-to-log.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Free-bet retention is measured from your own conversions, blended with a cautious default until you have enough of them, instead of a flat 80% guess.",
      },
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "Every £-EV on screen carries a provenance badge - live, estimated or heuristic - and Home leads with the edge on the table.",
      },
      {
        kind: "feature",
        area: "Do next",
        href: "/desk",
        text: "£/hr rate sort, bankroll-aware ranking with funding shortfall chips, and paste-to-log that turns bookie confirmation text into a prefilled bet.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        href: "/racing",
        text: "No-vig fair odds per runner.",
      },
    ],
  },
];
