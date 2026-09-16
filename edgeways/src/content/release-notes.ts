/**
 * Curated release notes - customer-facing highlights, newest first.
 * Voice: `.cursor/rules/customer-copy.mdc`. Benefit first, one idea per
 * bullet, vary the opener. Skip internals and anything a customer does
 * not need to see. Add a group per release day (or milestone) as work ships.
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
    date: "2026-09-15",
    title: "Early-payout Desk, and a simpler Add bet",
    summary:
      "We've given early-payout its own desk, shortened a few names in the nav, and made Add bet easier to fund and easier to read.",
    entries: [
      {
        kind: "feature",
        area: "Early-payout Desk",
        href: "/early-payout",
        text: "It's now easier to run early-payout from one place. The board, Active bets and scouting sit together. Football 2UP is modelled here. Other sports follow each bookie's lead rule.",
      },
      {
        kind: "improvement",
        area: "Early-payout Desk",
        href: "/early-payout",
        text: "We've shortened the Live desks names. 2UP Desk is now Early-payout, Racing Desk is Racing, and Combo Desk is Combo. Old 2UP Desk links still land here.",
      },
      {
        kind: "improvement",
        area: "Accounts",
        href: "/accounts",
        text: "We've simplified bookie rules. Scope on each account is the sports you place and the lead that pays. Saving an Add bet can confirm a new rule without a second screen.",
      },
      {
        kind: "improvement",
        area: "Add bet",
        href: "/tracker",
        text: "It's now easier to see if you can fund the bet. Balance sits under Back and Lay. If the stake is short, we say so and offer to add the difference on the bookie, or remind you to top up the exchange.",
      },
      {
        kind: "improvement",
        area: "Add bet",
        href: "/tracker",
        text: "We've tidied Early payout and Advanced onto strips under Back and Lay, so the extra fields only appear when you need them. The profit table now shows the early-payout outcome when both sides are on.",
      },
      {
        kind: "improvement",
        area: "Add bet",
        href: "/tracker",
        text: "We've tidied the Back and Lay plates so Add bet and the calculators read the same. Dark mode is easier to tell apart, and Save bet uses your Settings colour in light as well.",
      },
      {
        kind: "improvement",
        area: "Calculators",
        href: "/calculators/two-up",
        text: "We've dropped the 2UP Desk tile. The Early Payout calculator is still here for a one-off price.",
      },
    ],
  },
  {
    date: "2026-09-10",
    title: "Fixtures remembers you, and a more honest Home Prov",
    summary:
      "You can now filter Fixtures to matches you've already backed, and the page keeps your last sport and filters. Home Prov no longer double-counts a lock-in.",
    entries: [
      {
        kind: "feature",
        area: "Fixtures",
        href: "/fixtures",
        text: "You can now show only matches you've already backed. The page also keeps the sport and filters you last used.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/",
        text: "We've made Prov treat a lock-in and the original as one position, so it no longer double-counts.",
      },
      {
        kind: "improvement",
        area: "History",
        href: "/history",
        text: "Kick-off, goals and full time now show the time they happened.",
      },
      {
        kind: "improvement",
        area: "History",
        href: "/history",
        text: "New 2UP bets can show two lines: the early bookie payout, then the lay. Older 2UP bets stay as one line.",
      },
      {
        kind: "improvement",
        area: "Tracked Events",
        href: "/tracked-events",
        text: "Substitutions are clearer on the match tape. You can still tap a finished football match for a short while after full time.",
      },
      {
        kind: "fix",
        area: "Add bet",
        href: "/tracker",
        text: "Changing the football pick no longer changes the match name. A £0 lay you typed no longer sticks after you change the odds.",
      },
    ],
  },
  {
    date: "2026-09-07",
    title: "Pin any league, race result tapes, and dates that work on the phone",
    summary:
      "Finding a league is quicker, a finished race now opens its result, and dates on the phone use the phone's own picker.",
    entries: [
      {
        kind: "feature",
        area: "Fixtures",
        href: "/fixtures",
        text: "Finding a competition is quicker, even when it has no match today. You can pin it for a shortcut rail and drag pins to reorder.",
      },
      {
        kind: "improvement",
        area: "Fixtures",
        href: "/fixtures",
        text: "It's now easier to move through the week: Today, Tomorrow, or pick a day. All / Live / Scheduled sit with the day switcher. Common UK and European leagues come first.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        href: "/racing",
        text: "You can now tap a finished race for the result: finishing order, starting prices and distances.",
      },
      {
        kind: "improvement",
        area: "Mobile",
        text: "Date and time fields on the phone now use the phone's own picker, so they no longer fight the keyboard or lock the page.",
      },
      {
        kind: "improvement",
        area: "Tracked Events",
        href: "/tracked-events",
        text: "Add fixture opens the same browse list as + in the side nav.",
      },
      {
        kind: "fix",
        area: "Navigation",
        text: "Paid desks now open from your last visit, instead of sitting on Checking your plan. If the page cannot load, you get Try again.",
      },
      {
        kind: "fix",
        area: "Racing Desk",
        href: "/racing",
        text: "Once a race has gone off, Tracked Events and the nav show Live, even if the card has not been marked finished yet.",
      },
      {
        kind: "fix",
        area: "Fixtures",
        href: "/fixtures",
        text: "Same-named leagues stay separate, so England and Scotland Premier League do not collapse into one list.",
      },
      {
        kind: "improvement",
        area: "Live",
        href: "/",
        text: "Football clocks now say HT, extra time and penalties, instead of sticking on 45'.",
      },
      {
        kind: "improvement",
        area: "Early-payout Desk",
        href: "/early-payout",
        text: "1UP is optional. The desk starts on 2UP only; turn on Include 1UP to add those prices and mixed dutch.",
      },
      {
        kind: "improvement",
        area: "Fixtures",
        href: "/fixtures",
        text: "You can add a bet from a live match or race without tracking it first. Add bet hides once the fixture has finished.",
      },
    ],
  },
  {
    date: "2026-09-06",
    title: "A cleaner Home, Dutching you can steer, and both clubs in the feed",
    summary:
      "We've simplified Home to Summary, chart, feed and Do next. You can now steer a Dutch split, and football rows show both crests.",
    entries: [
      {
        kind: "improvement",
        area: "Home",
        href: "/",
        text: "We've simplified Home. Today's plan is off the page, the phone deck and Settings. The phone deck is Summary, Feed and Do next. Quick actions stay Paste slip and Add bet.",
      },
      {
        kind: "feature",
        area: "Dutching",
        href: "/calculators/dutching",
        text: "You can now round the suggested stakes, change one stake yourself, or weight the split toward the first or last outcome. The same controls are in Add bet for a Dutch bet.",
      },
      {
        kind: "feature",
        area: "History",
        href: "/history",
        text: "Football rows now show both club crests. On Edge, tap a match for the tape: goals, cards, VAR, substitutions and formations. Expanded or Compact is remembered.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/",
        text: "The live feed now uses the same crests and day stamps. A new day starts a new Today, instead of leaving yesterday's header stuck.",
      },
      {
        kind: "feature",
        area: "Fixtures",
        href: "/fixtures",
        text: "You can star a competition or course to pin it, and hide ones you do not want. Saved shows only what you pinned, on Fixtures and Racing Desk.",
      },
      {
        kind: "improvement",
        area: "Profit Tracker",
        href: "/tracker",
        text: "The bet log now groups by day, same Today / Yesterday split as Tracked Events. Future work sits above Today.",
      },
      {
        kind: "improvement",
        area: "Alerts",
        href: "/alerts",
        text: "Football settlement and 2UP alerts can show both clubs on the large icon. The bolt stays the badge.",
      },
    ],
  },
  {
    date: "2026-09-05",
    title: "Goals in History, richer live football, and fixtures that open at once",
    summary:
      "It's now clearer how a match unfolded. Today's fixtures open straight away, and finding an event when you log a bet is quicker.",
    entries: [
      {
        kind: "feature",
        area: "Tracked Events",
        href: "/tracked-events",
        text: "It's now clearer what happened on Edge: who scored, bookings and VAR, plus each side's formation once the teams are named.",
      },
      {
        kind: "feature",
        area: "Add bet",
        href: "/tracker",
        text: "You can now pick a first or anytime goalscorer from the named players, instead of typing the name.",
      },
      {
        kind: "fix",
        area: "History",
        href: "/history",
        text: "Kick-off and each goal now show as the match unfolds, including the 2UP trigger, not only the final whistle.",
      },
      {
        kind: "improvement",
        area: "Fixtures",
        href: "/fixtures",
        text: "Today's and tomorrow's matches now open straight away and stay up to date in the background, the same way race cards already do.",
      },
      {
        kind: "improvement",
        area: "Add bet",
        href: "/tracker",
        text: "Finding a match or race is faster: search Events, grouped by Today, Tomorrow and kick-off hour.",
      },
      {
        kind: "improvement",
        area: "Racing Desk",
        href: "/racing",
        text: "Race cards now appear immediately, then live exchange prices fill in. Picks still come from your Edge recommendations.",
      },
      {
        kind: "improvement",
        area: "Profit Tracker",
        href: "/tracker",
        text: "On a 2UP bet, Stakes now shows the extra profit if the bookie pays early and the lay still wins, for example 2-2 after a two-goal lead.",
      },
      {
        kind: "improvement",
        area: "Accounts",
        href: "/accounts",
        text: "We've separated paying in from correcting a figure. Adjust balance now has Top up, Withdrawal and Adjustment.",
      },
      {
        kind: "fix",
        area: "Racing Desk",
        href: "/racing",
        text: "An offer bet from the desk is titled with the course and the offer. The horse you actually backed stays on the selection, not in the title.",
      },
    ],
  },
  {
    date: "2026-09-03",
    title: "Acca verdicts, offer terms in the bet form, faster race cards",
    summary:
      "It's now clearer how an acca finished. The bet form warns you before you break the offer terms, and race cards open faster.",
    entries: [
      {
        kind: "feature",
        area: "Acca Desk",
        href: "/acca",
        text: "When the last deciding leg lands, one alert now sums up the whole run: You just made £X (or the settled loss), won, locked or busted, with a nudge to claim the refund on acca insurance.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "It's now clearer if a draft breaks the offer. Placing a qualifier or convert shows the terms that matter and warns you as you type, across Add bet, Acca and Bet Builder.",
      },
      {
        kind: "improvement",
        area: "Acca Desk",
        href: "/acca",
        text: "We've made the live acca card easier to read. It now says If this leg loses with the cover, the next leg to lay or lock, and an all-win estimate.",
      },
      {
        kind: "improvement",
        area: "Racing Desk",
        href: "/racing",
        text: "Today's racing P&L now counts accas, bet builders and systems once when they span more than one race, and plots them on the day chart at the last racing leg.",
      },
      {
        kind: "improvement",
        area: "Racing Desk",
        href: "/racing",
        text: "Race cards open faster and stay available all day. The desk keeps today's and tomorrow's cards and refreshes them in the background.",
      },
      {
        kind: "improvement",
        area: "Tracked Events",
        href: "/tracked-events",
        text: "The race-awaiting-result prompt now opens Set result in place, instead of sending you to the page you are already on.",
      },
    ],
  },
  {
    date: "2026-09-02",
    title: "Phone quick actions open the real bet form",
    summary:
      "Add bet on the phone is the same form as the desktop. We've dropped the old three-field shortcut.",
    entries: [
      {
        kind: "fix",
        area: "Mobile",
        text: "Add bet on the phone now opens the full form, bookie list included. We've dropped the old Log manually shortcut, which saved a half-empty bet and could error.",
      },
      {
        kind: "improvement",
        area: "Mobile",
        text: "The other quick-action tiles now use the same names as the command palette: Adjust balance, Matched calculator, Log casino offer, Check a boost.",
      },
    ],
  },
  {
    date: "2026-08-30",
    title: "Plans you can open, and a live desk that stays",
    summary:
      "It's now clearer what each plan includes. A locked desk no longer blocks the click, and what you save on the live desk stays after a refresh.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings?tab=subscription&live=1",
        text: "You can now compare Core and Edge side by side: what each includes, the monthly price, and a 14-day Edge trial. Paid accounts open Manage subscription for the card, invoices and cancel.",
      },
      {
        kind: "improvement",
        area: "Navigation",
        text: "A locked desk no longer blocks the click. You open the page and see what the plan includes, with View plans. Early-payout Desk and Settings → Alerts do the same for lock-in alerts.",
      },
      {
        kind: "improvement",
        area: "Racing Desk",
        href: "/racing",
        text: "Race picks stays on the filter row on Free and Core, marked Edge. Live UK and Irish cards, Offer Edge picks and live lays share one Edge banner. Football fixtures stay on every plan.",
      },
      {
        kind: "improvement",
        area: "Edge Report",
        href: "/report",
        text: "A month with settled bets but no campaign EV locks yet now shows that month's Profit Tracker P&L, instead of a blank report.",
      },
      {
        kind: "improvement",
        area: "Accounts",
        href: "/accounts",
        text: "Opening a wallet now splits Details and Ledger. The ledger lists the full history, not the last 25 rows.",
      },
      {
        kind: "fix",
        area: "Home",
        href: "/desk",
        text: "The live desk now keeps offers, bets, wallets, free-bet lots, recurring series, playbook steps and mistake tags after a refresh.",
      },
    ],
  },
  {
    date: "2026-08-29",
    title: "Free bet log and wallets",
    summary:
      "You can now log and settle on Free, with bookie wallets that move with the result.",
    entries: [
      {
        kind: "feature",
        area: "Profit Tracker",
        href: "/tracker",
        text: "On Free, you can now log a bet from a calculator, Set result, and see basic P&L.",
      },
      {
        kind: "feature",
        area: "Accounts",
        href: "/accounts",
        text: "Placing a bet now reserves the back stake and lay liability. Set result pays the bookie and exchange wallets.",
      },
      {
        kind: "improvement",
        area: "Free",
        href: "/settings?tab=subscription&live=1",
        text: "The public plan table now says Free includes the settleable log and wallets. Offers, lots and Do Next stay on Core.",
      },
    ],
  },
  {
    date: "2026-08-29",
    title: "Refund-If offers and calculator polish",
    summary:
      "We've opened a proper path for money-back-if-you-lose campaigns, and the calculators are easier to scan.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Money back as a free bet if it loses is now its own campaign type (Refund-If). Step 1 is the underlay. Convert only if the bet loses. A win already locked the profit, so convert is skipped.",
      },
      {
        kind: "fix",
        area: "Offers",
        href: "/offers",
        text: "A lost risk-free bet now records the cash from the back and lay only. The free bet is awarded and converted as usual, instead of counting an anticipated refund as cash on the day.",
      },
      {
        kind: "feature",
        area: "Calculators",
        href: "/calculators/refund-if",
        text: "Refund-If now sits on the calculators index. On Refund-If and Risk-free, the lose row unpacks stake lost, the refund, then the net.",
      },
      {
        kind: "improvement",
        area: "Calculators",
        href: "/calculators",
        text: "Finding Core vs Tools is faster: every calculator card has an icon.",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Long race names in the offer Race menu now stay inside the field. The title shortens, runner counts stay on the right.",
      },
      {
        kind: "fix",
        area: "Mobile",
        href: "/desk",
        text: "Tab strips on small screens now pan when labels overflow, instead of clipping the last tab.",
      },
    ],
  },
  {
    date: "2026-08-26",
    title: "Refer a friend, payment recovery, and Racing Desk",
    summary:
      "You can now share Edgeways from Settings, get a clear prompt if a card payment fails, and Racing Desk shows your offers on the signed-in account.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "You can now refer a friend from Settings. They get 50% off their first paid month; you get £10 when they first pay. A prompt can also appear on Home.",
      },
      {
        kind: "feature",
        area: "Alerts",
        href: "/alerts",
        text: "If a subscription payment fails, you get an inbox alert and an email with the amount, the next retry, and a link to update your card. When the payment recovers, the alert clears.",
      },
      {
        kind: "fix",
        area: "Alerts",
        href: "/alerts",
        text: "Push and the alerts inbox now follow your Edgeways account, so they work on every device you sign in on, the same way as bets and offers.",
      },
      {
        kind: "fix",
        area: "Racing Desk",
        href: "/racing",
        text: "Race picks and qualifying offers now show on Racing Desk for your signed-in account.",
      },
      {
        kind: "improvement",
        area: "Guides",
        href: "/help",
        text: "Finding FAQ is faster: it now sits on the mobile Guides tab row, instead of buried under the guide cards.",
      },
    ],
  },
  {
    date: "2026-08-25",
    title: "Mobile fit and finish",
    summary:
      "We've made the phone easier to live on: the Home deck, quick actions, dialogs and the top bar.",
    entries: [
      {
        kind: "fix",
        area: "Mobile",
        href: "/desk",
        text: "Swiping the Home deck no longer fights the P&L chart. Drag the chart to scrub it, swipe anywhere else to change cards.",
      },
      {
        kind: "improvement",
        area: "Mobile",
        href: "/desk",
        text: "We've rebuilt Quick actions for the phone: big tiles for Paste slip and Log manually, with room to tap.",
      },
      {
        kind: "improvement",
        area: "Mobile",
        href: "/settings",
        text: "Dialogs and forms now fit small screens properly. No more squashed fields, and buttons are taller everywhere.",
      },
      {
        kind: "improvement",
        area: "Mobile",
        text: "The top bar stays tidy on narrow screens. Balances shorten (FB, Exch.) and the wordmark steps aside for the bolt when space runs out.",
      },
      {
        kind: "improvement",
        area: "Guides",
        href: "/help",
        text: "Support now lives inside Guides: feedback, email and the contact and refunds pages in one place.",
      },
    ],
  },
  {
    date: "2026-08-22",
    title: "Your desk, on every device",
    summary:
      "Sign in anywhere and your desk is there, and plans now shape what each account can do.",
    entries: [
      {
        kind: "feature",
        area: "Accounts",
        href: "/settings",
        text: "Your desk now lives in your Edgeways account. Bets, offers, balances and history are the same on phone and desktop, and backup works wherever you sign in.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "It's now clearer what your plan includes. Free, Core and Edge each unlock their own features.",
      },
      {
        kind: "improvement",
        area: "Accessibility",
        href: "/help?guide=keyboard",
        text: "Contrast is clearer across both themes, and you can settle the focused open bet from the keyboard.",
      },
    ],
  },
  {
    date: "2026-08-20",
    title: "Sign-in polish and keyboard speed",
    summary:
      "A smoother front door, and daily desk actions you can run without touching the mouse.",
    entries: [
      {
        kind: "improvement",
        area: "Sign-in",
        text: "Signing in with Google now shows the Edgeways name and branding on the consent screen.",
      },
      {
        kind: "feature",
        area: "Keyboard",
        href: "/help?guide=keyboard",
        text: "You can now run the daily actions from the keyboard: log a bet, settle, switch desks. Press ? anywhere for the cheat-sheet.",
      },
    ],
  },
  {
    date: "2026-08-16",
    title: "Billing, onboarding and bringing your history",
    summary:
      "You can now manage your subscription in Settings, new accounts get a kinder first run, and spreadsheet history has a proper import.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "You can now manage billing from Settings: update your card, download invoices, change or cancel your plan. The receipt shows your first charge date up front.",
      },
      {
        kind: "feature",
        area: "Onboarding",
        href: "/setup",
        text: "New accounts now get a kinder first run: experience level, why you're here, and a monthly target, then a guided path to a working desk.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/desk",
        text: "An empty desk now opens with a getting-started welcome instead of a blank slate.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "We've opened a proper import for Oddsmonkey CSV history: map the columns, preview, import. Imported rows join your P&L but never touch balances or EV capture.",
      },
      {
        kind: "feature",
        area: "Legal",
        href: "/terms",
        text: "Terms of Service and Privacy Policy are published, with consent collected at sign-up, plus public Contact and Refunds pages.",
      },
    ],
  },
  {
    date: "2026-08-12",
    title: "Racing Desk polish",
    summary:
      "The race card is easier to read, and offers now know whether they can be used once or many times.",
    entries: [
      {
        kind: "improvement",
        area: "Racing Desk",
        href: "/racing",
        text: "The race card is easier to read on wide screens: the price chart sits beside it, and the header stays tidy at any width.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Offers now know if they are one-shot or multi-use, so promotions you can use repeatedly are handled properly.",
      },
      {
        kind: "fix",
        area: "Offers",
        href: "/offers",
        text: "Offer completion now displays correctly on every campaign, and campaign dialogs no longer truncate collapsed fields.",
      },
      {
        kind: "fix",
        area: "Fixtures",
        href: "/fixtures",
        text: "Upcoming matches no longer show a result before kick-off.",
      },
    ],
  },
  {
    date: "2026-08-10",
    title: "Offer completion playbook: deposit codes to clear wagering",
    summary:
      "Pasting a promo now walks the campaign step by step, with the code on Step 1 and a clear next action.",
    entries: [
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Pasting an offer now fills the New offer form as you go. Green ticks mark what came from the paste until you edit them. Same pattern on Log a casino offer.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "It's now clearer what to do next. Campaign cards show a playbook: deposit, qualify, await award, convert, then clear wagering when the T&Cs need it.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "You can paste or drop a promo email to capture the code, min deposit, reward event and wagering. Bet & Get emails land with the right stakes and Step 1 as deposit plus code.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "The deposit step now shows the promo code for one-tap copy. Do next waits until the deposit is done before offering Place.",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Convert now locks the reward event when the offer names one. Clear wagering shows pounds left and completes only once outstanding WR is £0.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/desk",
        text: "Do next now puts playbook steps first, so a deposit-gated campaign does not look ready to qualify.",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Paste preview now calls out deposit plus code before you save. A classic bet and get without a deposit gate still starts at qualify.",
      },
    ],
  },
  {
    date: "2026-08-06",
    title: "Combo desks: Bet Builder, Systems, and place tools",
    summary:
      "Full-cover systems and bet builders now sit beside Acca, and Racing Desk has place-aware tools next to the runners.",
    entries: [
      {
        kind: "feature",
        area: "Bet Builder",
        href: "/bet-builder",
        text: "You can now run a bet builder on its own desk: create a run, track selections, settle the whole ticket, and open it from offers or Do next when the campaign is bet-builder shaped.",
      },
      {
        kind: "feature",
        area: "Systems",
        href: "/systems",
        text: "We've opened Systems Desk for Lucky, Patent, Trixie, Yankee and Canadian (Goliath). Paste a slip, organise legs, settle per leg. It tracks the system you already built, it is not a finder.",
      },
      {
        kind: "improvement",
        area: "Acca Desk",
        href: "/acca",
        text: "Acca runs now share paste-slip create with Bet Builder, and the live timeline is clearer.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        href: "/racing",
        text: "Each-way and place-refund work now stays next to the runners, with an Active bets strip, a place-zone bar, and a clearer today P&L.",
      },
      {
        kind: "feature",
        area: "Each Way",
        href: "/calculators/each-way",
        text: "The Each Way / Extra Place calculator is now on the desk, with a place ladder and dual-lay settle paths.",
      },
      {
        kind: "feature",
        area: "Feedback",
        href: "/feedback",
        text: "You can now send Feedback from the top menu: Bug, Idea or Other, then send or copy a report.",
      },
      {
        kind: "improvement",
        area: "Alerts",
        href: "/alerts",
        text: "Toasts are quieter for actions you just took, and settle-related copy is clearer.",
      },
    ],
  },
  {
    date: "2026-08-05",
    title: "Make it yours: appearance, reminders, and Acca from offers",
    summary:
      "You can now personalise the desk, set casino and offer reminders, and send multi-leg campaigns to the right combo desk.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "You can now choose a brand accent, header pattern and UI font. The desk keeps your choices across visits.",
      },
      {
        kind: "feature",
        area: "Casino",
        href: "/casino",
        text: "We've opened reminders on a campaign for free spins or bonuses that land later. They fire into the alerts inbox and as a push when due.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Place and Convert now open the matching combo desk when the offer is an acca or bet builder, with a chooser if more than one path applies.",
      },
      {
        kind: "improvement",
        area: "Tracker",
        href: "/tracker",
        text: "Multi-leg and offer-linked positions are easier to scan: campaign sections, settle flows and the P&L breakdown.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Monthly targets and demo mode",
    summary:
      "You can now set a monthly target, and a separate demo desk for walkthroughs.",
    entries: [
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "You can now set a monthly target in Settings. The Monthly P&L chip shows factual pace, not streaks or confetti.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "We've opened Demo mode: a separate, watermarked desk for screenshots. Your real data never mixes with it.",
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
        text: "The Edge Report now has a Year tab: profit, expected vs realised, and your best and worst bookmakers. Months before your first EV lock show settled profit only.",
      },
      {
        kind: "improvement",
        area: "Accessibility",
        href: "/help?guide=keyboard",
        text: "Screen readers now name every switch and icon button, and Reduce motion stills pulsing indicators. Help has a Keyboard & accessibility guide.",
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
        text: "We've shortened first-run setup to four steps: bank, bookies, defaults and notifications. Re-run it any time from Settings → Help & about.",
      },
      {
        kind: "fix",
        area: "Alerts",
        text: "In-app notifications on Android now show reliably, with the same tap-to-open links as push.",
      },
      {
        kind: "improvement",
        area: "Navigation",
        text: "The sidebar now groups into Betting, Live desks and Insight. On the phone the burger is a full-height drawer.",
      },
      {
        kind: "feature",
        area: "Help",
        href: "/help?guide=site-map",
        text: "Finding a page is faster: Help now has a site map of every route, including quick actions and pages outside the main nav.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Match Checker, alerts inbox, push and the palette",
    summary:
      "It's now quicker to check a price you found, and missed alerts wait in an inbox or on your phone.",
    entries: [
      {
        kind: "feature",
        area: "Match Checker",
        href: "/match-checker",
        text: "You can now check a price in seconds: back and lay odds, a good/ok/poor verdict, and one tap into the full calculator. It never lists markets.",
      },
      {
        kind: "improvement",
        area: "Match Checker",
        href: "/match-checker",
        text: "Risk-free offers stay in the full calculator, so a silent assumption here cannot mislead.",
      },
      {
        kind: "feature",
        area: "Alerts",
        href: "/alerts",
        text: "We've opened an Alerts inbox. Every alert is kept, with an unread badge. Tap to jump to the right desk.",
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
        text: "Push can now reach your phone from Settings → Alerts, even with every tab closed.",
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
        text: "Finding any page is faster: Cmd/Ctrl+K jumps to a page, offer or wallet, and runs the daily actions.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Your rules: tuning, Home layout and data custody",
    summary:
      "You can now tune how the desk behaves, choose the Home widgets you want, and back up or restore your data.",
    entries: [
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "We've opened a Tuning card for grace windows, drought nudges, retention weight and the £/hr sort. Each row shows its default and resets in one tap.",
      },
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "Home layout is yours: show or hide any widget and reorder the phone deck. Hidden widgets stay reachable from their own pages.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "You can now back up the whole desk in one tap, and restore only after you confirm what the file contains. A failed restore leaves everything untouched.",
      },
      {
        kind: "feature",
        area: "Settings",
        href: "/settings",
        text: "You can import spreadsheet history: map columns, preview, import. Unreadable rows are reported, never silently dropped.",
      },
      {
        kind: "improvement",
        area: "Settings",
        href: "/settings",
        text: "Imported history shows in your P&L, but it never changes balances or counts towards EV capture.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Edge Report, mistake tags, and the bookmaker league",
    summary:
      "It's now clearer whether you captured your edge, and where the leaks are.",
    entries: [
      {
        kind: "feature",
        area: "Edge Report",
        href: "/report",
        text: "We've opened the Edge Report: expected edge vs realised P&L, with capture rate, commission drag and free-bet retention. Thin months show not-enough-data instead of noisy lines.",
      },
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "When a campaign captures under 90% of its locked EV, you can now tag why in one tap. The report totals the £ lost per tag.",
      },
      {
        kind: "feature",
        area: "Accounts",
        href: "/accounts",
        text: "The bookmaker league now shows profit, ROI, retention and days since the last offer. Health is yours to set.",
      },
      {
        kind: "improvement",
        area: "Home",
        href: "/desk",
        text: "Gubbed bookies' offers sink to the bottom of Do next, but are never hidden. Closed accounts drop out.",
      },
    ],
  },
  {
    date: "2026-07-14",
    title: "Unhedged backs and 2UP lock-in alerts",
    summary:
      "It's now clearer when a back is still naked, and when a 2UP payout is ready to lock in.",
    entries: [
      {
        kind: "feature",
        area: "Alerts",
        href: "/desk",
        text: "An open qualifying or risk-free back with no lay now raises an amber Home banner after 10 minutes, or 3 minutes near the off. One tap marks it intentional.",
      },
      {
        kind: "feature",
        area: "Alerts",
        href: "/early-payout",
        text: "When your team goes two up, the alert now includes a lock-in suggestion: the equalising in-play back, stake and guaranteed profit.",
      },
      {
        kind: "improvement",
        area: "Settings",
        href: "/settings",
        text: "Each of these alerts has its own toggle in Settings → Alerts.",
      },
    ],
  },
  {
    date: "2026-07-13",
    title: "The mobile experience",
    summary:
      "We've opened a dedicated phone experience: swipeable Home, full-page layouts, and an installable app.",
    entries: [
      {
        kind: "feature",
        area: "Mobile",
        href: "/desk",
        text: "Home is now a swipeable deck on the phone, with a start card you can pin in Settings.",
      },
      {
        kind: "feature",
        area: "Mobile",
        href: "/tracker",
        text: "You can now capture a bet in three taps from a floating + on every screen.",
      },
      {
        kind: "feature",
        area: "Mobile",
        href: "/settings",
        text: "Edgeways now installs to your Home Screen, with notifications you can toggle per type.",
      },
      {
        kind: "improvement",
        area: "Mobile",
        text: "We've tidied the phone layouts: dialogs open as bottom sheets, and tables become card lists.",
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
      "You can now see the day as one timeline, and a chart that can show exactly what commission costs.",
    entries: [
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "You can now see offer deadlines, race off-times and kick-offs in one timeline, each with its expected £. Completed slots collapse but never reorder.",
      },
      {
        kind: "feature",
        area: "Chart",
        href: "/desk",
        text: "We've opened a Retained | Gross toggle, so the cost of commission is visible rather than silently netted.",
      },
      {
        kind: "improvement",
        area: "Chart",
        href: "/desk",
        text: "Markers now sit on the plotted line, with their own marks for balance corrections.",
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
      "Expected profit now locks when it becomes real, so expected vs realised is an honest comparison.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Expected profit now locks when a campaign starts, and is never silently changed. Settled campaigns show Expected → Realised and % captured.",
      },
      {
        kind: "improvement",
        area: "Offers",
        href: "/offers",
        text: "Expired campaigns now record their realised-to-date honestly.",
      },
    ],
  },
  {
    date: "2026-07-12",
    title: "Measured retention and smarter ranking",
    summary:
      "Retention now comes from your own conversions, every £-EV says how sure it is, and Do next ranks by £/hr.",
    entries: [
      {
        kind: "feature",
        area: "Offers",
        href: "/offers",
        text: "Free-bet retention is now measured from your own conversions, blended with a cautious default until you have enough of them.",
      },
      {
        kind: "feature",
        area: "Home",
        href: "/desk",
        text: "Every £-EV on screen now carries a live, estimated or heuristic badge, and Home leads with the edge on the table.",
      },
      {
        kind: "feature",
        area: "Do next",
        href: "/desk",
        text: "Do next now sorts by £/hr, flags a funding shortfall, and can paste a bookie confirmation into a prefilled bet.",
      },
      {
        kind: "feature",
        area: "Racing Desk",
        href: "/racing",
        text: "Racing Desk now shows no-vig fair odds per runner.",
      },
    ],
  },
];
