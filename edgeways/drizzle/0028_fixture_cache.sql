-- Durable football fixtures payload per UK calendar date. Global feed data
-- (no clerk scoping): the hosted desk reads this first so cold serverless
-- instances never stampede the upstream football feed.
CREATE TABLE IF NOT EXISTS "fixture_cache" (
	"date" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
