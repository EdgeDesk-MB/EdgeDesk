-- Per-desk Racing Desk pasted odds. Without clerk scope a hosted write
-- would either vanish into :memory: or leak prices across customers.
ALTER TABLE "racing_odds_overrides" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "racing_odds_overrides_clerk_user_id_idx"
  ON "racing_odds_overrides" ("clerk_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "racing_odds_overrides_user_race_horse"
  ON "racing_odds_overrides" ("clerk_user_id", "race_id", "horse_id");
