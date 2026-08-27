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
  /** Keycap rows. Used by the keyboard guide. */
  shortcutIds?: ReadonlyArray<string>;
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
    description: "What Edgeways is, first-run setup, demo data, and the 60-second loop.",
    sections: [
      {
        heading: "What is Edgeways?",
        paragraphs: [
          "Edgeways is a matched betting command centre. Calculators, profit tracking, live events and a real-time P&L dashboard, with your edge surfaced on every screen.",
          "Your activity lives in your Edgeways account. Export CSV anytime from Settings → Data & backup.",
        ],
      },
      {
        heading: "First run",
        bullets: [
          "Sign in, then finish setup: bank, bookies, bet defaults and alerts.",
          "We do not send bookie offers. You bring the promo; the desk runs the day.",
          "Settings → Subscription shows your plan, Preview Edge, and opens Stripe for billing.",
        ],
      },
      {
        heading: "Demo data vs live feeds",
        paragraphs: [
          "Calculators, tracker, offers, settlement and the football simulator work without live feeds. When the racing, football or exchange feeds are not connected, the desk uses demo fixtures and sample racecards.",
        ],
        bullets: [
          "Demo fixtures and sample racecards when a feed is not connected",
          "Football simulator plays a full 90 minutes in ~3 real minutes",
          "Proxy bookie odds on Racing Desk (labelled estimates, not live bookie prices)",
          "Manual settlement for all sports",
        ],
      },
      {
        heading: "Live feeds",
        bullets: [
          "Racing cards for today and tomorrow, with paste-in bookie odds",
          "Delayed exchange prices for pre-race lays",
          "Football scores when a match is tracked",
          "Live racing, football and exchange feeds are included with your plan.",
        ],
      },
      {
        heading: "The 60-second demo loop",
        paragraphs: ["Try the full live experience without waiting for live feeds:"],
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
          "LIVE (green) - derived from real exchange odds fetched moments ago (Racing Desk with the exchange feed connected).",
          "EST. (blue) - built from numbers you entered or from your own measured history (a boost check, a locked EV, measured retention).",
          "~EST. (amber) - a heuristic stands in for something unknown (default 96% slot RTP, builder legs assumed independent, casino volatility presets). The tooltip always says which assumption.",
          "Aggregates inherit the WEAKEST basis of their parts - one heuristic row makes the total heuristic.",
        ],
      },
      {
        heading: "The live layer: what refreshes when",
        paragraphs: [
          "Home updates every few seconds while you are on the desk (you can change that in Settings). Digests, acca auto-results and lay-due alerts run while the desk is open, and stay quiet when it is not.",
        ],
        bullets: [
          "Live football scores refresh about once a minute on a tracked match; goal timelines update when the score changes.",
          "Racing cards refresh throughout the day; delayed exchange prices run 1-3 minutes behind live.",
          "While the desk is open it also sends the Monday weekly digest, auto-results acca legs, and lay-due alerts.",
          "Alerts update in place rather than stacking copies; web push mirrors them to your phone.",
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
          "Alerts feed from: naked exposure (deliberately-unlaid mug bets exempt), 2UP locks, offer expiry, the morning daily tasks digest, acca lay-due, and the weekly digest.",
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
          "Capture: New offer → type it, paste the promo text, drop screenshots, or drop a promo EMAIL (.eml) - all parse on-device into the same preview.",
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
          "Fill slip: buttons on the lay banner, Lock in and acca legs copy the stake and can fill your exchange slip via the browser extension. Fill only - you always place the bet yourself; without the extension the stake is still on your clipboard.",
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
          "Proxy bookie odds - labelled estimates when live bookie prices are not on the card. Good for ranking runners, not for final stake decisions. Always check the bookie before you place.",
          "Exchange lay odds - real prices when the exchange feed is connected (delayed is fine). Otherwise +3% spread estimates.",
          "Live bookie odds - require the full racing feed. Until then, check the bookie site and enter odds in the Lay calculator.",
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
          "Proxy confidence - how reliable the estimate is for this runner. Low confidence = verify odds on the bookie.",
        ],
      },
      {
        heading: "Lay workflow",
        bullets: [
          "Lay button on a runner → opens Matched Betting calculator with pre-filled odds",
          "Place-refund Back → logs a qualifying bet linked to the offer",
          "Track race → adds to Tracked Events for settlement",
          "Set winner if the result has not landed automatically",
        ],
      },
      {
        heading: "What the racing feed covers",
        bullets: [
          "Racecards for today and tomorrow",
          "Results usually land automatically while the desk is open; if not, use Set winner",
          "The racecard shows exchange lays. Take the back price from your finder or the bookie, unless a live bookie price is already on the row.",
          "Proxy odds are estimates for ranking, not for staking",
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
          "Core and Pro calculators have an “Add to tracker” button. Numbers pre-fill the Add bet dialog - review, link an event, and save. When football fixtures are connected, 2UP Desk and 2UP can find-or-create the real fixture automatically.",
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
    description: "Install Edgeways on your phone and get push alerts.",
    sections: [
      {
        heading: "Open Edgeways on your phone",
        paragraphs: [
          "Open the same Edgeways address you use on the computer, in Chrome or Safari. Sign in with the same account.",
        ],
        bullets: [
          "Add to Home Screen when the browser offers it, for a full-screen desk",
          "iPhone: Share → Add to Home Screen. Android Chrome: the install banner, or the browser menu",
        ],
      },
      {
        heading: "Enable push",
        bullets: [
          "Settings → Alerts → flip “Push to this device” and allow notifications",
          "Tap Send test push. The notification should land even after you close the app (lightning badge + yellow bolt icon)",
          "Open the installed app once after an update so the service worker can refresh the notification art",
        ],
      },
      {
        heading: "If push stays off",
        bullets: [
          "Notifications have two switches: the phone’s app-level one and the browser’s site-level one",
          "If Edgeways says notifications need enabling, the site is blocked. Tap the tune or padlock by the address → Permissions → Notifications → Allow",
          "On Android you can also use Chrome ⋮ → Settings → Site settings → Notifications, and move the address out of Blocked",
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
          "Opens from any page. Type to filter pages, offers and bookie wallets.",
        ],
        shortcutIds: ["palette"],
        bullets: [
          "Quick actions: Add bet, New offer, Matched calculator, Adjust balance, Log casino offer, Check a boost",
          "Arrow keys move, Enter runs, Esc closes",
        ],
      },
      {
        heading: "Daily shortcuts",
        paragraphs: [
          "These only fire when you are not typing in a field, and not while a dialog is open. They never use browser chords such as Cmd+Shift+N. New offer shows the plan lock if Offers is locked.",
        ],
        shortcutIds: [
          "sheet",
          "add-bet",
          "new-offer",
          "matched-calculator",
          "settle-focused-bet",
          "jump-home",
          "jump-racing",
          "jump-offers",
        ],
        bullets: [
          "Tab to an open bet in the Tracker, then S opens Set result",
        ],
      },
      {
        heading: "Everyday keys",
        shortcutIds: ["enter", "esc-help", "save-dialog-help"],
        bullets: [
          "Save a dialog with ⌘Enter on Mac, or Ctrl+Enter on Windows and Linux. We do not use ⌘S, which browsers often steal",
          "Underline tabs (Settings, Tracker, Racing): Tab moves along the row, then into the page. Arrow keys also work. Segmented filters stay one Tab stop; use arrows there",
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
    description: "Every page and where it lives in the navigation.",
    /** Content is rendered by the SiteMapView component, not these sections. */
    sections: [],
  },
  {
    slug: "faq",
    title: "FAQ",
    description: "Common questions about tiers, odds, and how Edgeways works.",
    sections: [
      {
        heading: "Are live feeds included?",
        paragraphs: [
          "Yes. Live racing, football and exchange feeds come with your plan. Calculators, tracker, offers and settlement also work when a feed is briefly unavailable, using demo fixtures and sample racecards.",
        ],
      },
      {
        heading: "Why proxy odds?",
        paragraphs: [
          "Live bookie prices are not always on the racecard. Edgeways shows labelled proxy estimates so you can rank runners and filter qualifying races. Always verify final odds on the bookie before placing.",
        ],
      },
      {
        heading: "Are delayed exchange prices enough?",
        paragraphs: [
          "Yes for pre-race matched betting. Prices are 1–3 minutes behind live but fine for place-refund workflows. Live prices are only needed for in-play tight spreads.",
        ],
      },
      {
        heading: "How live football scores work",
        bullets: [
          "Fixture lists refresh through the day",
          "Live scores update about once a minute while a tracked match is in play",
          "Track the matches you are working, rather than every league at once",
        ],
      },
      {
        heading: "Where is my data stored?",
        paragraphs: [
          "In your Edgeways account. Export CSV anytime from Settings → Data & backup.",
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
          "Football: live score from the football feed or simulator drives derived markets",
          "Racing: results usually land automatically while the desk is open; otherwise use Set winner",
          "Goalscorer triggers: settle at the decisive goal, not full time",
        ],
      },
      {
        heading: "Support",
        paragraphs: [
          "Email support@edgeways.app or use the contact page. The Guides page covers day-to-day how-tos.",
        ],
      },
    ],
  },
];

export const HELP_GUIDE_BY_SLUG = Object.fromEntries(
  HELP_GUIDES.map((g) => [g.slug, g])
) as Record<HelpGuideSlug, HelpGuide>;

export const DEFAULT_HELP_GUIDE: HelpGuideSlug = "getting-started";

/** Nav order: FAQ sits next to Getting started so it is one tap on mobile. */
export const HELP_GUIDE_NAV: HelpGuide[] = [
  HELP_GUIDE_BY_SLUG["getting-started"],
  HELP_GUIDE_BY_SLUG.faq,
  ...HELP_GUIDES.filter((guide) => guide.slug !== "getting-started" && guide.slug !== "faq"),
];
