ALTER TABLE "waitlist_signups" ALTER COLUMN "created_at" SET DATA TYPE bigint;
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ALTER COLUMN "confirmed_at" SET DATA TYPE bigint;
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ALTER COLUMN "confirm_sent_at" SET DATA TYPE bigint;
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ALTER COLUMN "unsubscribed_at" SET DATA TYPE bigint;
