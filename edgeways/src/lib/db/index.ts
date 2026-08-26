import "server-only";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { isNeonDesk } from "./desk-backend";
import { getDeskActor, resolveScopedDbPath } from "./desk-scope";
import { seedDemoData } from "./demo-seed";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import {
  CLASSIC_SEED_GAMES,
  BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21,
  COMMON_UK_SLOTS_2026_07_21,
  type SeedGame,
} from "@/lib/casino/game-library";

type DB = BetterSQLite3Database<typeof schema>;

type OpenDesk = { db: DB; sqlite: Database.Database };
const opened = new Map<string, OpenDesk>();

/**
 * Resolve the SQLite file path.
 * Tests: `EDGEWAYS_DB_PATH` (vitest sets a temp file).
 * Demo mode (G2): a `data/demo-mode` marker switches to `edgeways-demo.db`.
 * Otherwise the Clerk login picks the file: owner email → `edgeways.db`,
 * other signed-in users → `data/desks/{clerkUserId}.db`, unsigned →
 * `data/desks/unsigned.db`. Request scope comes from `withDeskScope`.
 */
export function resolveDbPath(): string {
  const dataDir = path.join(process.cwd(), "data");
  return resolveScopedDbPath({
    dataDir,
    actor: getDeskActor(),
    override: process.env.EDGEWAYS_DB_PATH,
    demoMarker: fs.existsSync(path.join(dataDir, "demo-mode")),
  }).dbPath;
}

/** True when this process opened the demo database (G2). */
export function isDemoMode(): boolean {
  return resolveDbPath().endsWith("edgeways-demo.db");
}

/** Marker present = NEXT server start opens the demo DB (may differ from current). */
export function demoMarkerPresent(): boolean {
  if (process.env.EDGEWAYS_DB_PATH?.trim()) return false;
  return fs.existsSync(path.join(process.cwd(), "data", "demo-mode"));
}

export function setDemoMarker(enabled: boolean): void {
  const marker = path.join(process.cwd(), "data", "demo-mode");
  if (enabled) {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, `enabled ${new Date().toISOString()}\n`);
  } else {
    fs.rmSync(marker, { force: true });
  }
}

/**
 * One-time adoption of a pre-rename database file (the app was called
 * EdgeDesk before 2026-08). Renames `edgedesk*.db` (+ WAL sidecars) to the
 * new name so old checkouts and restored backups keep their history.
 */
function adoptLegacyDbFile(dbPath: string): void {
  if (fs.existsSync(dbPath)) return;
  const legacy = path.join(
    path.dirname(dbPath),
    path.basename(dbPath).replace(/^edgeways/, "edgedesk")
  );
  if (legacy === dbPath || !fs.existsSync(legacy)) return;
  for (const ext of ["", "-wal", "-shm"]) {
    if (fs.existsSync(legacy + ext)) fs.renameSync(legacy + ext, dbPath + ext);
  }
}

