export type HelpGuideSlug =
  | "getting-started"
  | "racing-desk"
  | "offers"
  | "calculators"
  | "faq";

export interface HelpSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface HelpGuide {
  slug: HelpGuideSlug;
  title: string;
  description: string;
  sections: HelpSection[];
}

export const HELP_GUIDES: HelpGuide[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Install, run locally, demo mode vs API keys, and the 60-second demo loop.",
    sections: [
      {
        heading: "What is EdgeDesk?",
        paragraphs: [
          "EdgeDesk is a local-first matched betting command centre. Calculators, profit tracking, live events and a real-time P&L dashboard — with your edge surfaced on every screen.",
          "Your data lives in SQLite at data/edgedesk.db. Nothing leaves your machine unless you add API keys for live feeds.",
        ],
      },
      {
        heading: "Run it",
        bullets: [
          "npm install && npm run dev",
          "Open http://localhost:3000",
          "Optional: cp .env.example .env.local and add API keys",
        ],
      },
      {
        heading: "Demo mode vs API keys",
        paragraphs: [
          "Without any keys, EdgeDesk runs fully in demo mode: all calculators, tracker, offers, settlement logic and the football simulator work offline.",
        ],
        bullets: [
          "Demo fixtures and sample racecards when no keys are set",
          "Football simulator plays a full 90 minutes in ~3 real minutes",
          "Proxy bookie odds on Racing Desk (ORF-based estimates)",
          "Manual settlement for all sports",
        ],
      },
      {
        heading: "Recommended free stack (£0/month)",
        bullets: [
          "The Racing API (free) — today + tomorrow racecards, proxy odds",
          "Betfair delayed app key (free at developer.betfair.com) — real lay prices",
          "API-Football free (optional) — ~one live football track per day",
        ],
      },
      {
        heading: "The 60-second demo loop",
        paragraphs: ["Try the full live experience without any API keys:"],
        bullets: [
          "Tracked Events → Simulate match → “2UP drama” → Kick off",
          "Calculators → Dutching → 2UP early payout dutch → Add to profit tracker",
          "Tracker → link the bet to the simulated event",
          "Live Dashboard → watch the Liveline chart move as goals go in",
        ],
      },
      {
        heading: "Result-centric settlement",
        paragraphs: [
          "EdgeDesk is result-centric, not bet-centric. Record what happened (a 2-1 score) and the app derives every market outcome — BTTS, Over 2.5, Home Win, 2UP triggered — and settles all linked bets automatically.",
        ],
      },
    ],
  },
  {
    slug: "racing-desk",
    title: "Racing Desk guide",
    description: "How to read Intelligence, proxy vs live odds, and the lay workflow.",
    sections: [
      {
        heading: "What the Racing Desk does",
        paragraphs: [
          "Browse UK & IRE racecards, filter by your active offers, and get Intelligence suggestions for place-refund and extra-place workflows.",
        ],
      },
      {
        heading: "Proxy vs live odds",
        bullets: [
          "Proxy bookie odds — estimated from ORF ratings on the free Racing API tier. Labelled “proxy” in the UI. Good for ranking runners, not for final stake decisions.",
          "Exchange lay odds — real from Betfair when connected (delayed key is fine). Otherwise +3% spread estimates.",
          "Live bookie odds — require Racing API Standard tier. Until then, check the bookie site and enter odds in the Lay calculator.",
        ],
      },
      {
        heading: "Reading Intelligence scores",
        paragraphs: [
          "Intelligence ranks races and runners for your active offers. The score combines field size fit, estimated qualifying loss, and expected value from the free bet.",
        ],
        bullets: [
          "Higher score = better fit, not a guarantee. A 70+ score is worth investigating; below 40 is usually a pass.",
          "Qualifying loss — the small cost if your horse doesn’t place. Compare to the free bet value.",
          "EV estimate — expected profit if you convert the free bet efficiently. Marked as estimate when using proxy odds.",
          "Proxy confidence — how reliable the ORF estimate is for this runner. Low confidence = verify odds manually.",
        ],
      },
      {
        heading: "Lay workflow",
        bullets: [
          "Lay button on a runner → opens Matched Betting calculator with pre-filled odds",
          "Place-refund Back → logs a qualifying bet linked to the offer",
          "Track race → adds to Tracked Events for settlement",
          "Set winner when the race finishes (manual on free tier)",
        ],
      },
      {
        heading: "Free tier limitations",
        bullets: [
          "Racecards: today and tomorrow only",
          "No auto race settlement — use Set winner or upgrade Racing API Basic",
          "No silks images on free racecards",
          "Steamer/drifter indicators use local snapshot polling, not premium odds history",
        ],
      },
    ],
  },
  {
    slug: "offers",
    title: "Offers guide",
    description: "Place-refund, extra place, and linking bets to offers.",
    sections: [
      {
        heading: "Why track offers?",
        paragraphs: [
          "Offers drive Intelligence on the Racing Desk and let you see P&L per promo. Bets auto-link when the label or trigger matches an active offer.",
        ],
      },
      {
        heading: "Place-refund (bet & get free)",
        bullets: [
          "Create under Offers → Racing category",
          "Set min runners (usually 8+), regions (GB/IRE), stake and free bet amount",
          "Qualifying places are 2nd–4th by default",
          "Racing Desk highlights qualifying races and suggests runners via Intelligence",
        ],
      },
      {
        heading: "Extra place",
        bullets: [
          "Use the Each Way & Extra Place calculator for the lay maths",
          "Set bookie places vs exchange places on the Racing Desk EP panel",
          "Worst-case profit shown before you commit — that's your qualifying cost",
        ],
      },
      {
        heading: "General offers",
        paragraphs: [
          "For sign-ups, reloads and football promos, add a general offer with expected profit. Link bets manually or via trigger text in the Tracker.",
        ],
      },
      {
        heading: "Expiry reminders",
        paragraphs: [
          "Toggle in Settings → Preferences. Toasts fire at 7, 3 and 1 days before expiry for active and planned offers.",
        ],
      },
    ],
  },
  {
    slug: "calculators",
    title: "Calculators overview",
    description: "When to use which calculator in the matched betting workflow.",
    sections: [
      {
        heading: "Core — everyday matched betting",
        bullets: [
          "Matched Betting — qualifiers, free bets (SNR/SR), risk-free. The workhorse.",
          "Dutching — equal-profit across outcomes. Use 2UP dutch mode for early-payout windfalls.",
          "Early Payout (2UP) — back a 2UP bookie, lay the exchange, see windfall scenarios.",
          "Each Way & Extra Place — standard EW arbs and extra-place offers.",
          "Sequential Lay — part lays at earlier odds, finish at current market.",
          "Refund-If — money-back-if-you-lose with free-bet or cash retention.",
          "Accumulator — doubles through Lucky 63 with layered lays.",
        ],
      },
      {
        heading: "Pro",
        bullets: [
          "EP Edge Desk — full 2UP/1UP modelling with Dixon-Coles probabilities, offer scoring and live settlement. Use when you want model-driven EV, not just snapshot maths.",
        ],
      },
      {
        heading: "Tools — quick reference",
        bullets: [
          "Odds Converter — decimal ↔ fractional ↔ american ↔ implied probability",
          "EV & No-Vig — expected value, edge % and fair odds",
          "Rule 4 — adjusted winnings after a deduction",
        ],
      },
      {
        heading: "Add to tracker",
        paragraphs: [
          "Core and Pro calculators have an “Add to tracker” button. Numbers pre-fill the Add bet dialog — review, link an event, and save. With API keys, EP Desk and 2UP can find-or-create the real fixture automatically.",
        ],
      },
      {
        heading: "Advanced lay mode",
        bullets: [
          "Part lays — record lays already matched; app solves remaining stake",
          "Underlay — £0 net if bookie loses (all profit on bookie win)",
          "Overlay — £0 net if bookie wins",
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    description: "Common questions about tiers, odds, and how EdgeDesk works.",
    sections: [
      {
        heading: "Do I need API keys?",
        paragraphs: [
          "No. Calculators, tracker, offers, settlement and demo data all work without keys. Keys unlock live fixtures, real lay odds and auto settlement.",
        ],
      },
      {
        heading: "Why proxy odds?",
        paragraphs: [
          "The free Racing API tier doesn't include live bookie prices. EdgeDesk estimates from ORF ratings so you can rank runners and filter qualifying races. Always verify final odds on the bookie before placing.",
        ],
      },
      {
        heading: "Betfair delayed key — is it enough?",
        paragraphs: [
          "Yes for pre-race matched betting. Prices are 1–3 minutes behind live but fine for place-refund workflows. A live app key (~£499) is only needed for in-play tight spreads.",
        ],
      },
      {
        heading: "API-Football free tier limits",
        bullets: [
          "100 requests/day with built-in budget guard at 95",
          "Fixture lists cache 10 minutes",
          "Live scores poll at most once per 60s while a tracked event is in play",
          "Practically: one live-tracked match per day fits comfortably",
        ],
      },
      {
        heading: "Where is my data stored?",
        paragraphs: [
          "SQLite at data/edgedesk.db in the project folder. Export CSV anytime from Settings → Data & API.",
        ],
      },
      {
        heading: "What triggers auto-settlement?",
        bullets: [
          "Football: live score from API-Football or simulator drives derived markets",
          "Racing: manual Set winner on free tier; Racing API Basic for auto results",
          "Goalscorer triggers: settle at the decisive goal, not full time",
        ],
      },
      {
        heading: "Support",
        paragraphs: [
          "EdgeDesk is a local MVP build. For issues, check Settings → Data & API for connection status and the Roadmap page for known gaps. Community support channel coming in v1.0.",
        ],
      },
    ],
  },
];

export const HELP_GUIDE_BY_SLUG = Object.fromEntries(
  HELP_GUIDES.map((g) => [g.slug, g])
) as Record<HelpGuideSlug, HelpGuide>;

export const DEFAULT_HELP_GUIDE: HelpGuideSlug = "getting-started";
