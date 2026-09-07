-- Current-season football competitions (API-Football /leagues). Global feed
-- data, no clerk scoping: Fixtures reads this so users can star competitions
-- that have no matches today.
CREATE TABLE IF NOT EXISTS "football_competition_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