/** One connection per SQLite file. Owner and test logins stay isolated. */
function getDb(): DB {
  // Hosted (Neon) desk: the deployment filesystem is read-only, so opening
  // the file would ENOENT on mkdir - and any module that touches `db` at
  // import time (e.g. top-level prepare) takes the whole route down with it.
  // Dual-pathed routes never query SQLite, so a throwaway in-memory handle
  // keeps those imports harmless until they are cut over.
  const dbPath = isNeonDesk() ? ":memory:" : resolveDbPath();
  const hit = opened.get(dbPath);
  if (hit) return hit.db;

  if (dbPath !== ":memory:") {
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    adoptLegacyDbFile(dbPath);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  // Simple idempotent bootstrap - no migration tooling needed at MVP stage
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sport TEXT NOT NULL DEFAULT 'football',
  external_id TEXT,
  competition TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  minute INTEGER NOT NULL DEFAULT 0,
  home_led2 INTEGER NOT NULL DEFAULT 0,
  away_led2 INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  goals TEXT,
  sim_script TEXT,
  sim_started_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER,
  label TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'match_odds',
  selection TEXT NOT NULL DEFAULT '',
  bet_type TEXT NOT NULL DEFAULT 'qualifying',
  bookmaker TEXT,
  back_stake REAL NOT NULL DEFAULT 0,
  back_odds REAL NOT NULL DEFAULT 0,
  lay_stake REAL NOT NULL DEFAULT 0,
  lay_odds REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0.02,
  early_payout INTEGER NOT NULL DEFAULT 0,
  refund_amount REAL,
  refund_retention REAL,
  legs TEXT,
  trigger_text TEXT,
  trigger_rule TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  expected_profit REAL,
  actual_profit REAL,
  notes TEXT,
  source TEXT,
  created_at INTEGER NOT NULL,
  settled_at INTEGER
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  event_id INTEGER,
  bet_id INTEGER,
  minute INTEGER,
  title TEXT NOT NULL,
  detail TEXT,
  amount REAL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  commission_pct REAL NOT NULL DEFAULT 0,
  brand_color TEXT NOT NULL DEFAULT '#3f3f46',
  back_color TEXT NOT NULL DEFAULT '#a6d8ff',
  lay_color TEXT NOT NULL DEFAULT '#fac9d1',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`);

  sqlite.exec(`
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmaker TEXT,
  title TEXT NOT NULL,
  description TEXT,
  expected_profit REAL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
`);

      sqlite.exec(`
    CREATE TABLE IF NOT EXISTS acca_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER,
      label TEXT NOT NULL,
      method TEXT NOT NULL,
      stake REAL NOT NULL,
      bookmaker TEXT,
      commission REAL NOT NULL DEFAULT 0,
      refund_amount REAL,
      back_bet_id INTEGER,
      whole_lay_bet_id INTEGER,
      whole_lay_stake REAL,
      whole_lay_odds REAL,
      boost_pct REAL,
      mute_alerts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      settled_at INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS acca_legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      label TEXT NOT NULL,
      event_id INTEGER,
      market TEXT,
      selection TEXT,
      back_odds REAL NOT NULL,
      lay_odds REAL,
      lay_stake REAL,
      lay_bet_id INTEGER,
      result TEXT NOT NULL DEFAULT 'pending',
      scheduled_at INTEGER
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bet_builder_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER,
      label TEXT NOT NULL,
      method TEXT NOT NULL,
      stake REAL NOT NULL,
      bookmaker TEXT,
      commission REAL NOT NULL DEFAULT 0,
      back_odds REAL NOT NULL,
      back_bet_id INTEGER,
      whole_lay_bet_id INTEGER,
      whole_lay_stake REAL,
      whole_lay_odds REAL,
      event_label TEXT,
      scheduled_at INTEGER,
      mute_alerts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      settled_at INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bet_builder_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      label TEXT NOT NULL,
      market TEXT,
      selection TEXT,
      result TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS system_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER,
      label TEXT NOT NULL,
      structure TEXT NOT NULL,
      unit_stake REAL NOT NULL,
      lines INTEGER NOT NULL,
      total_stake REAL NOT NULL,
      each_way INTEGER NOT NULL DEFAULT 0,
      place_fraction REAL,
      bookmaker TEXT,
      classification TEXT NOT NULL DEFAULT 'ev_play',
      back_bet_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      settled_at INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS system_legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      label TEXT NOT NULL,
      market TEXT,
      selection TEXT,
      odds_decimal REAL NOT NULL,
      result TEXT NOT NULL DEFAULT 'pending'
    )
  `);

sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mug_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      cadence_days INTEGER NOT NULL,
      monthly_budget REAL,
      last_mug_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL
    )
  `);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  exchange_id INTEGER,
  funded_by_account_id INTEGER,
  brand_color TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  access_status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  wr_remaining REAL NOT NULL DEFAULT 0,
  wr_min_odds REAL,
  wr_type TEXT NOT NULL DEFAULT 'stake',
  health TEXT,
  health_updated_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS balance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  bet_id INTEGER,
  transfer_group_id TEXT,
  pending INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER
);
CREATE TABLE IF NOT EXISTS alerts_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE TABLE IF NOT EXISTS user_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note TEXT NOT NULL,
  remind_at INTEGER NOT NULL,
  casino_offer_id INTEGER,
  offer_id INTEGER,
  context_title TEXT,
  context_venue TEXT,
  created_at INTEGER NOT NULL,
  fired_at INTEGER,
  cancelled_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_user_reminders_due
  ON user_reminders(remind_at) WHERE fired_at IS NULL AND cancelled_at IS NULL;
