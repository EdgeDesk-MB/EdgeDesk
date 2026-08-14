ALTER TABLE "casino_offer_components" ADD COLUMN IF NOT EXISTS "eligible_games_json" text;
--> statement-breakpoint
ALTER TABLE "casino_offer_series_components" ADD COLUMN IF NOT EXISTS "eligible_games_json" text;
