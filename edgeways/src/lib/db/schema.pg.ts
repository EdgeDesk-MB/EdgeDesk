/**
 * Postgres schema for hosted Neon (EDGE-47).
 * Parallel to schema.ts (SQLite) — local Mac keeps SQLite until async cutover.
 * Waitlist and app_users import from here when DATABASE_URL is set.
 */
import {
  bigint,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull().default("football"),
  externalId: text("external_id"),
  competition: text("competition"),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  startTime: integer("start_time").notNull(), // epoch ms
  status: text("status", { enum: ["upcoming", "live", "finished"] })
    .notNull()
    .default("upcoming"),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  minute: integer("minute").notNull().default(0),
  homeLed2: integer("home_led2").notNull().default(0),
  awayLed2: integer("away_led2").notNull().default(0),
  source: text("source", { enum: ["api", "manual", "sim"] })
    .notNull()
    .default("manual"),
  /** Goal timeline: JSON array of {minute, side, player?, og?} - feeds trigger settlement */
  goals: text("goals"),
  /** 90-minute score for AET/PEN matches (homeScore/awayScore stores the full final) */
  ftHomeScore: integer("ft_home_score"),
  ftAwayScore: integer("ft_away_score"),
  /** How the match ended: "ft" | "aet" | "pen" | null (null = unknown / not yet finished) */
  matchEnding: text("match_ending"),
  /** Simulated matches: JSON script of goals [{minute, side}] generated at creation */
  simScript: text("sim_script"),
  /** Real-world kickoff anchor for the simulation clock */
  simStartedAt: integer("sim_started_at"),
  createdAt: integer("created_at").notNull(),
});

export const exchanges = pgTable("exchanges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  commissionPct: doublePrecision("commission_pct").notNull().default(0),
  brandColor: text("brand_color").notNull().default("#3f3f46"),
  backColor: text("back_color").notNull().default("#a6d8ff"),
  layColor: text("lay_color").notNull().default("#fac9d1"),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id"),
  label: text("label").notNull(),
  market: text("market").notNull().default("match_odds"),
  selection: text("selection").notNull().default(""),
  betType: text("bet_type").notNull().default("qualifying"),
  bookmaker: text("bookmaker"),
  exchangeId: integer("exchange_id"),
  backStake: doublePrecision("back_stake").notNull().default(0),
  backOdds: doublePrecision("back_odds").notNull().default(0),
  layStake: doublePrecision("lay_stake").notNull().default(0),
  layOdds: doublePrecision("lay_odds").notNull().default(0),
  commission: doublePrecision("commission").notNull().default(0.02),
  earlyPayout: integer("early_payout").notNull().default(0),
  refundAmount: doublePrecision("refund_amount"),
  refundRetention: doublePrecision("refund_retention"),
  /** Dutch bets: JSON array of DutchLegRecord */
  legs: text("legs"),
  /** "The bet wins IF …" - raw condition as typed by the user */
  triggerText: text("trigger_text"),
  /** Parsed TriggerRule JSON; when present the trigger engine settles this bet */
  triggerRule: text("trigger_rule"),
  status: text("status", {
    enum: ["open", "won", "lost", "void", "early_payout", "half_win", "half_lose", "push"],
  })
    .notNull()
    .default("open"),
  expectedProfit: doublePrecision("expected_profit"),
  actualProfit: doublePrecision("actual_profit"),
  notes: text("notes"),
  balanceLedgered: integer("balance_ledgered").notNull().default(0),
  balanceSettled: integer("balance_settled").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  settledAt: integer("settled_at"),
  offerId: integer("offer_id"),
  /** Epoch ms when the bet was captured via mobile quick-log (C3); null = full entry */
  quickLogged: integer("quick_logged"),
  /** Provenance (E3): "import" = spreadsheet history, excluded from EV capture */
  source: text("source"),
  /** J5: null/'edge' = normal; 'mug' = camouflage bet, excluded from edge analytics */
  purpose: text("purpose"),
  /**
   * Denormalised sport for rows without a linked event (desk backs, quick-log).
   * Prefer events.sport when eventId is set.
   */
  sport: text("sport"),
});

