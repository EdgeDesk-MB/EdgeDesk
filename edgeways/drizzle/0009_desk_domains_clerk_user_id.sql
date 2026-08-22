ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "balance_transactions" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "history" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_clerk_user_id_idx" ON "offers" ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_clerk_user_id_idx" ON "accounts" ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "balance_transactions_clerk_user_id_idx" ON "balance_transactions" ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_clerk_user_id_idx" ON "history" ("clerk_user_id");