CREATE TABLE IF NOT EXISTS feedback_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  reply_email TEXT,
  diagnostics_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  linear_issue_id TEXT
);
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  confirm_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  confirm_sent_at INTEGER,
  unsubscribed_at INTEGER
);
CREATE TABLE IF NOT EXISTS app_users (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  billing_status TEXT NOT NULL DEFAULT 'none',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at INTEGER,
  founding INTEGER NOT NULL DEFAULT 0,
  onboarding_profile TEXT,
  role TEXT NOT NULL DEFAULT 'user'
);
CREATE TABLE IF NOT EXISTS operator_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS racing_odds_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  horse TEXT NOT NULL,
  sp_decimal REAL NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bookie',
  captured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_racing_odds_race_horse ON racing_odds_snapshots(race_id, horse_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_racing_odds_race_horse_kind ON racing_odds_snapshots(race_id, horse_id, kind, captured_at);
CREATE TABLE IF NOT EXISTS racing_odds_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  bookie_decimal REAL,
  exchange_decimal REAL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_racing_odds_override_race_horse
  ON racing_odds_overrides(race_id, horse_id);
CREATE TABLE IF NOT EXISTS casino_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  casino TEXT,
  title TEXT NOT NULL,
  bonus_amount REAL NOT NULL,
  wagering_multiplier REAL NOT NULL,
  rtp REAL,
  contribution_pct REAL,
  status TEXT NOT NULL DEFAULT 'planned',
  expected_ev REAL NOT NULL,
  actual_profit REAL,
  notes TEXT,
  game TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS casino_offer_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  casino_offer_id INTEGER NOT NULL,
  component_type TEXT NOT NULL,
  amount REAL,
  wagering_multiplier REAL,
  rtp REAL,
  contribution_pct REAL,
  spins REAL,
  spin_value REAL,
  chip_count REAL,
  chip_value REAL,
  house_edge_preset TEXT,
  cashback_pct REAL,
  cashback_cap REAL,
  game TEXT,
  eligible_games_json TEXT,
  expected_ev REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_casino_offer_components_offer ON casino_offer_components(casino_offer_id, sort_order);
CREATE TABLE IF NOT EXISTS boost_diary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  bookmaker TEXT,
  kind TEXT NOT NULL,
  boosted_odds REAL NOT NULL,
  fair_odds REAL NOT NULL,
  stake REAL NOT NULL,
  ev_gbp REAL NOT NULL,
  basis TEXT NOT NULL DEFAULT 'estimated',
  bet_id INTEGER,
  lay_stake REAL,
  lay_odds REAL,
  commission REAL,
  exchange_id INTEGER,
  exchange_back REAL,
  outcome TEXT,
  actual_profit REAL,
  created_at INTEGER NOT NULL,
  settled_at INTEGER
);
CREATE TABLE IF NOT EXISTS offer_effort_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL,
  action_kind TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_min REAL NOT NULL,
  edited INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS casino_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  provider TEXT,
  rtp REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  updated_at INTEGER NOT NULL
);
`);

  // Additive migrations for databases created before these columns existed
  const addColumn = (table: string, ddl: string) => {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch {
      // column already exists
    }
  };
  addColumn("bets", "quick_logged INTEGER");
  addColumn("bets", "purpose TEXT");
  // J2b: diary ↔ bet money path
  addColumn("boost_diary", "bet_id INTEGER");
  addColumn("boost_diary", "lay_stake REAL");
  addColumn("boost_diary", "lay_odds REAL");
  addColumn("boost_diary", "commission REAL");
  addColumn("boost_diary", "exchange_id INTEGER");
  addColumn("boost_diary", "exchange_back REAL");
  addColumn("offers", "source TEXT");
  addColumn("accounts", "owner TEXT NOT NULL DEFAULT 'me'");
  addColumn("events", "goals TEXT");
  addColumn("events", "ft_home_score INTEGER");
  addColumn("events", "ft_away_score INTEGER");
  addColumn("events", "match_ending TEXT");
  addColumn("events", "period TEXT");
  addColumn("bets", "trigger_text TEXT");
  addColumn("bets", "trigger_rule TEXT");
  addColumn("bets", "exchange_id INTEGER");
  addColumn("bets", "balance_ledgered INTEGER NOT NULL DEFAULT 0");
  addColumn("bets", "balance_settled INTEGER NOT NULL DEFAULT 0");
  addColumn("casino_offers", "game TEXT");
  addColumn("casino_offers", "expires_at INTEGER");
  addColumn("casino_offers", "series_id INTEGER");
  addColumn("casino_offers", "instance_date TEXT");
  addColumn("user_reminders", "context_venue TEXT");
  addColumn("system_runs", "place_fraction REAL");
  addColumn("feedback_reports", "linear_issue_id TEXT");
  addColumn("app_users", "plan TEXT NOT NULL DEFAULT 'free'");
  addColumn("app_users", "billing_status TEXT NOT NULL DEFAULT 'none'");
  addColumn("app_users", "stripe_customer_id TEXT");
  addColumn("app_users", "stripe_subscription_id TEXT");
  addColumn("app_users", "trial_ends_at INTEGER");
  addColumn("app_users", "cancel_at INTEGER");
  addColumn("app_users", "founding INTEGER NOT NULL DEFAULT 0");
  addColumn("app_users", "onboarding_profile TEXT");
  addColumn("app_users", "role TEXT NOT NULL DEFAULT 'user'");
  addColumn("app_users", "referral_code TEXT");
  addColumn("app_users", "referred_by TEXT");
  addColumn("app_users", "referral_credit_at INTEGER");
  addColumn("waitlist_signups", "unsubscribed_at INTEGER");
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS casino_offer_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurrence_enabled INTEGER NOT NULL DEFAULT 1,
  recurrence_stopped_from TEXT,
  skipped_dates_json TEXT,
  rule_json TEXT NOT NULL,
  template_expires_at INTEGER,
  horizon_days INTEGER NOT NULL DEFAULT 14,
  casino TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS casino_offer_series_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id INTEGER NOT NULL,
  component_type TEXT NOT NULL,
  amount REAL,
  wagering_multiplier REAL,
  rtp REAL,
  contribution_pct REAL,
  spins REAL,
  spin_value REAL,
  chip_count REAL,
  chip_value REAL,
  house_edge_preset TEXT,
  cashback_pct REAL,
  cashback_cap REAL,
  game TEXT,
  eligible_games_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_casino_offer_series_components_series
  ON casino_offer_series_components(series_id, sort_order);
`);
  addColumn("bets", "offer_id INTEGER");
  addColumn("bets", "source TEXT");
  addColumn("offers", "sport TEXT");
  addColumn("offers", "offer_type TEXT");
  addColumn("offers", "scope_course TEXT");
  addColumn("offers", "event_date TEXT");
  addColumn("offers", "scope_race_id TEXT");
  addColumn("offers", "scope_race_label TEXT");
  addColumn("offers", "rules TEXT");
  addColumn("offers", "series_id INTEGER");
  addColumn("offers", "instance_date TEXT");
  addColumn("offers", "starts_on TEXT");
  addColumn("offers", "offer_url TEXT");
  addColumn("casino_offers", "offer_url TEXT");
  addColumn("casino_offer_components", "eligible_games_json TEXT");
  addColumn("casino_offer_series_components", "eligible_games_json TEXT");
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS offer_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurrence_enabled INTEGER NOT NULL DEFAULT 1,
  recurrence_stopped_from TEXT,
  skipped_dates_json TEXT,
  rule_json TEXT NOT NULL,
  template_expires_at INTEGER,
  horizon_days INTEGER NOT NULL DEFAULT 14,
  bookmaker TEXT,
  title TEXT NOT NULL,
  description TEXT,
  expected_profit REAL,
  sport TEXT,
  offer_type TEXT,
  scope_course TEXT,
  scope_race_id TEXT,
  scope_race_label TEXT,
  rules TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);
  addColumn("offer_series", "skipped_dates_json TEXT");
  addColumn("offer_series", "offer_url TEXT");
  addColumn("casino_offer_series", "skipped_dates_json TEXT");
  addColumn("casino_offer_series", "offer_url TEXT");
  addColumn("accounts", "access_status TEXT NOT NULL DEFAULT 'available'");
  addColumn("accounts", "notes TEXT");
  addColumn("accounts", "funded_by_account_id INTEGER");
  addColumn("accounts", "wr_remaining REAL NOT NULL DEFAULT 0");
  addColumn("accounts", "wr_min_odds REAL");
  addColumn("accounts", "wr_type TEXT NOT NULL DEFAULT 'stake'");
  addColumn("accounts", "health TEXT");
  addColumn("accounts", "health_updated_at INTEGER");
  addColumn("balance_transactions", "transfer_group_id TEXT");
  addColumn("balance_transactions", "pending INTEGER NOT NULL DEFAULT 0");
  addColumn("balance_transactions", "confirmed_at INTEGER");
  addColumn("balance_transactions", "affect_pnl INTEGER NOT NULL DEFAULT 0");
  addColumn("balance_transactions", "casino_offer_id INTEGER");
  addColumn("balance_transactions", "expires_at INTEGER");
  addColumn("history", "note TEXT");
  // Promote early casino wallet rows (landed as generic adjustments) to the
  // dedicated category so filters and exports can tell them apart.
  sqlite.exec(`
UPDATE balance_transactions
SET category = 'casino_settlement'
WHERE casino_offer_id IS NOT NULL
  AND category = 'adjustment'
`);
  addColumn("racing_odds_snapshots", "kind TEXT NOT NULL DEFAULT 'bookie'");
  addColumn("acca_runs", "boost_pct REAL");
  addColumn("acca_runs", "no_lay INTEGER NOT NULL DEFAULT 0");
  // Desk sport / event linking + denormalised bets.sport for tracker filters
  addColumn("bets", "sport TEXT");
  addColumn("bets", "import_fingerprint TEXT");
  addColumn("bets", "import_meta TEXT");
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_bets_import_fingerprint ON bets(import_fingerprint)`
  );
  addColumn("acca_legs", "sport TEXT");
  addColumn("bet_builder_runs", "event_id INTEGER");
  addColumn("bet_builder_runs", "sport TEXT");
  addColumn("system_legs", "event_id INTEGER");
  addColumn("system_legs", "sport TEXT");
  addColumn("system_legs", "scheduled_at INTEGER");
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS offer_ev_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  locked_at INTEGER NOT NULL,
  expected_profit REAL NOT NULL,
  basis TEXT NOT NULL,
  inputs_json TEXT,
  realized_profit REAL,
  capture_pct REAL,
  commission_drag REAL,
  settled_at INTEGER,
  mistake_tag TEXT
);
CREATE INDEX IF NOT EXISTS idx_offer_ev_snapshots_offer ON offer_ev_snapshots(offer_id, version);
`);
  // Additive column for DBs created before B7 (must run after the CREATE above).
  addColumn("offer_ev_snapshots", "mistake_tag TEXT");

  // Data migrations - only after tables exist (fresh DBs / vitest temp files)
  sqlite.exec(`DELETE FROM history WHERE kind = 'free_bet_promo'`);
  sqlite.exec(`
UPDATE balance_transactions
SET category = 'free_bet'
WHERE category = 'top_up'
  AND note LIKE '%Free bet%';
`);

  // K1: every casino_offers row that predates the multi-component model has no
  // linked casino_offer_components row yet - backfill one now (see function doc).
  backfillLegacyCasinoOffers(sqlite);

  // Casino game library: dated batches, each backfilled into every existing
  // library under its own marker (see function doc for why this is a
  // one-time, marker-gated migration rather than the K1 pattern above). The
  // original "classic" set goes through this same mechanism too, not just
  // the lazy seed-if-empty route in api/casino/games - otherwise the two
  // dated batches below would un-empty a fresh install's table before that
  // route ever got a chance to run, and the classic 28 games would never
  // seed at all.
  backfillCasinoGameLibrary(sqlite, "casino_games_backfill_classic", CLASSIC_SEED_GAMES);
  backfillCasinoGameLibrary(
    sqlite,
    "casino_games_backfill_2026_07_21",
    BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21
  );
  backfillCasinoGameLibrary(
    sqlite,
    "casino_games_backfill_2026_07_21_common_uk_slots",
    COMMON_UK_SLOTS_2026_07_21
  );

  // Demo mode (G2): a fresh demo DB gets the watermarked demo dataset.
  // Atomic - a mid-seed failure rolls back rather than stranding a
  // half-seeded demo DB that would then skip reseeding.
  if (dbPath.endsWith("edgeways-demo.db")) {
    const acc = sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number };
    if (acc.n === 0) sqlite.transaction(() => seedDemoData(sqlite))();
  }

  // Seed well-known exchanges. Additive so a new preset (e.g. BetConnect)
  // lands on existing desks without wiping user rates or the default.
  const existingExchanges = sqlite
    .prepare("SELECT name FROM exchanges")
    .all() as { name: string }[];
  const haveExchange = new Set(existingExchanges.map((row) => row.name.toLowerCase()));
  const insertExchange = sqlite.prepare(
    `INSERT INTO exchanges (name, commission_pct, brand_color, back_color, lay_color, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const seededAt = Date.now();
  const emptyExchanges = existingExchanges.length === 0;
  for (const preset of EXCHANGE_PRESETS) {
    if (haveExchange.has(preset.name.toLowerCase())) continue;
    insertExchange.run(
      preset.name,
      preset.commissionPct,
      preset.brandColor,
      preset.backColor,
      preset.layColor,
      emptyExchanges && preset.name === "Betfair" ? 1 : 0,
      seededAt
    );
  }

  const instance = drizzle(sqlite, { schema });
  opened.set(dbPath, { db: instance, sqlite });
  return instance;
}

function rawForCurrent(): Database.Database {
  const dbPath = isNeonDesk() ? ":memory:" : resolveDbPath();
  getDb();
  const hit = opened.get(dbPath);
  if (!hit) throw new Error("SQLite handle missing after open.");
  return hit.sqlite;
}

/**
 * K1 migration: backfill every `casino_offers` row with no linked
 * `casino_offer_components` row into one 'bonus'-type component copying its
 * legacy `bonus_amount`/`wagering_multiplier`/`rtp`/`contribution_pct`/`game`/
 * `expected_ev` columns, so a pre-K1 offer keeps exactly its current EV and
 * reward framing under the multi-component model. Idempotent (the LEFT JOIN
 * excludes rows already migrated) - safe to call repeatedly. Returns the
 * number of rows backfilled.
 *
 * `bonus_amount > 0` is a DELIBERATE second filter, not redundant with the
 * LEFT JOIN: pre-K1 POSTs validated `bonusAmount` as `.positive()`, so every
 * genuine legacy row satisfies it. A brand-new K1 campaign created with zero
 * components (a valid "nothing logged yet" state, same as a sports offer
 * with zero bets) inserts 0 into the vestigial `bonus_amount` column - without
 * this filter, the NEXT server restart would misread that empty campaign as
 * an unmigrated legacy row and backfill a bogus zero-value bonus component
 * into it.
 */
function backfillLegacyCasinoOffers(sqlite: Database.Database): number {
  const preK1 = sqlite
    .prepare(
      `SELECT co.id, co.bonus_amount, co.wagering_multiplier, co.rtp, co.contribution_pct,
              co.game, co.expected_ev, co.created_at
       FROM casino_offers co
       LEFT JOIN casino_offer_components coc ON coc.casino_offer_id = co.id
       WHERE coc.id IS NULL AND co.bonus_amount > 0`
    )
    .all() as Array<{
    id: number;
    bonus_amount: number;
    wagering_multiplier: number;
    rtp: number | null;
    contribution_pct: number | null;
    game: string | null;
    expected_ev: number;
    created_at: number;
  }>;
  if (preK1.length === 0) return 0;

  const insertBonusComponent = sqlite.prepare(
    `INSERT INTO casino_offer_components
       (casino_offer_id, component_type, amount, wagering_multiplier, rtp, contribution_pct, game, expected_ev, sort_order, created_at)
     VALUES (?, 'bonus', ?, ?, ?, ?, ?, ?, 0, ?)`
  );
  for (const row of preK1) {
    insertBonusComponent.run(
      row.id,
      row.bonus_amount,
      row.wagering_multiplier,
      row.rtp,
      row.contribution_pct,
      row.game,
      row.expected_ev,
      row.created_at
    );
  }
  return preK1.length;
}

/**
 * Public, re-callable hook onto {@link backfillLegacyCasinoOffers} for tests
 * and for anywhere else that wants to force a re-check (e.g. after an E3
 * restore brings in older-shape rows). Production bootstrap already calls
 * the migration once via `getDb()`; this exists so tests can insert a
 * legacy-shape row through the normal `db` API and then trigger the same
 * idempotent backfill against the live connection, without reaching for the
 * module-private raw `Database` handle.
 */
export function runCasinoOfferComponentsBackfill(): number {
  return backfillLegacyCasinoOffers(rawForCurrent());
}

/**
 * One-time backfill of a dated `SEED_GAMES` batch into `casino_games`,
 * gated by its OWN `app_settings` marker. The lazy seed-on-empty-table path
 * (`api/casino/games`) only ever fires for a brand-new install, so an
 * already-populated library (every existing user, once any game exists)
 * would never pick up a batch added to `game-library.ts` after that first
 * install on its own.
 *
 * Unlike {@link backfillLegacyCasinoOffers} (which safely re-checks
 * structural state - "does this offer have a component yet" - on every
 * boot), each of these must run EXACTLY ONCE per batch: `casino_games` is a
 * curated reference list a user can deliberately delete rows from ("every
 * row editable"), and an unconditional re-run would resurrect a deletion
 * the next time the entry's name matched a seed row. `INSERT OR IGNORE`
 * also means it never touches a name that already exists (including a
 * user's own edited RTP for a pre-existing title), only adds ones that are
 * missing entirely. A SEPARATE marker per batch (rather than one marker for
 * the whole growing `SEED_GAMES`) is what lets a LATER batch still reach an
 * existing library after an EARLIER batch's migration has already run and
 * will never fire again. Returns the number of rows actually inserted (0 if
 * this batch's marker was already set).
 */
function backfillCasinoGameLibrary(
  sqlite: Database.Database,
  marker: string,
  games: SeedGame[]
): number {
  const alreadyRun = sqlite.prepare(`SELECT 1 FROM app_settings WHERE key = ?`).get(marker);
  if (alreadyRun) return 0;

  const insertGame = sqlite.prepare(
    `INSERT OR IGNORE INTO casino_games (name, provider, rtp, source, updated_at) VALUES (?, ?, ?, 'seed', ?)`
  );
  const now = Date.now();
  let inserted = 0;
  for (const g of games) {
    const result = insertGame.run(g.name, g.provider, g.rtp, now);
    if (result.changes > 0) inserted++;
  }
  sqlite.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`).run(marker, "done");
  return inserted;
}

