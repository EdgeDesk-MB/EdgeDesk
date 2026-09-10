-- Shared exchange 1X2 + Over 2.5 + BTTS for 2UP scout. Global feed, no clerk.
CREATE TABLE IF NOT EXISTS "football_odds_cache" (
	"fixture_key" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	"start_time" bigint NOT NULL,
	"payload" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_football_odds_cache_date" ON "football_odds_cache" ("date");
