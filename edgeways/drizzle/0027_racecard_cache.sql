-- Durable racecards payload per UK calendar date. Global feed data (no clerk
-- scoping): the hosted desk reads this first so cold serverless instances
-- never stampede the upstream racing feed.
CREATE TABLE IF NOT EXISTS "racecard_cache" (
	"date" text PRIMARY KEY NOT NULL,
	"odds_tier" text NOT NULL,
	"payload" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
