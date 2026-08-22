ALTER TABLE "bets" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bets_clerk_user_id_idx" ON "bets" ("clerk_user_id");
