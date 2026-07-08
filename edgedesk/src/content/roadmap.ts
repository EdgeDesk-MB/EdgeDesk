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
    "Offer Command Centre — next-action engine on Home, offer pipeline stages, bet campaigns, and advantage ranking. v1.0 RC remains the recoverable baseline on main / backup/pre-offer-command-centre.",
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
      { id: "calc-ep-desk", title: "EP Edge Desk (Dixon-Coles model)", status: "done" },
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
      { id: "race-proxy", title: "ORF proxy odds + Betfair lay integration", status: "done" },
      { id: "race-workflow", title: "Guided offer workflow (pick → back → lay → log)", status: "done" },
      { id: "race-settle", title: "Settle prompts for finished races", status: "done" },
      { id: "race-steamer", title: "Local steamer/drifter from snapshot polling", status: "done" },
      { id: "race-intel-v3", title: "Intelligence confidence tiers (live / proxy / demo)", status: "done" },
      { id: "race-results", title: "Auto race settlement (Racing API Basic)", status: "planned" },
      { id: "race-live-odds", title: "Live bookie odds (Racing API Standard)", status: "planned" },
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
      { id: "fb-model", title: "Live in-play probability model", status: "planned" },
      { id: "fb-ep-live", title: "Real-time EP Edge Desk in-play EV", status: "future" },
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
        status: "in_progress",
      },
      {
        id: "off-pipeline",
        title: "Offer pipeline stages UX",
        description: "Planned → Qualifying → Awarded → Converting → Settled",
        status: "planned",
      },
      {
        id: "off-advantage",
        title: "Advantage ranking (expected retained value)",
        status: "planned",
      },
      {
        id: "off-templates",
        title: "Offer template import / terms parser",
        status: "planned",
      },
      { id: "off-calendar", title: "Offer calendar with reminders", status: "future" },
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
      { id: "trk-balances", title: "Balances & bookmaker wallets", status: "done" },
      { id: "trk-export", title: "CSV export", status: "done" },
      { id: "trk-monthly", title: "Monthly breakdown & per-bookie P&L", status: "done" },
      {
        id: "trk-campaigns",
        title: "Bet campaigns & offer queues",
        description: "Group bets by offer; Open / Needs lay / Orphans views",
        status: "planned",
      },
      {
        id: "trk-settle-inbox",
        title: "Settlement inbox",
        status: "planned",
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
      { id: "int-tauri", title: "Tauri macOS .app packaging", status: "planned" },
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
