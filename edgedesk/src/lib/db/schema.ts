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
  /** Goal timeline: JSON array of {minute, side, player?, og?} — feeds trigger settlement */
  goals: text("goals"),
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
  /** "The bet wins IF …" — raw condition as typed by the user */
  triggerText: text("trigger_text"),
  /** Parsed TriggerRule JSON; when present the trigger engine settles this bet */
  triggerRule: text("trigger_rule"),
  status: text("status", { enum: ["open", "won", "lost", "void", "early_payout"] })
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
  /** horse_racing for racing promos; null = generic offer */
  sport: text("sport"),
  /** e.g. bet_get_free_place */
  offerType: text("offer_type"),
  /** all courses when null or 'all'; else specific course name */
  scopeCourse: text("scope_course"),
  /** YYYY-MM-DD racing day scope */
  eventDate: text("event_date"),
  /** JSON rules payload — see lib/offers/racing-offer-rules */
  rules: text("rules"),
});

/** Bookie or exchange wallet for bankroll tracking */
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["bookie", "exchange"] }).notNull(),
  exchangeId: integer("exchange_id"),
  brandColor: text("brand_color"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

/** Ledger of top-ups, withdrawals, bet stakes and settlement payouts */
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
    ],
  }).notNull(),
  betId: integer("bet_id"),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});

/**
 * Live commentary feed: kick-offs, goals, 2UP triggers, full times and bet
 * settlements, written idempotently by the state service (dedupe key = natural id).
 */
export const history = sqliteTable("history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dedupe: text("dedupe").notNull().unique(),
  kind: text("kind", {
    enum: ["kickoff", "goal", "two_up", "full_time", "settlement", "free_bet_promo", "bet_placed"],
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

/** SP snapshots polled from racecards — steamer/drifter on Racing Desk */
export const racingOddsSnapshots = sqliteTable("racing_odds_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  raceId: text("race_id").notNull(),
  horseId: text("horse_id").notNull(),
  horse: text("horse").notNull(),
  spDecimal: real("sp_decimal").notNull(),
  capturedAt: integer("captured_at").notNull(),
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
export type BalanceTransactionRow = typeof balanceTransactions.$inferSelect;
export type NewBalanceTransactionRow = typeof balanceTransactions.$inferInsert;
export type OfferRow = typeof offers.$inferSelect;
export type NewOfferRow = typeof offers.$inferInsert;
