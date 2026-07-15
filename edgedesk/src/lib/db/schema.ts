import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const exchanges = sqliteTable("exchanges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  commissionPct: real("commission_pct").notNull().default(0),
  brandColor: text("brand_color").notNull().default("#3f3f46"),
  backColor: text("back_color").notNull().default("#a6d8ff"),
  layColor: text("lay_color").notNull().default("#fac9d1"),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const bets = sqliteTable("bets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id"),
  label: text("label").notNull(),
  market: text("market").notNull().default("match_odds"),
  selection: text("selection").notNull().default(""),
  betType: text("bet_type").notNull().default("qualifying"),
  bookmaker: text("bookmaker"),
  exchangeId: integer("exchange_id"),
  backStake: real("back_stake").notNull().default(0),
  backOdds: real("back_odds").notNull().default(0),
  layStake: real("lay_stake").notNull().default(0),
  layOdds: real("lay_odds").notNull().default(0),
  commission: real("commission").notNull().default(0.02),
  earlyPayout: integer("early_payout").notNull().default(0),
  refundAmount: real("refund_amount"),
  refundRetention: real("refund_retention"),
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
  expectedProfit: real("expected_profit"),
  actualProfit: real("actual_profit"),
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
});

/** Matched betting offer / promo pipeline (sign-up, reload, racing refund, etc.) */
export const offers = sqliteTable("offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookmaker: text("bookmaker"),
  title: text("title").notNull(),
  description: text("description"),
  expectedProfit: real("expected_profit"),
  status: text("status", { enum: ["planned", "active", "completed", "expired"] })
    .notNull()
    .default("active"),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
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
});

/** Immutable EV baseline written when a campaign goes active; versioned on re-lock. */
export const offerEvSnapshots = sqliteTable("offer_ev_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  offerId: integer("offer_id").notNull(),
  version: integer("version").notNull().default(1),
  lockedAt: integer("locked_at").notNull(),
  expectedProfit: real("expected_profit").notNull(),
  basis: text("basis").notNull(), // "live" | "estimated" | "heuristic"
  inputsJson: text("inputs_json"), // { autoLocked, retentionUsed?, freeBetAmount?, stake? }
  // Settlement fill-in — null until settled:
  realizedProfit: real("realized_profit"),
  capturePct: real("capture_pct"),
  commissionDrag: real("commission_drag"),
  settledAt: integer("settled_at"),
  /** B7 mistake ledger: laid_late | wrong_market | odds_moved | bookie_voided | other */
  mistakeTag: text("mistake_tag"),
});

/** Recurring offer template - instances are materialised as separate offer rows */
export const offerSeries = sqliteTable("offer_series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recurrenceEnabled: integer("recurrence_enabled").notNull().default(1),
  /** No new instances on/after this date (YYYY-MM-DD) when recurrence stopped */
  recurrenceStoppedFrom: text("recurrence_stopped_from"),
  ruleJson: text("rule_json").notNull(),
  /** Reference expiry used to derive each instance deadline (time-of-day) */
  templateExpiresAt: integer("template_expires_at"),
  horizonDays: integer("horizon_days").notNull().default(14),
  bookmaker: text("bookmaker"),
  title: text("title").notNull(),
  description: text("description"),
  expectedProfit: real("expected_profit"),
  sport: text("sport"),
  offerType: text("offer_type"),
  scopeCourse: text("scope_course"),
  scopeRaceId: text("scope_race_id"),
  scopeRaceLabel: text("scope_race_label"),
  rules: text("rules"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Web-push subscriptions (F3) - one row per device/browser */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  /** Coarse device label from the subscribing user agent */
  label: text("label"),
  createdAt: integer("created_at").notNull(),
  lastOkAt: integer("last_ok_at"),
});