/** Mug-bet cadence plan per bookie account (J5) - camouflage budgeting. */
export const mugPlans = pgTable("mug_plans", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  /** Place a mug bet at least every N days */
  cadenceDays: integer("cadence_days").notNull(),
  monthlyBudget: doublePrecision("monthly_budget"),
  lastMugAt: integer("last_mug_at"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

/** Acca desk run (J7) - a guided multi-day acca workflow. */
export const accaRuns = pgTable("acca_runs", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id"),
  label: text("label").notNull(),
  /** sequential, insurance (legs/whole), or combined one-lay (Smarkets-style) */
  method: text("method", {
    enum: ["sequential", "insurance_legs", "insurance_whole", "combined"],
  }).notNull(),
  stake: doublePrecision("stake").notNull(),
  bookmaker: text("bookmaker"),
  commission: doublePrecision("commission").notNull().default(0),
  /** Insurance: free bet face refunded when exactly one leg loses */
  refundAmount: doublePrecision("refund_amount"),
  /** The acca back itself as a REAL bets row - tracker owns the money */
  backBetId: integer("back_bet_id"),
  /** insurance_whole / combined: the single combined lay, also a real lay_only bet */
  wholeLayBetId: integer("whole_lay_bet_id"),
  wholeLayStake: doublePrecision("whole_lay_stake"),
  wholeLayOdds: doublePrecision("whole_lay_odds"),
  /** Bookmaker acca boost, e.g. 50 for a 50% boost on the combined price (winnings-only convention) */
  boostPct: doublePrecision("boost_pct"),
  /** 1 = deliberate back-only (no exchange lay); Combined method */
  noLay: integer("no_lay").notNull().default(0),
  muteAlerts: integer("mute_alerts").notNull().default(0),
  status: text("status", { enum: ["active", "completed", "abandoned"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull(),
  settledAt: integer("settled_at"),
});

/** One leg of an acca run; placed lays are REAL bets rows via layBetId. */
export const accaLegs = pgTable("acca_legs", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  seq: integer("seq").notNull(),
  label: text("label").notNull(),
  eventId: integer("event_id"),
  /** Sport when no event linked; when eventId is set, prefer events.sport. */
  sport: text("sport"),
  /** For auto-results from a linked event (football + horse racing via desk helper) */
  market: text("market"),
  selection: text("selection"),
  backOdds: doublePrecision("back_odds").notNull(),
  layOdds: doublePrecision("lay_odds"),
  layStake: doublePrecision("lay_stake"),
  layBetId: integer("lay_bet_id"),
  result: text("result", { enum: ["pending", "won", "lost", "void"] })
    .notNull()
    .default("pending"),
  scheduledAt: integer("scheduled_at"),
});

/** Bet Builder desk run — same-event combo, one kick-off, combined lay or no lay. */
export const betBuilderRuns = pgTable("bet_builder_runs", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id"),
  label: text("label").notNull(),
  method: text("method", { enum: ["combined", "no_lay"] }).notNull(),
  stake: doublePrecision("stake").notNull(),
  bookmaker: text("bookmaker"),
  commission: doublePrecision("commission").notNull().default(0),
  /** Combined bookie BB price (decimal) */
  backOdds: doublePrecision("back_odds").notNull(),
  backBetId: integer("back_bet_id"),
  wholeLayBetId: integer("whole_lay_bet_id"),
  wholeLayStake: doublePrecision("whole_lay_stake"),
  wholeLayOdds: doublePrecision("whole_lay_odds"),
  eventLabel: text("event_label"),
  /** Linked tracked event (same-event builder); sport preferably from events.sport. */
  eventId: integer("event_id"),
  /** Sport when no event linked. */
  sport: text("sport"),
  scheduledAt: integer("scheduled_at"),
  muteAlerts: integer("mute_alerts").notNull().default(0),
  status: text("status", { enum: ["active", "completed", "abandoned"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull(),
  settledAt: integer("settled_at"),
});

/** One selection inside a bet builder (checklist; no per-selection lay). */
export const betBuilderSelections = pgTable("bet_builder_selections", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  seq: integer("seq").notNull(),
  label: text("label").notNull(),
  market: text("market"),
  selection: text("selection"),
  result: text("result", { enum: ["pending", "won", "lost", "void"] })
    .notNull()
    .default("pending"),
});

/**
 * Systems desk — full-cover tickets (Trixie / Yankee / Lucky family).
 * Organisation + settle only; no Acca-style lay workflow.
 */
export const systemRuns = pgTable("system_runs", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id"),
  label: text("label").notNull(),
  structure: text("structure", {
    enum: [
      "trixie",
      "patent",
      "yankee",
      "canadian",
      "heinz",
      "super_heinz",
      "goliath",
      "lucky_15",
      "lucky_31",
      "lucky_63",
    ],
  }).notNull(),
  unitStake: doublePrecision("unit_stake").notNull(),
  lines: integer("lines").notNull(),
  totalStake: doublePrecision("total_stake").notNull(),
  /** 1 = each-way */
  eachWay: integer("each_way").notNull().default(0),
  /** Place fraction when each-way, e.g. 0.2 = 1/5, 0.25 = 1/4 */
  placeFraction: doublePrecision("place_fraction"),
  bookmaker: text("bookmaker"),
  /** ev_play | mug_bet | qualifying */
  classification: text("classification").notNull().default("ev_play"),
  backBetId: integer("back_bet_id"),
  status: text("status", { enum: ["active", "completed", "abandoned"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull(),
  settledAt: integer("settled_at"),
});

export const systemLegs = pgTable("system_legs", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  seq: integer("seq").notNull(),
  label: text("label").notNull(),
  eventId: integer("event_id"),
  /** Sport when no event linked; when eventId is set, prefer events.sport. */
  sport: text("sport"),
  market: text("market"),
  selection: text("selection"),
  oddsDecimal: doublePrecision("odds_decimal").notNull(),
  /** placed = finished in places but not 1st (each-way place part only) */
  result: text("result", {
    enum: ["pending", "won", "placed", "lost", "void"],
  })
    .notNull()
    .default("pending"),
  scheduledAt: integer("scheduled_at"),
});

/** Matched betting offer / promo pipeline (sign-up, reload, racing refund, etc.) */
export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  bookmaker: text("bookmaker"),
  title: text("title").notNull(),
  description: text("description"),
  expectedProfit: doublePrecision("expected_profit"),
  status: text("status", { enum: ["planned", "active", "completed", "expired"] })
    .notNull()
    .default("active"),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
  /** YYYY-MM-DD; a "planned" offer auto-activates once this date arrives. Null = live now. */
  startsOn: text("starts_on"),
  /** horse_racing | football | sports | casino; null = general */
  sport: text("sport"),
  /** e.g. bet_get_free_place | promo_terms */
  offerType: text("offer_type"),
  /** all courses when null or 'all'; else specific course name */
  scopeCourse: text("scope_course"),
  /** YYYY-MM-DD racing day scope */
  eventDate: text("event_date"),
  /** Racing API race_id when offer is locked to one race */
  scopeRaceId: text("scope_race_id"),
  /** Display label e.g. "15:00 · Bahrain Trophy" */
  scopeRaceLabel: text("scope_race_label"),
  /** JSON rules - racing place-refund and/or important promo terms */
  rules: text("rules"),
  /** FK when this row is one occurrence of a recurring series */
  seriesId: integer("series_id"),
  /** YYYY-MM-DD occurrence date for recurring instances */
  instanceDate: text("instance_date"),
  /** J6: 'email' = created by email intake (drafts land planned for review) */
  source: text("source"),
  /** External bookmaker/casino promo page URL ("Link to offer") */
  offerUrl: text("offer_url"),
});

/** Immutable EV baseline written when a campaign goes active; versioned on re-lock. */
export const offerEvSnapshots = pgTable("offer_ev_snapshots", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  version: integer("version").notNull().default(1),
  lockedAt: integer("locked_at").notNull(),
  expectedProfit: doublePrecision("expected_profit").notNull(),
  basis: text("basis").notNull(), // "live" | "estimated" | "heuristic"
  inputsJson: text("inputs_json"), // { autoLocked, retentionUsed?, freeBetAmount?, stake? }
  // Settlement fill-in — null until settled:
  realizedProfit: doublePrecision("realized_profit"),
  capturePct: doublePrecision("capture_pct"),
  commissionDrag: doublePrecision("commission_drag"),
  settledAt: integer("settled_at"),
  /** B7 mistake ledger: laid_late | wrong_market | odds_moved | bookie_voided | other */
  mistakeTag: text("mistake_tag"),
});

/** Recurring offer template - instances are materialised as separate offer rows */
export const offerSeries = pgTable("offer_series", {
  id: serial("id").primaryKey(),
  recurrenceEnabled: integer("recurrence_enabled").notNull().default(1),
  /** No new instances on/after this date (YYYY-MM-DD) when recurrence stopped */
  recurrenceStoppedFrom: text("recurrence_stopped_from"),
  /** JSON string[] of YYYY-MM-DD dates deleted as single occurrences (not re-materialised) */
  skippedDatesJson: text("skipped_dates_json"),
  ruleJson: text("rule_json").notNull(),
  /** Reference expiry used to derive each instance deadline (time-of-day) */
  templateExpiresAt: integer("template_expires_at"),
  horizonDays: integer("horizon_days").notNull().default(14),
  bookmaker: text("bookmaker"),
  title: text("title").notNull(),
  description: text("description"),
  expectedProfit: doublePrecision("expected_profit"),
  sport: text("sport"),
  offerType: text("offer_type"),
  scopeCourse: text("scope_course"),
  scopeRaceId: text("scope_race_id"),
  scopeRaceLabel: text("scope_race_label"),
  rules: text("rules"),
  /** External bookmaker promo page URL ("Link to offer") */
  offerUrl: text("offer_url"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Web-push subscriptions (F3) - one row per device/browser */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  /** Coarse device label from the subscribing user agent */
  label: text("label"),
  createdAt: integer("created_at").notNull(),
  lastOkAt: integer("last_ok_at"),
});

/** Persistent alert history (F2) - toasts/notifications deliver, this is the record */
export const alertsInbox = pgTable("alerts_inbox", {
  id: serial("id").primaryKey(),
  /** Stable rule dedupe key - a re-firing rule updates its row */
  dedupe: text("dedupe").notNull().unique(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  readAt: integer("read_at"),
});

/**
 * User-set reminders (e.g. free spins credited tomorrow). Fired into the
 * alerts inbox + push when remindAt is due; not the same as expiry nudges.
 */
export const userReminders = pgTable("user_reminders", {
  id: serial("id").primaryKey(),
  note: text("note").notNull(),
  remindAt: integer("remind_at").notNull(),
  /** Optional link to a casino campaign */
  casinoOfferId: integer("casino_offer_id"),
  /** Optional link to a sports offer campaign */
  offerId: integer("offer_id"),
  /** Snapshot title for the alert when the linked row is gone */
  contextTitle: text("context_title"),
  /** Snapshot bookie/casino name for the alert when the linked row is gone */
  contextVenue: text("context_venue"),
  createdAt: integer("created_at").notNull(),
  firedAt: integer("fired_at"),
  cancelledAt: integer("cancelled_at"),
});

/**
 * Local feedback / bug reports. Stored on-device; the UI can also open a
 * mailto so a copy can be sent to the maintainer.
 */
export const feedbackReports = pgTable("feedback_reports", {
  id: serial("id").primaryKey(),
  /** bug | idea | other */
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  replyEmail: text("reply_email"),
  /** JSON FeedbackDiagnostics snapshot */
  diagnosticsJson: text("diagnostics_json").notNull(),
  createdAt: integer("created_at").notNull(),
  /** Linear issue id once triaged (e.g. "EDGE-12"); null until filed */
  linearIssueId: text("linear_issue_id"),
});

/** Launch waitlist (EDGE-26). Single opt-in; token used for unsubscribe (+ legacy confirm). */
export const waitlistSignups = pgTable("waitlist_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** SHA-256 hex of the raw list token (unsubscribe / legacy confirm) */
  confirmTokenHash: text("confirm_token_hash").notNull(),
  /** ms epoch — bigint: Postgres integer cannot hold Date.now() */
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  confirmedAt: bigint("confirmed_at", { mode: "number" }),
  /** When the thanks / confirm email was last sent (ms) */
  confirmSentAt: bigint("confirm_sent_at", { mode: "number" }),
  /** When the address opted out of waitlist mail */
  unsubscribedAt: bigint("unsubscribed_at", { mode: "number" }),
});

/**
 * Hosted account row keyed by Clerk user id (EDGE-20 / EDGE-47).
 * Entitlement tier lands later via billing webhooks; this table is the join key.
 */
export const appUsers = pgTable("app_users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/** Bookie, exchange, or bank wallet for bankroll tracking */
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["bookie", "exchange", "bank"] }).notNull(),
  exchangeId: integer("exchange_id"),
  /** Bookie/exchange: which bank usually funds this wallet */
  fundedByAccountId: integer("funded_by_account_id"),
  brandColor: text("brand_color"),
  /** J8: household owner operating this account; everything existing = 'me' */
  owner: text("owner").notNull().default("me"),
  isActive: integer("is_active").notNull().default(1),
  /**
   * Bookie access status:
   * available - can place offers
   * gubbed - restricted / limited (still may have balance)
   * closed - account shut
   */
  accessStatus: text("access_status", {
    enum: ["available", "gubbed", "closed"],
  })
    .notNull()
    .default("available"),
  notes: text("notes"),
  /** Outstanding wagering requirement (£ remaining) */
  wrRemaining: doublePrecision("wr_remaining").notNull().default(0),
  /** Min decimal odds for a bet to count toward WR */
  wrMinOdds: doublePrecision("wr_min_odds"),
  /**
   * How much of a cash bet counts toward WR:
   * stake - full back stake
   * risk_win - min(stake, potential winnings) e.g. Pinnacle-style
   */
  wrType: text("wr_type", { enum: ["stake", "risk_win"] }).notNull().default("stake"),
  /**
   * Manual bookie health flag (B9). Only "cooling" is stored here - gubbed and
   * closed live in accessStatus (single source of truth). Null = healthy.
   */
  health: text("health"),
  healthUpdatedAt: integer("health_updated_at"),
  createdAt: integer("created_at").notNull(),
});

