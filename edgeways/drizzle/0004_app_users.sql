CREATE TABLE IF NOT EXISTS "app_users" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
