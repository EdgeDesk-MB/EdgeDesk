export type HelpGuideSlug =
  | "getting-started"
  | "racing-desk"
  | "offers"
  | "calculators"
  | "mobile"
  | "keyboard"
  | "site-map"
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
          "EdgeDesk is a local-first matched betting command centre. Calculators, profit tracking, live events and a real-time P&L dashboard - with your edge surfaced on every screen.",
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
          "The Racing API (free) - today + tomorrow racecards, proxy odds",
          "Betfair delayed app key (free at developer.betfair.com) - real lay prices",
          "API-Football free (optional) - ~one live football track per day",
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
          "EdgeDesk is result-centric, not bet-centric. Record what happened (a 2-1 score) and the app derives every market outcome - BTTS, Over 2.5, Home Win, 2UP triggered - and settles all linked bets automatically.",
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
          "Proxy bookie odds - estimated from ORF ratings on the free Racing API tier. Labelled “proxy” in the UI. Good for ranking runners, not for final stake decisions.",
          "Exchange lay odds - real from Betfair when connected (delayed key is fine). Otherwise +3% spread estimates.",
          "Live bookie odds - require Racing API Standard tier. Until then, check the bookie site and enter odds in the Lay calculator.",
        ],
      },
      {
        heading: "Reading Intelligence scores",
        paragraphs: [
          "Intelligence ranks races and runners for your active offers. The score combines field size fit, estimated qualifying loss, and expected value from the free bet.",
        ],
        bullets: [
          "Higher score = better fit, not a guarantee. A 70+ score is worth investigating; below 40 is usually a pass.",
          "Qualifying loss - the small cost if your horse doesn’t place. Compare to the free bet value.",
          "EV estimate - expected profit if you convert the free bet efficiently. Marked as estimate when using proxy odds.",
          "Proxy confidence - how reliable the ORF estimate is for this runner. Low confidence = verify odds manually.",
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
          "Auto race settlement needs Racing API Basic (Free = Set winner manually)",
          "Bookie odds are estimates - click a price on Racing Desk to paste the real odds",
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
        heading: "Paste from MBB",
        bullets: [
          "Offers → Paste offer (header or form card)",
          "Paste a Matched Betting Blog blurb or promo email",
          "Review the preview (bookie, stakes, places, expiry) then Apply to form and save",
          "Works best for place-refund “Bet £X get £Y if 2nd–4th” and simple sign-up free bets",
        ],
      },
      {
        heading: "Place-refund (bet & get free)",
        bullets: [
          "Create under Offers → Racing category (or paste)",
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
          "Worst-case profit shown before you commit - that's your qualifying cost",
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
        heading: "Core - everyday matched betting",
        bullets: [
          "Matched Betting - qualifiers, free bets (SNR/SR), risk-free. The workhorse.",
          "Dutching - equal-profit across outcomes. Use 2UP dutch mode for early-payout windfalls.",
          "Early Payout (2UP) - back a 2UP bookie, lay the exchange, see windfall scenarios.",
          "Each Way & Extra Place - standard EW arbs and extra-place offers.",
          "Sequential Lay - part lays at earlier odds, finish at current market.",
          "Refund-If - money-back-if-you-lose with free-bet or cash retention.",
          "Accumulator - doubles through Lucky 63 with layered lays.",
        ],
      },
      {
        heading: "Pro",
        bullets: [
          "2UP Desk - full 2UP/1UP modelling with Dixon-Coles probabilities, dutch vs lay ranking, mixed thresholds and live settlement. Use when you want model-driven EV, not just snapshot maths.",
        ],
      },
      {
        heading: "Tools - quick reference",
        bullets: [
          "Odds Converter - decimal ↔ fractional ↔ american ↔ implied probability",
          "EV & No-Vig - expected value, edge % and fair odds",
          "Rule 4 - adjusted winnings after a deduction",
        ],
      },
      {
        heading: "Add to tracker",
        paragraphs: [
          "Core and Pro calculators have an “Add to tracker” button. Numbers pre-fill the Add bet dialog - review, link an event, and save. With API keys, 2UP Desk and 2UP can find-or-create the real fixture automatically.",
        ],
      },
      {
        heading: "Advanced lay mode",
        bullets: [
          "Part lays - record lays already matched; app solves remaining stake",
          "Underlay - £0 net if bookie loses (all profit on bookie win)",
          "Overlay - £0 net if bookie wins",
        ],
      },
    ],
  },
  {
    slug: "mobile",
    title: "On your phone",
    description: "Reach EdgeDesk from your phone on the same network, install it, and get push alerts.",
    sections: [
      {
        heading: "Open EdgeDesk on your phone",
        paragraphs: [
          "With the dev server running on your computer, visit its LAN address from the phone - for example http://192.168.50.71:3000 (find your IP with ipconfig getifaddr en0 on Mac, or use the machine name such as http://sams-mac-studio.local:3000).",
        ],
        bullets: [
          "Phone and computer must be on the same Wi-Fi network",
          "The LAN address must be listed in allowedDevOrigins in next.config.ts - without it Next.js blocks its own assets cross-origin and the app loads dead (empty data, menu unresponsive). Your current IP and machine name are already configured; if your router hands out a new IP, add it and restart the server",
        ],
      },
      {
        heading: "Why push needs one extra step",
        paragraphs: [
          "Browsers only allow service workers, install-to-home-screen and push on secure origins. http://localhost counts as secure, but a plain http:// LAN address does not - so over the bare LAN URL the app works fully, but the push toggle reports the browser as unsupported.",
        ],
      },
      {
        heading: "Enable push on Android Chrome (one-time)",
        bullets: [
          "On the phone, open chrome://flags/#unsafely-treat-insecure-origin-as-secure",
          "Enter your EdgeDesk LAN address (e.g. http://192.168.50.71:3000) in the box, set the flag to Enabled, relaunch Chrome",
          "Open EdgeDesk, add it to your Home Screen when prompted, then Settings → Alerts → flip \"Push to this device\" and allow notifications",
          "Tap \"Send test push\" - the notification should land even after you close the app",
        ],
      },
      {
        heading: "Two gotchas after the flag",
        bullets: [
          "The Home Screen entry opens in Chrome with a URL bar, not full screen. That is expected: Android only mints true standalone apps for real https sites, so a flagged http address gets a shortcut instead. Push works exactly the same either way",
          "Notifications have TWO switches: the Android app-level one (on the shortcut) and Chrome's site-level one. If EdgeDesk keeps saying notifications need enabling, the site is blocked in Chrome - tap the tune/padlock icon by the address → Permissions → Notifications → Allow (or Chrome ⋮ → Settings → Site settings → Notifications, and move the address out of Blocked)",
          "For the real full-screen app and access away from home, serve EdgeDesk over genuine https (e.g. Tailscale serve) - then no flag is needed at all",
        ],
      },
      {
        heading: "Alternative: USB (adb)",
        bullets: [
          "With USB debugging on and the phone plugged in: adb reverse tcp:3000 tcp:3000",
          "The phone can then open http://localhost:3000, which browsers treat as secure - no flag needed",
        ],
      },
      {
        heading: "Once subscribed, push works anywhere",
        paragraphs: [
          "The LAN address only matters for browsing and for the one-time subscription. After that, alerts travel from your computer through the browser's push relay to the phone - so they arrive wherever the phone has signal, as long as the EdgeDesk server is running at home.",
        ],
      },
      {
        heading: "The proper setup: Tailscale (real https, no flag)",
        paragraphs: [
          "With Tailscale on both the computer and the phone, EdgeDesk gets a genuine https address - full-screen install, push and remote browsing with none of the flag workarounds.",
        ],
        bullets: [
          "In the Tailscale admin console, enable MagicDNS and HTTPS certificates (DNS page, one-time)",
          "On the computer: tailscale serve --bg 3000 - this proxies https://<machine>.<tailnet>.ts.net to EdgeDesk with a real certificate",
          "On the phone (Tailscale connected): open that https address - install properly from the banner, then enable push in Settings → Alerts from the new address",
          "Afterwards, remove the Chrome flag - it is no longer needed. Push subscriptions are per-address, so re-enable push once from the https address",
          "Tailscale only needs to be connected for browsing and subscribing; push notifications still arrive with Tailscale off, via the browser's relay",
          "*.ts.net is already in allowedDevOrigins, so no config change is needed",
        ],
      },
    ],
  },
  {
    slug: "keyboard",
    title: "Keyboard & accessibility",
    description: "Drive the desk from the keyboard, and how EdgeDesk behaves with assistive tech.",
    sections: [
      {
        heading: "The command palette",
        paragraphs: [
          "Cmd+K (Mac) or Ctrl+K (Windows/Linux) opens the command palette from any page.",
        ],
        bullets: [
          "Type to filter pages, open offers and bookie wallets",
          "Quick actions: Add bet, New offer, Matched calculator, Adjust balance",
          "Arrow keys move, Enter runs, Esc closes",
        ],
      },
      {
        heading: "Everyday keys",
        bullets: [
          "Enter commits any numeric setting (Tuning, Monthly target) - same as clicking away",
          "Esc closes every dialog and sheet",
          "Tab order follows the visual order on every page; all switches and icon buttons carry accessible names",
        ],
      },
      {
        heading: "Assistive tech and motion",
        bullets: [
          "Every alert toggle, health switch and icon-only button has a screen-reader name",
          "Unread alerts announce their state, not just a coloured dot",
          "With “reduce motion” set in your OS, pulsing live indicators and slide-in animations are stilled",
        ],
      },
    ],
  },
  {
    slug: "site-map",
    title: "Site map",
    description: "Every page and where it lives - rendered live from the navigation structure.",
    /** Content is rendered by the SiteMapView component, not these sections. */
    sections: [],
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
        heading: "Betfair delayed key - is it enough?",
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
          "Racing: Racing API Basic auto-settles while the app is open; Free tier uses Set winner",
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