/** Ledger of top-ups, withdrawals, bet stakes, settlements, transfers and fees */
export const balanceTransactions = pgTable("balance_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category", {
    enum: [
      "top_up",
      "withdrawal",
      "adjustment",
      "bet_stake",
      "bet_settlement",
      "casino_settlement",
      "free_bet",
      "transfer",
      "fee",
    ],
  }).notNull(),
  betId: integer("bet_id"),
  /** Casino campaign wallet settlement (P&L itself lives on casino_offers.actual_profit) */
  casinoOfferId: integer("casino_offer_id"),
  /** Links paired transfer legs (and optional fee) */
  transferGroupId: text("transfer_group_id"),
  /** 1 = awaiting statement confirmation (Ultimatcher pending bank credit) */
  pending: integer("pending").notNull().default(0),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
  confirmedAt: integer("confirmed_at"),
  /** 1 = this adjustment should be included in the P&L chart and settledProfit total */
  affectPnl: integer("affect_pnl").notNull().default(0),
  /** Free-bet credit deadline (epoch ms). Ignored on non-credit / non-free_bet rows. */
  expiresAt: integer("expires_at"),
});

/**
 * Live commentary feed: kick-offs, goals, 2UP triggers, full times, bet
 * settlements and casino settlements. Written idempotently (dedupe key =
 * natural id). Casino P&L rows use kind `casino_settlement`.
 */
