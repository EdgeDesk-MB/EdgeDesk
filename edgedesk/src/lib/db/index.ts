import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

type DB = BetterSQLite3Database<typeof schema>;

let instance: DB | null = null;

/** Lazy singleton — nothing touches the SQLite file until the first query at request time. */
function getDb(): DB {
  if (instance) return instance;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(path.join(dataDir, "edgedesk.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  // Simple idempotent bootstrap — no migration tooling needed at MVP stage
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

  // Additive migrations for databases created before these columns existed
  const addColumn = (table: string, ddl: string) => {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch {
      // column already exists
    }
  };
  addColumn("events", "goals TEXT");
  addColumn("bets", "trigger_text TEXT");
  addColumn("bets", "trigger_rule TEXT");
  addColumn("bets", "exchange_id INTEGER");
  addColumn("bets", "balance_ledgered INTEGER NOT NULL DEFAULT 0");
  addColumn("bets", "balance_settled INTEGER NOT NULL DEFAULT 0");
  addColumn("bets", "offer_id INTEGER");
  addColumn("offers", "sport TEXT");
  addColumn("offers", "offer_type TEXT");
  addColumn("offers", "scope_course TEXT");
  addColumn("offers", "event_date TEXT");
  addColumn("offers", "rules TEXT");

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

  // Legacy promo rows — settlement title already carries free-bet info
  sqlite.exec(`DELETE FROM history WHERE kind = 'free_bet_promo'`);

  // Reclassify promo / manual free-bet credits that were stored as cash top-ups
  sqlite.exec(`
UPDATE balance_transactions
SET category = 'free_bet'
WHERE category = 'top_up'
  AND note LIKE '%Free bet%';
`);

  sqlite.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  exchange_id INTEGER,
  brand_color TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS balance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  bet_id INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS racing_odds_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  horse TEXT NOT NULL,
  sp_decimal REAL NOT NULL,
  captured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_racing_odds_race_horse ON racing_odds_snapshots(race_id, horse_id, captured_at);
`);

  // Seed the well-known exchanges on first run so the pickers aren't empty
  const count = sqlite.prepare("SELECT COUNT(*) AS n FROM exchanges").get() as { n: number };
  if (count.n === 0) {
    const insert = sqlite.prepare(
      `INSERT INTO exchanges (name, commission_pct, brand_color, back_color, lay_color, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const now = Date.now();
    insert.run("Betfair", 5, "#ffb80c", "#a6d8ff", "#fac9d1", 0, now);
    insert.run("Betdaq", 2, "#7b2d8b", "#fce38f", "#b5e5c4", 1, now);
    insert.run("Smarkets", 2, "#0f1b2b", "#bfe8d4", "#c7dcf5", 0, now);
    insert.run("Matchbook", 4, "#16344f", "#b8dff5", "#f7bac2", 0, now);
  }

  instance = drizzle(sqlite, { schema });
  return instance;
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export * from "./schema";
