export type HelpGuideSlug =
  | "getting-started"
  | "how-it-works"
  | "desk-how-tos"
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
        heading: "What is Edgeways?",
        paragraphs: [
          "Edgeways is a local-first matched betting command centre. Calculators, profit tracking, live events and a real-time P&L dashboard - with your edge surfaced on every screen.",
          "Your data lives in SQLite at data/edgeways.db. Nothing leaves your machine unless you add API keys for live feeds.",
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
          "Without any keys, Edgeways runs fully in demo mode: all calculators, tracker, offers, settlement logic and the football simulator work offline.",
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
          "Edgeways is result-centric, not bet-centric. Record what happened (a 2-1 score) and the app derives every market outcome - BTTS, Over 2.5, Home Win, 2UP triggered - and settles all linked bets automatically.",
        ],
      },
    ],
  },
  {
    slug: "how-it-works",
    title: "How Edgeways thinks",
    description:
      "The logic behind the numbers - the result-centric model, EV honesty, the live layer, and how the desks learn from your own history.",
    sections: [
      {
        heading: "The three questions",
        paragraphs: [
          "Everything in Edgeways exists to answer one of three daily questions: what should I do next (Do next, the Daily Plan, the offer calendar), am I executing correctly (trackers, checkers, alerts), and did it actually pay (P&L, EV capture, the Edge Report). If a number does not serve one of those, it is not on the desk.",
        ],
      },
      {
        heading: "The result-centric model (why settlement is automatic)",
        paragraphs: [
          "You record what happened in the real world - a score, a race winner - and Edgeways derives every market from it. One England 2-1 result settles match odds, BTTS, over/under and a 2UP trigger together, because they are all views of the same fact.",
        ],
        bullets: [
          "Bets linked to a tracked event settle themselves when the result lands (Set result on the race from Tracked Events or Profit Tracker). Unlinked bets use Set result for Won/Lost/Void.",
          "Corrections re-derive: fix a score and every dependent market re-settles the same way.",
          "The same engine powers the Acca Desk (linked legs auto-result) and goalscorer/combo triggers (settle at the decisive moment, not full time).",
        ],
      },
      {
        heading: "EV honesty: the basis badge",
        paragraphs: [
          "Every £-EV figure carries a basis badge because not all estimates deserve equal trust. This is the single most important convention on the platform.",
        ],
        bullets: [
          "LIVE (green) - derived from real exchange odds fetched moments ago (Racing Desk with a Betfair key).",
          "EST. (blue) - built from numbers you entered or from your own measured history (a boost check, a locked EV, measured retention).",
          "~EST. (amber) - a heuristic stands in for something unknown (default 96% slot RTP, builder legs assumed independent, casino volatility presets). The tooltip always says which assumption.",
          "Aggregates inherit the WEAKEST basis of their parts - one heuristic row makes the total heuristic.",
        ],
      },
      {
        heading: "The live layer: what refreshes when",
        paragraphs: [
          "The Home dashboard polls the app state every few seconds (tunable in Settings). That poll is also the platform's heartbeat: several background jobs run compute-on-poll, meaning they fire while the desk is open and stay silent when it is not. Nothing runs on a server somewhere - your machine is the desk.",
        ],
        bullets: [
          "Live football scores refresh at most once per 60s per tracked match; goal timelines only re-fetch when the score changes (the API allows ~95 requests/day, and the budget guard alerts once daily if it runs dry).",
          "Racing cards cache ~15 minutes; Betfair delayed prices run 1-3 minutes behind live.",
          "Compute-on-poll jobs: the Monday weekly digest (week-key latch so it sends once), email intake (checks your IMAP folder every ~5 minutes when enabled), acca auto-results and lay-due alerts.",
          "Alerts write to the inbox with a dedupe key, so a re-firing condition updates the existing alert instead of stacking copies; web push mirrors them to your phone.",
        ],
      },
      {
        heading: "The learning loop: your history sharpens the numbers",
        paragraphs: [
          "Several estimates start as defaults and are replaced by YOUR measured reality as evidence accumulates. Small samples blend toward the default (so one lucky conversion does not swing everything); large samples take over.",
        ],
        bullets: [
          "Free-bet retention: starts at 80%, becomes your measured rate from settled conversions - this feeds every 'remaining edge' figure in Do next.",
          "EV capture: when a campaign goes active its expected profit is LOCKED (snapshot). Settlement compares reality against the lock - capture %, commission drag, and the mistake ledger all come from that diff. Edits after activation create a visible re-lock, never a silent change.",
          "Effort (£/hr): the desk times offer open → bet logged. After enough samples the rate sort uses your real minutes, not estimates.",
          "The Edge Report and weekly digest aggregate all of it monthly/weekly: expected vs realized is the flagship chart.",
        ],
      },
      {
        heading: "Money truth: what counts where",
        paragraphs: [
          "Different pots deliberately do not mix. Knowing these rules explains almost every 'why is this number different there?' moment.",
        ],
        bullets: [
          "Net P&L (top bar, monthly breakdown, season view) counts EVERY settled pound - it is real money.",
          "Edge metrics (EV capture, retention, £/hr, commission drag, mistake ledger) EXCLUDE mug bets - camouflage is a deliberate cost, not lost edge. The league shows it as its own 'Mug (month)' line instead.",
          "Casino realised P&L counts in total Profit as its own Casino bucket (separate from Betting P&L), appears in History/Home feed, and updates the bookie wallet. Casino EV stays on the Casino desk - an expectation across many attempts, never a lock.",
          "Household owners: an account belongs to one operator; bets inherit the owner through the bookmaker name. Identical wallet names across owners attribute to you until renamed - the split must always reconcile to the total.",
          "Commission is tracked per bet and shown as drag; your gross and retained figures are equal only while you lay at 0%.",
        ],
      },
      {
        heading: "Dependencies at a glance",
        bullets: [
          "Do next ranks offers using: measured retention + EV basis + bookie health (gubbed sinks, never hides) + funding checks + measured £/hr.",
          "The Daily Plan is Do next re-cut for today, plus timed slots: tracked races, kickoffs, and acca lay-due legs.",
          "The 2UP Desk consumes tracked-event live scores; the Acca Desk consumes event results; the Racing Desk consumes racecards plus your racing offers.",
          "Alerts feed from: naked exposure (deliberately-unlaid mug bets exempt), 2UP locks, offer expiry, the morning daily tasks digest, acca lay-due, email-intake drafts, API budget, and the weekly digest.",
        ],
      },
    ],
  },
  {
    slug: "desk-how-tos",
    title: "How to run each feature",
    description:
      "Step-by-step working instructions for every desk and tool, in the order a real offer flows through them.",
    sections: [
      {
        heading: "Offers: the campaign lifecycle",
        bullets: [
          "Capture: New offer → type it, paste the promo text, drop screenshots, or drop a promo EMAIL (.eml) - all parse on-device into the same preview. Or forward emails to your intake folder (Settings → Data & API) and drafts arrive as Planned campaigns.",
          "Repeats: tick Repeats when creating for daily/weekly/monthly promos - each occurrence is a separate offer with its own ID. Delete asks whether to remove this occurrence only or this and future. Stop from any instance when the series ends. Casino campaigns use the same control.",
          "Planned → Active: activating LOCKS the expected EV (the baseline your execution is judged against).",
          "Work it: Do next tells you the next action; opening a card starts the effort timer; logging the bet stops it.",
          "Settle: results land, capture % is computed, and anything below 100% can be tagged in the mistake ledger (laid late, odds moved, wrong market…).",
        ],
      },
      {
        heading: "Tracker: logging and protecting positions",
        bullets: [
          "Add bet: back+lay in one form; Advanced unlocks part lays and the underlay/overlay slider; 'No lay (back only)' hides the lay panel for deliberate back-only bets.",
          "Mug bet toggle: marks camouflage - real P&L, excluded from edge, never linked to offers, stamps the bookie's cadence plan.",
          "Lock in (on any open single): enter today's exchange prices → the equalising trade in whichever direction closes the gap, with a partial slider. One click logs the closing trade as a real bet.",
          "Naked exposure: an open cash back with no lay alerts after a grace window (3 minutes when kick-off is close).",
        ],
      },
      {
        heading: "Boosts: price boosts and bet builders",
        bullets: [
          "Price boost: Back Bet panel (boosted price) + Lay Bet panel (exchange back/lay set the fair midpoint) → verdict at ±1% edge: Take / Marginal / Skip.",
          "Advanced underlay: £0 back if it loses, the full edge if it wins - the common risk-free boost play.",
          "Builders: fair odds per leg with a correlation haircut (same-match legs are NOT independent); verdict-only, since a builder cannot be laid as one bet.",
          "Log for later (EV check only) or Place bet (opens Add bet as type Boost). Placed boosts hit In-bets, Profit Tracker Open, and History → Boosts. Settle from Boosts or Tracker - one record.",
        ],
      },
      {
        heading: "Casino: wagering campaigns with honest variance",
        bullets: [
          "Log offer (nav quick action or Casino → Log): name the campaign, then add its first step. Paste the promo text to prefill. Add more steps on the card if the offer bundles several rewards.",
          "Steps: qualifying wager (cost drag), cash, bonus, free spins, golden chips, cashback - each has its own EV; the card header shows the campaign total.",
          "Repeats: on create, tick Repeats and pick daily / weekly / monthly. The first occurrence appears immediately; later days materialise automatically with the same steps and freshly derived EV. Each occurrence has its own ID so you can complete or delete one without touching the rest.",
          "Delete a repeating card: choose this occurrence only (that date will not come back) or this and future occurrences (stops the series; past history stays).",
          "Stop repeating: on any recurring card, tick \"Stop repeating from this occurrence forward\" - future empty instances are removed; history stays.",
          "Calendar / Campaigns: same split as Offers - calendar by expiry day, campaigns for the working list.",
          "The eligible-games picker stars the highest published RTP; the Game library holds base RTPs (operators can license lower variants - verify in game info).",
          "Simulate: 10,000 runs of the whole campaign at a volatility preset → bust %, median, the 10-90% band, and the distribution. Heavy-wagering offers often simulate ABOVE the static EV because busting truncates losses - both figures are shown.",
        ],
      },
      {
        heading: "Racing Desk and the 2UP Desk",
        bullets: [
          "Racing: add a place-refund offer first - Intelligence then scores today's races by offer fit, field size and EV. Lay opens the calculator with real odds; Basic-tier results auto-settle.",
          "2UP: track the match, the desk watches for 2-goals-ahead, alerts the early-payout trigger, and computes the equalising lock trades live.",
        ],
      },
      {
        heading: "Acca Desk: multi-day accas, leg by leg",
        bullets: [
          "Create a run with legs in play order. The acca back is logged as a real tracker bet immediately.",
          "Sequential lock: cover each non-final leg for ~£0 if it loses; the final leg equalises so the run ends the same either way.",
          "Insurance · leg-by-leg: same cover lays, for refund-if-one-loses offers. Stays open after a loss until every leg resolves; claim the free bet when exactly one lost.",
          "Insurance · whole acca: one equalising lay at the combined exchange price, then settle legs. Same refund rule.",
          "The next unlaid leg is ready to lay immediately (leg 1 right after create). Enter live exchange lay odds and stake. Do not reuse the bookie back price.",
          "Alerts / Daily Plan still fire from 30 minutes before the leg starts; you can lay earlier whenever you like.",
          "Tracked-event legs auto-result from the football score or race result; everything else uses Won / Lost / Void on the desk.",
        ],
      },
      {
        heading: "Checkers and the betslip extension",
        bullets: [
          "Match Checker: paste a bookie price and the exchange back/lay - fair-price verdict in seconds, no feeds.",
          "Fill slip: buttons on the lay banner, Lock in and acca legs copy the stake AND fill your Betdaq slip via the browser extension (extension/README.md to install). Fill only - you always place the bet yourself; without the extension the stake is still on your clipboard.",
        ],
      },
      {
        heading: "Staying informed",
        bullets: [
          "Alerts inbox (+ badge) holds everything; push mirrors to your phone once enabled from a secure origin (see On your phone).",
          "The weekly digest (Settings → opt-in) lands Monday morning: the week's edge, leaks, drought nudges.",
          "The command palette (⌘K) reaches every page and quick action; the mobile Quick actions sheet mirrors it.",
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
        heading: "Recurring offers",
        paragraphs: [
          "Daily, weekly or monthly reloads get a Repeats checkbox on create. Edgeways materialises each occurrence as its own offer (own ID, own bets, own completion) so history never collides.",
        ],
        bullets: [
          "Create with Repeats on → the first matching date appears immediately (today if the rule matches); the next ~14 days fill in automatically",
          "Edit one occurrence without changing the series template; future materialisations still use the original rule",
          "Delete asks this occurrence only (skipped so it does not come back) or this and future (stops the series; past history stays)",
          "Stop repeating from this occurrence forward removes untouched future Planned instances and leaves history intact",
          "Casino campaigns use the same pattern: Repeats on Log a casino offer, then stop or delete from any recurring card",
        ],
      },
      {
        heading: "Daily tasks digest",
        paragraphs: [
          "Toggle in Settings → Automation. Once each morning (from 09:00, while the desk is open) Edgeways sends a single inbox + push briefing of Do Next tasks with expiry in the next few days, soonest first. Repeating series only include the current occurrence. Urgent same-day and race-impact prompts still come from Alerts.",
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
    description: "Reach Edgeways from your phone on the same network, install it, and get push alerts.",
    sections: [
      {
        heading: "Open Edgeways on your phone",
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
          "Enter your Edgeways LAN address (e.g. http://192.168.50.71:3000) in the box, set the flag to Enabled, relaunch Chrome",
          "Open Edgeways, add it to your Home Screen when prompted, then Settings → Alerts → flip \"Push to this device\" and allow notifications",
          "Tap \"Send test push\" - the notification should land even after you close the app (lightning badge + yellow bolt icon; open the PWA once after updates so the service worker caches the art)",
        ],
      },
      {
        heading: "Two gotchas after the flag",
        bullets: [
          "The Home Screen entry opens in Chrome with a URL bar, not full screen. That is expected: Android only mints true standalone apps for real https sites, so a flagged http address gets a shortcut instead. Push works exactly the same either way",
          "Notifications have TWO switches: the Android app-level one (on the shortcut) and Chrome's site-level one. If Edgeways keeps saying notifications need enabling, the site is blocked in Chrome - tap the tune/padlock icon by the address → Permissions → Notifications → Allow (or Chrome ⋮ → Settings → Site settings → Notifications, and move the address out of Blocked)",
          "For the real full-screen app and access away from home, serve Edgeways over genuine https (e.g. Tailscale serve) - then no flag is needed at all",
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
          "The LAN address only matters for browsing and for the one-time subscription. After that, alerts travel from your computer through the browser's push relay to the phone - so they arrive wherever the phone has signal, as long as the Edgeways server is running at home.",
        ],
      },
      {
        heading: "The proper setup: Tailscale (real https, no flag)",
        paragraphs: [
          "With Tailscale on both the computer and the phone, Edgeways gets a genuine https address - full-screen install, push and remote browsing with none of the flag workarounds.",
        ],
        bullets: [
          "In the Tailscale admin console, enable MagicDNS and HTTPS certificates (DNS page, one-time)",
          "On the computer: tailscale serve --bg 3000 - this proxies https://<machine>.<tailnet>.ts.net to Edgeways with a real certificate",
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
    description: "Drive the desk from the keyboard, and how Edgeways behaves with assistive tech.",
    sections: [
      {
        heading: "The command palette",
        paragraphs: [
          "Cmd+K (Mac) or Ctrl+K (Windows/Linux) opens the command palette from any page.",
        ],
        bullets: [
          "Type to filter pages, open offers and bookie wallets",
          "Quick actions: Add bet, New offer, Matched calculator, Adjust balance, Log casino offer, Check a boost",
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
    description: "Common questions about tiers, odds, and how Edgeways works.",
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
          "The free Racing API tier doesn't include live bookie prices. Edgeways estimates from ORF ratings so you can rank runners and filter qualifying races. Always verify final odds on the bookie before placing.",
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
          "SQLite at data/edgeways.db in the project folder. Export CSV anytime from Settings → Data & API.",
        ],
      },
      {
        heading: "Can casino (or sports) offers repeat automatically?",
        paragraphs: [
          "Yes. Tick Repeats when creating a sports offer or logging a casino campaign, then choose daily, weekly or monthly. Each day/week gets its own campaign so you can complete one without affecting the others. Delete asks this occurrence only or this and future. On a recurring card, tick Stop repeating from this occurrence forward when the promo ends.",
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
          "Edgeways is a local MVP build. For issues, check Settings → Data & API for connection status and the Roadmap page for known gaps. Community support channel coming in v1.0.",
        ],
      },
    ],
  },
];

export const HELP_GUIDE_BY_SLUG = Object.fromEntries(
  HELP_GUIDES.map((g) => [g.slug, g])
) as Record<HelpGuideSlug, HelpGuide>;

export const DEFAULT_HELP_GUIDE: HelpGuideSlug = "getting-started";
