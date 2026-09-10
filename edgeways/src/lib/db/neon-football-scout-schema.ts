/**
 * Hosted 2UP scout caches. Drizzle files alone do not create tables on an
 * already-live Neon. Same CREATE-on-first-use posture as operator_settings.
 */
import "server-only";

import { getNeonSql } from "@/lib/db/neon";

let ready = false;

export async function ensureNeonFootballScoutTables(): Promise<void> {
  if (ready) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS football_odds_cache (
      fixture_key text PRIMARY KEY NOT NULL,
      date text NOT NULL,
      home text NOT NULL,
      away text NOT NULL,
      start_time bigint NOT NULL,
      payload text NOT NULL,
      fetched_at bigint NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_football_odds_cache_date
    ON football_odds_cache (date)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS football_standings_cache (
      scope_id text PRIMARY KEY NOT NULL,
      league_id integer,
      season integer,
      payload text NOT NULL,
      fetched_at bigint NOT NULL
    )
  `;
  ready = true;
}
