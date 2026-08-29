-- Hosted tenancy for desks that were still SQLite-only on Neon.
-- Empty ephemeral SQLite is not a customer desk; these tables need clerk scope.
ALTER TABLE "mug_plans" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mug_plans_clerk_user_id_idx" ON "mug_plans" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "acca_runs" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "acca_runs_clerk_user_id_idx" ON "acca_runs" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "acca_legs" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "acca_legs_clerk_user_id_idx" ON "acca_legs" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "bet_builder_runs" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bet_builder_runs_clerk_user_id_idx" ON "bet_builder_runs" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "bet_builder_selections" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bet_builder_selections_clerk_user_id_idx" ON "bet_builder_selections" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "system_runs" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_runs_clerk_user_id_idx" ON "system_runs" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "system_legs" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_legs_clerk_user_id_idx" ON "system_legs" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "boost_diary" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boost_diary_clerk_user_id_idx" ON "boost_diary" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "offer_effort_samples" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offer_effort_samples_clerk_user_id_idx" ON "offer_effort_samples" ("clerk_user_id");
--> statement-breakpoint
ALTER TABLE "user_reminders" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_reminders_clerk_user_id_idx" ON "user_reminders" ("clerk_user_id");