/** Persistent alert history (F2) - toasts/notifications deliver, this is the record */
export const alertsInbox = sqliteTable("alerts_inbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

/** Bookie, exchange, or bank wallet for bankroll tracking */
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["bookie", "exchange", "bank"] }).notNull(),
  exchangeId: integer("exchange_id"),
  /** Bookie/exchange: which bank usually funds this wallet */
  fundedByAccountId: integer("funded_by_account_id"),
  brandColor: text("brand_color"),
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
  wrRemaining: real("wr_remaining").notNull().default(0),
  /** Min decimal odds for a bet to count toward WR */
  wrMinOdds: real("wr_min_odds"),
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
export const balanceTransactions = sqliteTable("balance_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  amount: real("amount").notNull(),
  category: text("category", {
    enum: [
      "top_up",
      "withdrawal",
      "adjustment",
      "bet_stake",
      "bet_settlement",
      "free_bet",
      "transfer",
      "fee",
    ],
  }).notNull(),
  betId: integer("bet_id"),
  /** Links paired transfer legs (and optional fee) */
  transferGroupId: text("transfer_group_id"),
  /** 1 = awaiting statement confirmation (Ultimatcher pending bank credit) */
  pending: integer("pending").notNull().default(0),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
  confirmedAt: integer("confirmed_at"),
  /** 1 = this adjustment should be included in the P&L chart and settledProfit total */
  affectPnl: integer("affect_pnl").notNull().default(0),
});

/**
 * Live commentary feed: kick-offs, goals, 2UP triggers, full times and bet
 * settlements, written idempotently by the state service (dedupe key = natural id).
 */
export const history = sqliteTable("history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dedupe: text("dedupe").notNull().unique(),
  kind: text("kind", {
    enum: ["kickoff", "goal", "two_up", "full_time", "settlement", "free_bet_promo", "bet_placed", "balance_adjustment"],
  }).notNull(),
  eventId: integer("event_id"),
  betId: integer("bet_id"),
  minute: integer("minute"),
  title: text("title").notNull(),
  detail: text("detail"),
  /** Settlements only: realised profit (+) or loss (−) */
  amount: real("amount"),
  createdAt: integer("created_at").notNull(),
});

/** Key-value app preferences (defaults, reminders, OCR behaviour). */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** SP snapshots polled from racecards - steamer/drifter on Racing Desk */
export const racingOddsSnapshots = sqliteTable("racing_odds_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  raceId: text("race_id").notNull(),
  horseId: text("horse_id").notNull(),
  horse: text("horse").notNull(),
  spDecimal: real("sp_decimal").notNull(),
  /** bookie = back/SP movement; exchange = live lay movement */
  kind: text("kind").notNull().default("bookie"),
  capturedAt: integer("captured_at").notNull(),
});

/**
 * Manual odds pasted over proxy/API prices on Racing Desk.
 * Free-tier workaround for live bookie odds without Racing API Standard.
 */
/** Casino desk (H2) - wagering offers, tracked separately from matched P&L. */
export const casinoOffers = sqliteTable("casino_offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  casino: text("casino"),
  title: text("title").notNull(),
  bonusAmount: real("bonus_amount").notNull(),
  wageringMultiplier: real("wagering_multiplier").notNull(),
  /** User-entered game RTP (0-1); null = 96% heuristic default */
  rtp: real("rtp"),
  /** Game contribution to wagering (0-1); null = 100% */
  contributionPct: real("contribution_pct"),
  status: text("status", { enum: ["planned", "active", "completed", "expired"] })
    .notNull()
    .default("planned"),
  /** EV locked at save time from the calc inputs */
  expectedEv: real("expected_ev").notNull(),
  /** Realised £ entered by the user at completion */
  actualProfit: real("actual_profit"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

export const racingOddsOverrides = sqliteTable("racing_odds_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  raceId: text("race_id").notNull(),
  horseId: text("horse_id").notNull(),
  bookieDecimal: real("bookie_decimal"),
  exchangeDecimal: real("exchange_decimal"),
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
export type BalanceTransactionRow = typeof balanceTransactions.$inferSelect;
export type NewBalanceTransactionRow = typeof balanceTransactions.$inferInsert;
export type OfferRow = typeof offers.$inferSelect;
export type NewOfferRow = typeof offers.$inferInsert;
export type RacingOddsOverrideRow = typeof racingOddsOverrides.$inferSelect;
export type CasinoOfferRow = typeof casinoOffers.$inferSelect;
export type NewCasinoOfferRow = typeof casinoOffers.$inferInsert;