export const history = pgTable("history", {
  id: serial("id").primaryKey(),
  dedupe: text("dedupe").notNull().unique(),
  kind: text("kind", {
    enum: [
      "kickoff",
      "goal",
      "two_up",
      "full_time",
      "settlement",
      "casino_settlement",
      "free_bet_promo",
      "bet_placed",
      "balance_adjustment",
    ],
  }).notNull(),
  eventId: integer("event_id"),
  betId: integer("bet_id"),
  minute: integer("minute"),
  title: text("title").notNull(),
  detail: text("detail"),
  /** User explanation for balance corrections (shown under the title in History). */
  note: text("note"),
  /** Settlements (bet + casino) and P&L adjustments: realised profit (+) or loss (−) */
  amount: doublePrecision("amount"),
  createdAt: integer("created_at").notNull(),
});

/** Key-value app preferences (defaults, reminders, OCR behaviour). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** SP snapshots polled from racecards - steamer/drifter on Racing Desk */
export const racingOddsSnapshots = pgTable("racing_odds_snapshots", {
  id: serial("id").primaryKey(),
  raceId: text("race_id").notNull(),
  horseId: text("horse_id").notNull(),
  horse: text("horse").notNull(),
  spDecimal: doublePrecision("sp_decimal").notNull(),
  /** bookie = back/SP movement; exchange = live lay movement */
  kind: text("kind").notNull().default("bookie"),
  capturedAt: integer("captured_at").notNull(),
});

