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

export const ROADMAP_VERSION = {
  current: "1.1.0-dev",
  currentLabel: "v1.1 Offer Command",
  target: "1.1.0",
  targetLabel: "v1.1",
  targetNote:
    "Offer Command Centre - next-action engine on Home, offer pipeline stages, bet campaigns, and advantage ranking. v1.0 RC remains the recoverable baseline on main / backup/pre-offer-command-centre.",
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
      { id: "calc-matched", title: "Matched betting calculator", status: "done" },
      { id: "calc-dutching", title: "Dutching + 2UP dutch mode", status: "done" },
      { id: "calc-2up", title: "Early Payout (2UP) calculator", status: "done" },
      { id: "calc-ew", title: "Each Way & Extra Place", status: "done" },
      { id: "calc-acca", title: "Accumulator family", status: "done" },
      { id: "calc-seq-lay", title: "Sequential lay", status: "done" },
      { id: "calc-ep-desk", title: "2UP Desk (Dixon-Coles + dutch/lay ranker)", status: "done" },
      { id: "calc-refund-if", title: "Refund-If calculator", status: "done" },
      { id: "calc-rule4", title: "Rule 4 calculator", status: "done" },
      { id: "calc-ev", title: "EV / odds converter tools", status: "done" },
      { id: "calc-lucky", title: "Lucky 31/63 lay matrix", status: "done" },
      { id: "calc-arb", title: "Arbitrage & Kelly criterion", status: "future" },
      { id: "calc-asian", title: "Asian handicap", status: "future" },
    ],
  },
  {
    id: "racing",
    title: "Racing",
    items: [
      { id: "race-desk", title: "Racing Desk with racecards", status: "done" },
      { id: "race-intel", title: "Intelligence modal & offer targeting", status: "done" },
      { id: "race-proxy", title: "Betfair lay integration (no invented bookie prices)", status: "done" },
      { id: "race-workflow", title: "Guided offer workflow (pick → back → lay → log)", status: "done" },
      { id: "race-settle", title: "Settle prompts for finished races", status: "done" },
      { id: "race-steamer", title: "Local steamer/drifter from snapshot polling", status: "done" },
      { id: "race-intel-v3", title: "Intelligence confidence tiers (live / proxy / demo)", status: "done" },
      { id: "race-results", title: "Auto race settlement (Racing API Basic)", status: "done" },
      {
        id: "race-odds-override",
        title: "Manual odds override on Racing Desk",
        description: "Paste real bookie prices - Free tier has no live bookie feed",
        status: "done",
      },
      {
        id: "race-desk-exchange",
        title: "Racing Desk exchange override + lay size / movement",
        description: "Settings default persists app-wide; Desk can override; liquidity + exchange steamer",
        status: "done",
      },
      {
        id: "race-sort-lay",
        title: "Sort racecard by exchange lay (favourite first)",
        status: "done",
      },
      {
        id: "race-live-odds",
        title: "Live bookie odds (Racing API Standard)",
        description: "Paid upgrade path - not required for personal free stack",
        status: "planned",
      },
      {
        id: "race-oddsmatcher",
        title: "Oddsmatcher / best-price across bookies",
        description: "v2 paid product direction - needs commercial odds feed",
        status: "future",
      },
      { id: "race-silks", title: "Silks images on racecards", status: "future" },
    ],
  },
  {
    id: "football",
    title: "Football / Live",
    items: [
      { id: "fb-fixtures", title: "Fixture browser + API-Football integration", status: "done" },
      { id: "fb-sim", title: "Built-in match simulator (2UP drama)", status: "done" },
      { id: "fb-dashboard", title: "Live dashboard with Liveline P&L chart", status: "done" },
      { id: "fb-triggers", title: "Goalscorer & combo trigger engine", status: "done" },
      { id: "fb-history", title: "Flashscore-style history feed", status: "done" },
      { id: "fb-model", title: "Live in-play probability model", status: "done" },
      {
        id: "fb-ep-live",
        title: "Real-time EP Edge Desk in-play EV",
        description: "2UP Desk Live tab - minute + Dixon-Coles model EV vs snapshot",
        status: "done",
      },
    ],
  },
  {
    id: "offers",
    title: "Offers",
    items: [
      { id: "off-crud", title: "Offer library (place-refund, general)", status: "done" },
      { id: "off-remind", title: "Expiry reminders", status: "done" },
      { id: "off-link", title: "Auto-link bets to offers", status: "done" },
      { id: "off-pnl", title: "Per-offer P&L slice on dashboard", status: "done" },
      { id: "off-checklist", title: "Offer checklist / step tracker", status: "done" },
      {
        id: "off-next-actions",
        title: "Next-action engine + Home queue",
        description: "Ranked next steps per offer campaign on Home and Offers nav badge",
        status: "done",
      },
      {
        id: "off-pipeline",
        title: "Offer pipeline stages UX",
        description: "Planned → Qualifying → Awarded → Converting → Settled",
        status: "done",
      },
      {
        id: "off-advantage",
        title: "Advantage ranking (expected retained value)",
        status: "done",
      },
      { id: "off-calendar", title: "Offer calendar with reminders", status: "done" },
      {
        id: "off-templates",
        title: "Offer template import / terms parser",
        description: "Paste from Matched Betting Blog / promo emails",
        status: "done",
      },
      {
        id: "off-available-bookies",
        title: "Available bookies (gubbed-aware)",
        description: "Offers filter + pickers prefer Available wallets; gubbed flagged",
        status: "done",
      },
      {
        id: "off-bet-memory",
        title: "Remember last stake/bookie per offer",
        description: "Place-refund and lay prefills reuse your last stake and bookie for that offer",
        status: "done",
      },
    ],
  },
  {
    id: "tracker",
    title: "Tracker & P&L",
    items: [
      { id: "trk-log", title: "Bet log with event linking", status: "done" },
      { id: "trk-settle", title: "Result-centric auto-settlement", status: "done" },
      { id: "trk-ocr", title: "OCR bet screenshot import", status: "done" },
      { id: "trk-adv-lay", title: "Advanced lay (part lays, underlay/overlay)", status: "done" },
      { id: "trk-balances", title: "Accounts (bookie / exchange wallets)", status: "done" },
      { id: "trk-accounts-p0", title: "Accounts P0: ensure-on-bet, rename cascade, Accounts nav", status: "done" },
      { id: "trk-accounts-p1", title: "Accounts P1: banks, transfers, pending credits, funded-by", status: "done" },
      { id: "trk-accounts-p2", title: "Accounts P2: wagering requirements + free-bet distribution", status: "done" },
      {
        id: "trk-accounts-p3",
        title: "Accounts P3: special-bonus calc (double win/return, FB/cash on win/lose)",
        description: "Ultimatcher matrix on Matched calculator; Refund-IF stays on its dedicated calc",
        status: "done",
      },
      {
        id: "trk-partial-settle",
        title: "Half-win / half-lose / push settlement",
        description: "Ultimatcher Pending-sheet partials + void returns stakes to ledger",
        status: "done",
      },
      { id: "trk-export", title: "CSV export", status: "done" },
      { id: "trk-monthly", title: "Monthly breakdown & per-bookie P&L", status: "done" },
      {
        id: "trk-campaigns",
        title: "Bet campaigns & offer queues",
        description: "Group bets by offer; Open / Needs lay / Orphans views",
        status: "done",
      },
      {
        id: "trk-settle-inbox",
        title: "Settlement inbox",
        description: "Tracker Settle queue - open bets on finished events",
        status: "done",
      },
      {
        id: "trk-2up-dutch",
        title: "2UP dutch campaign workflow",
        description: "Fixtures → 2UP Desk EV → gubbed-aware books → one-click dutch log",
        status: "done",
      },
      {
        id: "trk-tonight-polish",
        title: "Tonight polish: France–Morocco path + Offers deep-links",
        description:
          "Demo WC fixture, EP odds reset, Log dutch on verdict, convert/qualify + offers highlight, settle badge",
        status: "done",
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    items: [
      { id: "int-racing-api", title: "The Racing API (free + paid tiers)", status: "done" },
      { id: "int-betfair", title: "Betfair Exchange (delayed + live keys)", status: "done" },
      { id: "int-football", title: "API-Football with budget guard", status: "done" },
      { id: "int-betdaq", title: "Betdaq partner API", status: "future" },
      { id: "int-matchbook", title: "Matchbook / Smarkets APIs", status: "future" },
      { id: "int-tauri", title: "Tauri macOS .app packaging", description: "After 1.0 - not before product is settled", status: "future" },
    ],
  },
  {
    id: "ux",
    title: "UX & Help",
    items: [
      { id: "ux-theme", title: "Dark/light theme toggle", status: "done" },
      { id: "ux-nav", title: "Sidebar nav with quick actions", status: "done" },
      { id: "ux-help", title: "Help hub, page help triggers & guides", status: "done" },
      { id: "ux-onboard", title: "Welcome tour & first-run onboarding", status: "done" },
      { id: "ux-empty", title: "Polished empty states with CTAs", status: "done" },
      { id: "ux-roadmap", title: "In-app roadmap page", status: "done" },
      { id: "ux-design", title: "Full design system pass", status: "done" },
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
