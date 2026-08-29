-- Shared operator Live log: bundled admin activity as durable rows.
CREATE TABLE IF NOT EXISTS "admin_live_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe" text NOT NULL,
	"kind" text NOT NULL,
	"tone" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text NOT NULL,
	"count" integer NOT NULL DEFAULT 1,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"read_at" bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_live_log_dedupe_unique" ON "admin_live_log" ("dedupe");
CREATE INDEX IF NOT EXISTS "admin_live_log_updated_idx" ON "admin_live_log" ("updated_at");
