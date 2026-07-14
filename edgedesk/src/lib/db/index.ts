import "server-only";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seedDemoData } from "./demo-seed";

type DB = BetterSQLite3Database<typeof schema>;

let instance: DB | null = null;
let rawSqlite: Database.Database | null = null;

/**
 * Resolve the SQLite file path.
 * Production/dev: `data/edgedesk.db` under cwd.
 * Tests: set `EDGEDESK_DB_PATH` (vitest sets a temp file) so unit tests never
 * write into the live profit-history database.
 * Demo mode (G2): a `data/demo-mode` marker switches to `edgedesk-demo.db`.
 * The marker is only read at connection time, so toggling requires a server
 * restart - deliberate, because parallel dev module graphs holding
 * connections to DIFFERENT files would split-brain writes.
 */
export function resolveDbPath(): string {
  const override = process.env.EDGEDESK_DB_PATH?.trim();
  if (override) return path.resolve(override);
  const dataDir = path.join(process.cwd(), "data");
  if (fs.existsSync(path.join(dataDir, "demo-mode"))) {
    return path.join(dataDir, "edgedesk-demo.db");
  }
  return path.join(dataDir, "edgedesk.db");
}

/** True when this process opened the demo database (G2). */
export function isDemoMode(): boolean {
  return resolveDbPath().endsWith("edgedesk-demo.db");
}

/** Marker present = NEXT server start opens the demo DB (may differ from current). */
export function demoMarkerPresent(): boolean {
  if (process.env.EDGEDESK_DB_PATH?.trim()) return false;
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

/** Lazy singleton - nothing touches the SQLite file until the first query at request time. */
function getDb(): DB {
  if (instance) return instance;

  const dbPath = resolveDbPath();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
  addColumn("events", "goals TEXT");
  addColumn("events", "ft_home_score INTEGER");
  addColumn("events", "ft_away_score INTEGER");
  addColumn("events", "match_ending TEXT");
  addColumn("bets", "trigger_text TEXT");
  addColumn("bets", "trigger_rule TEXT");
  addColumn("bets", "exchange_id INTEGER");
  addColumn("bets", "balance_ledgered INTEGER NOT NULL DEFAULT 0");
  addColumn("bets", "balance_settled INTEGER NOT NULL DEFAULT 0");
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
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS offer_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurrence_enabled INTEGER NOT NULL DEFAULT 1,
  recurrence_stopped_from TEXT,
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
  addColumn("racing_odds_snapshots", "kind TEXT NOT NULL DEFAULT 'bookie'");
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

  // Demo mode (G2): a fresh demo DB gets the watermarked demo dataset.
  // Atomic - a mid-seed failure rolls back rather than stranding a
  // half-seeded demo DB that would then skip reseeding.
  if (dbPath.endsWith("edgedesk-demo.db")) {
    const acc = sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number };
    if (acc.n === 0) sqlite.transaction(() => seedDemoData(sqlite))();
  }

  // Seed the well-known exchanges on first run so the pickers aren't empty
  const count = sqlite.prepare("SELECT COUNT(*) AS n FROM exchanges").get() as { n: number };
  if (count.n === 0) {
    const insert = sqlite.prepare(
      `INSERT INTO exchanges (name, commission_pct, brand_color, back_color, lay_color, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const now = Date.now();
    insert.run("Betfair", 5, "#ffb80c", "#a6d8ff", "#fac9d1", 1, now);
    insert.run("Betdaq", 2, "#7b2d8b", "#fce38f", "#b5e5c4", 0, now);
    insert.run("Smarkets", 2, "#0f1b2b", "#bfe8d4", "#c7dcf5", 0, now);
    insert.run("Matchbook", 4, "#16344f", "#b8dff5", "#f7bac2", 0, now);
  }

  rawSqlite = sqlite;
  instance = drizzle(sqlite, { schema });
  return instance;
}

/**
 * WAL-safe online snapshot of the live database (E3 backup). Never copy the
 * file directly - WAL pages would be missing.
 */
export async function backupDatabaseTo(destPath: string): Promise<void> {
  getDb();
  await rawSqlite!.backup(destPath);
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
  getDb();
  const sq = rawSqlite!;
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