/**
 * Public, re-callable hook onto {@link backfillCasinoGameLibrary} for tests -
 * re-runs a named batch's migration against the live connection, mirroring
 * {@link runCasinoOfferComponentsBackfill}.
 */
export function runCasinoGameLibraryBackfill(marker: string, games: SeedGame[]): number {
  return backfillCasinoGameLibrary(rawForCurrent(), marker, games);
}

/**
 * WAL-safe online snapshot of the live database (E3 backup). Never copy the
 * file directly - WAL pages would be missing.
 */
export async function backupDatabaseTo(destPath: string): Promise<void> {
  await rawForCurrent().backup(destPath);
}

/**
 * E3 restore: copy every user table from a validated backup file INTO the
 * live connection via ATTACH, inside one transaction. Never swap the DB file
 * on disk - the dev server's parallel module graphs can hold a second open
 * connection whose pager would be corrupted by a swap (SQLITE_IOERR_SHORT_READ,
 * found the hard way). ATTACH-copy goes through SQLite's own locking, so
 * every handle sees one consistent change.
 *
 * Older backups restore cleanly: the live schema is a superset (bootstrap has
 * run), missing columns keep their defaults via the common-column insert.
 */
export function restoreDatabaseFrom(srcPath: string): { tablesRestored: number } {
  const sq = rawForCurrent();
  const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

  sq.exec(`ATTACH DATABASE '${srcPath.replace(/'/g, "''")}' AS restore_src`);
  try {
    const mainTables = (
      sq
        .prepare(
          `SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
        )
        .all() as Array<{ name: string }>
    ).map((t) => t.name);
    const srcTables = new Set(
      (
        sq
          .prepare(
            `SELECT name FROM restore_src.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
          )
          .all() as Array<{ name: string }>
      ).map((t) => t.name)
    );

    let tablesRestored = 0;
    sq.exec("BEGIN IMMEDIATE");
    try {
      for (const table of mainTables) {
        // A restore is a full snapshot: clear even tables the backup predates.
        sq.exec(`DELETE FROM main.${quote(table)}`);
        if (!srcTables.has(table)) continue;

        const mainCols = new Set(
          (sq.pragma(`table_info(${quote(table)})`) as Array<{ name: string }>).map((c) => c.name)
        );
        const srcCols = (
          sq.pragma(`restore_src.table_info(${quote(table)})`) as Array<{ name: string }>
        )
          .map((c) => c.name)
          .filter((c) => mainCols.has(c));
        if (srcCols.length === 0) continue;

        const colList = srcCols.map(quote).join(", ");
        sq.exec(
          `INSERT INTO main.${quote(table)} (${colList}) SELECT ${colList} FROM restore_src.${quote(table)}`
        );
        tablesRestored++;
      }
      sq.exec("COMMIT");
    } catch (e) {
      sq.exec("ROLLBACK");
      throw e;
    }
    return { tablesRestored };
  } finally {
    sq.exec("DETACH DATABASE restore_src");
  }
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export * from "./schema";
