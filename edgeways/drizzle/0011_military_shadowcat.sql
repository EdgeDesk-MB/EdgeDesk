CREATE TABLE "feed_budget" (
	"day" text PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"last_run_at" bigint DEFAULT 0 NOT NULL,
	"locked_until" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "period" text;