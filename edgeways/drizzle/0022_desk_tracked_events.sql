-- Per-desk follows of the shared events feed. Untracking removes this row
-- only; the fixture stays so live scores and other customers are untouched.
CREATE TABLE IF NOT EXISTS "desk_tracked_events" (
	"clerk_user_id" text NOT NULL,
	"event_id" integer NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "desk_tracked_events_clerk_user_id_event_id_pk" PRIMARY KEY("clerk_user_id","event_id")
);
CREATE INDEX IF NOT EXISTS "desk_tracked_events_user_idx" ON "desk_tracked_events" ("clerk_user_id");
