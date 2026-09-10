-- League GF/GA rates for 2UP scout. Global feed, no clerk.
CREATE TABLE IF NOT EXISTS "football_standings_cache" (
	"scope_id" text PRIMARY KEY NOT NULL,
	"league_id" integer,
	"season" integer,
	"payload" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
