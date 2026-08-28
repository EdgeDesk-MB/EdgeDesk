-- Feed spend attribution: one row per provider request that claimed budget.
-- `day` matches feed_budget's UTC calendar key; null clerk_user_id = system
-- spend (poller, feed sync).
CREATE TABLE IF NOT EXISTS "feed_usage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed" text NOT NULL,
	"day" text NOT NULL,
	"at" bigint NOT NULL,
	"operation" text NOT NULL,
	"clerk_user_id" text,
	"email" text
);
CREATE INDEX IF NOT EXISTS "feed_usage_events_feed_day" ON "feed_usage_events" ("feed", "day");
