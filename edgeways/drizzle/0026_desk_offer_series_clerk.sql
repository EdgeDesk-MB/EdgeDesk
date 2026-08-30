-- Clerk scope on sports offer series. Empty on live today; no backfill.
ALTER TABLE "offer_series" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offer_series_clerk_user_id_idx"
  ON "offer_series" ("clerk_user_id");
