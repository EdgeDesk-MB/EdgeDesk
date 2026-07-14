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
    title: "Guardian sentinels",
    summary:
      "EdgeDesk now watches your positions: unhedged backs and triggered 2UP payouts raise alerts the moment they matter.",
    entries: [
      {
        kind: "feature",
        area: "Alerts",
        text: "Naked-exposure sentinel: an open qualifying or risk-free back with no lay raises an amber Home banner and an alert after 10 minutes (3 minutes near the off). One tap marks it intentional.",
      },
      {
        kind: "feature",
        area: "Alerts",
        text: "Live 2UP sentinel: when your team goes two up, the alert includes an exact lock-in suggestion - the equalising in-play back, stake and guaranteed profit, priced from the live model.",
      },
      {
        kind: "improvement",
        area: "Settings",
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
        text: "Home is a swipeable deck on the phone - Overview, Today's plan, Chart, Feed and Do next as full-screen cards with pagination dots, remembered position and a context-aware start card (pin it in Settings).",
      },
      {
        kind: "feature",
        area: "Mobile",
        text: "Quick-log: a floating + on every mobile screen captures a bet in three taps - paste a slip, tap a plan slot, or log bookie/stake/odds. Captured bets are flagged for desktop review in the tracker.",
      },
      {
        kind: "feature",
        area: "Mobile",
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
        text: "Today's plan: offer deadlines, race off-times and kick-offs in one timeline, each slot with its expected £. Completed slots collapse but never reorder.",
      },
      {
        kind: "feature",
        area: "Chart",
        text: "Retained | Gross toggle - gross adds back exchange commission so the cost of commission is visible rather than silently netted.",
      },
      {
        kind: "improvement",
        area: "Chart",
        text: "Markers are directional triangles (green up = profit in, red down = loss out), sit exactly on the plotted line, and balance corrections get their own markers at the foot of their step.",
      },
      {
        kind: "fix",
        area: "Chart",
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
        text: "EV lock + capture rate: expected profit snapshots when a campaign starts and is never silently changed - edits create visible re-locks. Settled campaigns show \"Expected → Realised · % captured\".",
      },
      {
        kind: "improvement",
        area: "Offers",
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
        text: "Free-bet retention is measured from your own conversions (Bayesian-blended for small samples) instead of a hardcoded 80%.",
      },
      {
        kind: "feature",
        area: "Home",
        text: "Every £-EV on screen carries a provenance badge - live, estimated or heuristic - and Home leads with the edge on the table.",
      },
      {
        kind: "feature",
        area: "Do next",
        text: "£/hr rate sort, bankroll-aware ranking with funding shortfall chips, and paste-to-log that turns bookie confirmation text into a prefilled bet.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        text: "No-vig fair odds per runner, straight from the well-tested calc engine.",
      },
    ],
  },
];
