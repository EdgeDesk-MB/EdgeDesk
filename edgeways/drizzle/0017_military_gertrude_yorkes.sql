-- EDGE-99: history.dedupe was globally unique, so two users with the same
-- natural key collided and the restore adopt path could drop rows. Scope the
-- uniqueness to (clerk_user_id, dedupe). NULL clerk_user_id rows never
-- conflict (Postgres treats NULLs as distinct), which is fine — hosted
-- writes always set the owner.
ALTER TABLE "history" DROP CONSTRAINT IF EXISTS "history_dedupe_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "history_user_dedupe_unique" ON "history" USING btree ("clerk_user_id","dedupe");
