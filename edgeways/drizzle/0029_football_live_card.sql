-- Football live card (P1): half-time score, confirmed XI, tape fetch clock.
-- Global feed columns on events (no clerk scoping).
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ht_home_score" integer;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ht_away_score" integer;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "lineups" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "tape_fetched_at" bigint;