/**
 * Manual odds pasted over proxy/API prices on Racing Desk.
 * Free-tier workaround for live bookie odds without Racing API Standard.
 */
/** Boost diary (J2/J2b) - EV check ledger; optional linked bet for money path. */
export const boostDiary = pgTable("boost_diary", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  bookmaker: text("bookmaker"),
  kind: text("kind", { enum: ["boost", "builder"] }).notNull(),
  boostedOdds: doublePrecision("boosted_odds").notNull(),
  fairOdds: doublePrecision("fair_odds").notNull(),
  stake: doublePrecision("stake").notNull(),
  evGbp: doublePrecision("ev_gbp").notNull(),
  /** EV basis at check time (A2 rule) */
  basis: text("basis", { enum: ["estimated", "heuristic"] }).notNull().default("estimated"),
  /** Linked Profit Tracker bet once Place bet confirms Add bet (J2b). */
  betId: integer("bet_id"),
  /** Lay preview persisted for Add bet prefill from a Logged row. */
  layStake: doublePrecision("lay_stake"),
  layOdds: doublePrecision("lay_odds"),
  commission: doublePrecision("commission"),
  exchangeId: integer("exchange_id"),
  exchangeBack: doublePrecision("exchange_back"),
  outcome: text("outcome", { enum: ["won", "lost", "void"] }),
  actualProfit: doublePrecision("actual_profit"),
  createdAt: integer("created_at").notNull(),
  settledAt: integer("settled_at"),
});

