CREATE TABLE IF NOT EXISTS "waitlist_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"confirm_token_hash" text NOT NULL,
	"created_at" integer NOT NULL,
	"confirmed_at" integer,
	"confirm_sent_at" integer,
	CONSTRAINT "waitlist_signups_email_unique" UNIQUE("email")
);
