-- Per-desk EV lock / Edge report baselines.
ALTER TABLE "offer_ev_snapshots" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offer_ev_snapshots_clerk_user_id_idx"
  ON "offer_ev_snapshots" ("clerk_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offer_ev_snapshots_user_offer_version"
  ON "offer_ev_snapshots" ("clerk_user_id", "offer_id", "version");