/** Measured execution effort per offer action (J1) - powers real £/hr. */
export const offerEffortSamples = pgTable("offer_effort_samples", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  actionKind: text("action_kind").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at").notNull(),
  durationMin: doublePrecision("duration_min").notNull(),
  edited: integer("edited").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

/**
 * Casino desk (H2/K1) - wagering campaigns. Realised P&L is `actualProfit`
 * on completed rows (Casino P&L bucket); wallet moves link via balance_transactions.
 * A row is a CAMPAIGN; its reward/cost maths lives in linked `casinoOfferComponents`
 * rows (K1), mirroring how `offers` campaigns hold their maths in linked `bets`.
 *
 * `bonusAmount`, `wageringMultiplier`, `rtp`, `contributionPct`, `expectedEv` and `game`
 * are LEGACY (pre-K1): read exactly once by the K1 backfill migration in `db/index.ts`
 * to create each pre-existing offer's single `bonus`-type component, then never again.
 * Kept rather than dropped per the additive-only migration convention - do not read or
 * write them from any code path added after K1.
 */
export const casinoOffers = pgTable("casino_offers", {
  id: serial("id").primaryKey(),
  casino: text("casino"),
  title: text("title").notNull(),
  /** @deprecated legacy pre-K1 field, migration-only */
  bonusAmount: doublePrecision("bonus_amount").notNull(),
  /** @deprecated legacy pre-K1 field, migration-only */
  wageringMultiplier: doublePrecision("wagering_multiplier").notNull(),
  /** @deprecated legacy pre-K1 field, migration-only */
  rtp: doublePrecision("rtp"),
  /** @deprecated legacy pre-K1 field, migration-only */
  contributionPct: doublePrecision("contribution_pct"),
  status: text("status", { enum: ["planned", "active", "completed", "expired"] })
    .notNull()
    .default("planned"),
  /** @deprecated legacy pre-K1 field, migration-only - use CasinoOfferSummary.expectedEv */
  expectedEv: doublePrecision("expected_ev").notNull(),
  /** Realised £ entered by the user at completion (campaign-level total) */
  actualProfit: doublePrecision("actual_profit"),
  notes: text("notes"),
  /** @deprecated legacy pre-K1 field, migration-only */
  game: text("game"),
  /** When the offer/wagering window closes (epoch ms); null = no known expiry. Drives the Casino calendar. */
  expiresAt: integer("expires_at"),
  /** FK when this row is one occurrence of a recurring casino series (K3) */
  seriesId: integer("series_id"),
  /** YYYY-MM-DD occurrence date for recurring instances */
  instanceDate: text("instance_date"),
  /** External casino promo page URL ("Link to offer") */
  offerUrl: text("offer_url"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

/** Recurring casino offer template - instances are materialised as separate casino_offers rows (K3). */
export const casinoOfferSeries = pgTable("casino_offer_series", {
  id: serial("id").primaryKey(),
  recurrenceEnabled: integer("recurrence_enabled").notNull().default(1),
  /** No new instances on/after this date (YYYY-MM-DD) when recurrence stopped */
  recurrenceStoppedFrom: text("recurrence_stopped_from"),
  /** JSON string[] of YYYY-MM-DD dates deleted as single occurrences (not re-materialised) */
  skippedDatesJson: text("skipped_dates_json"),
  ruleJson: text("rule_json").notNull(),
  /** Reference expiry used to derive each instance deadline (time-of-day) */
  templateExpiresAt: integer("template_expires_at"),
  horizonDays: integer("horizon_days").notNull().default(14),
  casino: text("casino"),
  title: text("title").notNull(),
  notes: text("notes"),
  /** External casino promo page URL ("Link to offer") */
  offerUrl: text("offer_url"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Component template for a casino offer series (K3). Same shape as
 * casino_offer_components minus expectedEv (derived fresh per instance) and
 * casinoOfferId (replaced by seriesId).
 */
export const casinoOfferSeriesComponents = pgTable("casino_offer_series_components", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  componentType: text("component_type", {
    enum: ["qualifying_wager", "cash", "bonus", "free_spins", "golden_chips", "cashback"],
  }).notNull(),
  amount: doublePrecision("amount"),
  wageringMultiplier: doublePrecision("wagering_multiplier"),
  rtp: doublePrecision("rtp"),
  contributionPct: doublePrecision("contribution_pct"),
  spins: doublePrecision("spins"),
  spinValue: doublePrecision("spin_value"),
  chipCount: doublePrecision("chip_count"),
  chipValue: doublePrecision("chip_value"),
  houseEdgePreset: text("house_edge_preset", { enum: ["european", "american", "custom"] }),
  cashbackPct: doublePrecision("cashback_pct"),
  cashbackCap: doublePrecision("cashback_cap"),
  game: text("game"),
  /** JSON string[] of eligible game names selected in the picker */
  eligibleGamesJson: text("eligible_games_json"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

/**
 * Casino offer components (K1) - one row per reward or cost stage on a campaign.
 * `amount`, `wageringMultiplier`, `rtp`, `contributionPct` etc are reused across
 * component types (meaning depends on `componentType`) rather than duplicated into
 * per-type columns - see the K1 brief (implementation-briefs.md, Phase 12) for the
 * exact field meaning per type and the calc functions in `casino-reward-ev.ts` /
 * `casino-ev.ts` that consume them.
 */
export const casinoOfferComponents = pgTable("casino_offer_components", {
  id: serial("id").primaryKey(),
  casinoOfferId: integer("casino_offer_id").notNull(),
  componentType: text("component_type", {
    enum: ["qualifying_wager", "cash", "bonus", "free_spins", "golden_chips", "cashback"],
  }).notNull(),
  /** Wager amount / cash amount / bonus amount / cashback's expected-turnover basis */
  amount: doublePrecision("amount"),
  /** Bonus playthrough x, or free-spins winnings-wager x */
  wageringMultiplier: doublePrecision("wagering_multiplier"),
  /** Game RTP or edge-derived RTP (0-1); null = 96% heuristic default */
  rtp: doublePrecision("rtp"),
  /** Game contribution to wagering (0-1); null = 100% */
  contributionPct: doublePrecision("contribution_pct"),
  /** Free spins only */
  spins: doublePrecision("spins"),
  /** Free spins only, £ per spin */
  spinValue: doublePrecision("spin_value"),
  /** Golden chips only */
  chipCount: doublePrecision("chip_count"),
  /** Golden chips only, £ per chip */
  chipValue: doublePrecision("chip_value"),
  /** Golden chips only - cosmetic, drives which preset populated `rtp` */
  houseEdgePreset: text("house_edge_preset", { enum: ["european", "american", "custom"] }),
  /** Cashback only, fraction 0-1 */
  cashbackPct: doublePrecision("cashback_pct"),
  /** Cashback only, £ cap on the payout */
  cashbackCap: doublePrecision("cashback_cap"),
  /** Recommended eligible game for this component (bonus / free_spins) */
  game: text("game"),
  /** JSON string[] of eligible game names selected in the picker */
  eligibleGamesJson: text("eligible_games_json"),
  /** This component's own EV, locked at save time - negative for qualifying_wager */
  expectedEv: doublePrecision("expected_ev").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

/** Game RTP reference library (H2) - seeded with published values, user-editable. */
export const casinoGames = pgTable("casino_games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  provider: text("provider"),
  /** Fraction 0-1 */
  rtp: doublePrecision("rtp").notNull(),
  source: text("source").notNull().default("user"),
  updatedAt: integer("updated_at").notNull(),
});

export const racingOddsOverrides = pgTable("racing_odds_overrides", {
  id: serial("id").primaryKey(),
  raceId: text("race_id").notNull(),
  horseId: text("horse_id").notNull(),
  bookieDecimal: doublePrecision("bookie_decimal"),
  exchangeDecimal: doublePrecision("exchange_decimal"),
  updatedAt: integer("updated_at").notNull(),
});

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type BetRow = typeof bets.$inferSelect;
export type NewBetRow = typeof bets.$inferInsert;
export type ExchangeRow = typeof exchanges.$inferSelect;
export type NewExchangeRow = typeof exchanges.$inferInsert;
export type HistoryRow = typeof history.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type AlertsInboxRow = typeof alertsInbox.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type UserReminderRow = typeof userReminders.$inferSelect;
export type FeedbackReportRow = typeof feedbackReports.$inferSelect;
export type BalanceTransactionRow = typeof balanceTransactions.$inferSelect;
export type NewBalanceTransactionRow = typeof balanceTransactions.$inferInsert;
export type OfferRow = typeof offers.$inferSelect;
export type NewOfferRow = typeof offers.$inferInsert;
export type RacingOddsOverrideRow = typeof racingOddsOverrides.$inferSelect;
export type CasinoOfferRow = typeof casinoOffers.$inferSelect;
export type NewCasinoOfferRow = typeof casinoOffers.$inferInsert;
export type CasinoOfferComponentRow = typeof casinoOfferComponents.$inferSelect;
export type NewCasinoOfferComponentRow = typeof casinoOfferComponents.$inferInsert;
export type CasinoOfferSeriesRow = typeof casinoOfferSeries.$inferSelect;
export type CasinoOfferSeriesComponentRow = typeof casinoOfferSeriesComponents.$inferSelect;
export type CasinoGameRow = typeof casinoGames.$inferSelect;
export type OfferEffortSampleRow = typeof offerEffortSamples.$inferSelect;
export type BoostDiaryRow = typeof boostDiary.$inferSelect;
export type MugPlanRow = typeof mugPlans.$inferSelect;
export type AccaRunRow = typeof accaRuns.$inferSelect;
export type AccaLegRow = typeof accaLegs.$inferSelect;
export type BetBuilderRunRow = typeof betBuilderRuns.$inferSelect;
export type BetBuilderSelectionRow = typeof betBuilderSelections.$inferSelect;
export type SystemRunRow = typeof systemRuns.$inferSelect;
export type SystemLegRow = typeof systemLegs.$inferSelect;
