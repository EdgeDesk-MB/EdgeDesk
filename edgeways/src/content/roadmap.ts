export type RoadmapStatus = "done" | "in_progress" | "planned" | "future";

export interface RoadmapItem {
  id: string;
  title: string;
  description?: string;
  status: RoadmapStatus;
}

export interface RoadmapCategory {
  id: string;
  title: string;
  items: RoadmapItem[];
}

/**
 * Customer-facing roadmap. Rules: no internal ids, no vendor or feed names,
 * no version codenames. `current` is a diagnostics string (feedback reports);
 * the labels are what customers read.
 */
export const ROADMAP_VERSION = {
  current: "1.1.0-dev",
  currentLabel: "Beta",
  target: "1.0.0",
  targetLabel: "Launch",
  targetNote:
    "Everything marked Done is in your desk today. In progress and Planned are what we're finishing for launch; Future is what we're considering after.",
} as const;

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  done: "Done",
  in_progress: "In Progress",
  planned: "Planned",
  future: "Future",
};

export const ROADMAP_CATEGORIES: RoadmapCategory[] = [
  {
    id: "calculators",
    title: "Calculators",
    items: [
      {
        id: "calc-suite",
        title: "Full calculator suite",
        description:
          "Matched, each-way & extra place, accumulators, dutching, Rule 4, Refund-If and odds/EV converters",
        status: "done",
      },
      {
        id: "calc-2up-desk",
        title: "Early Payout (2UP) Desk",
        description: "Live in-play probability model with lock-in advice and dutch/lay ranking",
        status: "done",
      },
      { id: "calc-asian", title: "Asian handicap calculator", status: "future" },
    ],
  },
  {
    id: "racing",
    title: "Racing",
    items: [
      {
        id: "race-desk",
        title: "Racing Desk with racecards and results",
        description: "Every UK & Irish card, with automatic result settlement",
        status: "done",
      },
      {
        id: "race-workflow",
        title: "Guided racing offer workflow",
        description: "Pick a runner, place the back, lay it off, log it — step by step",
        status: "done",
      },
      {
        id: "race-exchange",
        title: "Exchange lay prices, liquidity and movement",
        description: "Exchange prices on every racecard, sorted favourite first",
        status: "done",
      },
      {
        id: "race-picks",
        title: "Smart race and runner recommendations",
        description:
          "A finishing-position model ranks races and runners by expected value; the desk marks qualifying vs recommended plays",
        status: "in_progress",
      },
      {
        id: "race-live-odds",
        title: "Live bookmaker prices on the Racing Desk",
        description: "Compare bookmaker and exchange prices side by side",
        status: "planned",
      },
      { id: "race-silks", title: "Jockey silks on racecards", status: "future" },
    ],
  },
  {
    id: "football",
    title: "Football",
    items: [
      {
        id: "fb-fixtures",
        title: "Fixture browser with live match tracking",
        status: "done",
      },
      {
        id: "fb-live",
        title: "Live match dashboard",
        description: "In-play P&L chart, commentary timeline and trigger alerts as goals go in",
        status: "done",
      },
      {
        id: "fb-ep-live",
        title: "Real-time 2UP value while the match is live",
        description: "In-play expected value on the 2UP Desk, minute by minute",
        status: "done",
      },
    ],
  },
  {
    id: "offers",
    title: "Offers",
    items: [
      {
        id: "off-library",
        title: "Offer library with calendar and reminders",
        description: "Track every promotion; expiry reminders so free bets never lapse",
        status: "done",
      },
      {
        id: "off-pipeline",
        title: "Offer pipeline from planned to settled",
        description: "Each offer moves through clear stages with a checklist of steps",
        status: "done",
      },
      {
        id: "off-next",
        title: "What to do next, ranked by value",
        description: "A daily queue of your next best actions across every offer",
        status: "done",
      },
      {
        id: "off-parser",
        title: "Paste-in offer terms",
        description: "Paste a promotion's terms and Edgeways structures the offer for you",
        status: "done",
      },
      {
        id: "off-health",
        title: "Bookmaker account health",
        description: "Restriction-aware pickers, plus per-offer stake and bookmaker memory",
        status: "done",
      },
    ],
  },
  {
    id: "tracker",
    title: "Tracker & P&L",
    items: [
      {
        id: "trk-log",
        title: "Bet log with automatic settlement",
        description: "Link bets to events; results settle them for you, including voids and partials",
        status: "done",
      },
      {
        id: "trk-ocr",
        title: "Screenshot bet import",
        description: "Snap or paste a bet slip screenshot to log a bet",
        status: "done",
      },
      {
        id: "trk-accounts",
        title: "Accounts and wallets",
        description:
          "Bookmaker, exchange and bank balances with transfers, pending credits and free-bet lots",
        status: "done",
      },
      {
        id: "trk-pnl",
        title: "Profit & loss analytics",
        description: "Monthly breakdowns, per-bookmaker P&L and CSV export",
        status: "done",
      },
      {
        id: "trk-campaigns",
        title: "Bet campaigns",
        description: "Group the bets around one offer and see open, unlayed and settled positions",
        status: "done",
      },
    ],
  },
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      { id: "ux-onboarding", title: "Guided setup and welcome tour", status: "done" },
      {
        id: "ux-guides",
        title: "Guides, page help and keyboard shortcuts",
        status: "done",
      },
      {
        id: "ux-design",
        title: "Dark and light themes, polished on phone and desktop",
        status: "done",
      },
    ],
  },
];

export function roadmapStats() {
  const all = ROADMAP_CATEGORIES.flatMap((c) => c.items);
  return {
    done: all.filter((i) => i.status === "done").length,
    inProgress: all.filter((i) => i.status === "in_progress").length,
    planned: all.filter((i) => i.status === "planned").length,
    future: all.filter((i) => i.status === "future").length,
    total: all.length,
  };
}
