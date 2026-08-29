-- Per-desk exchange commission. Catalog `exchanges` stay shared; 0% is a
-- real rate and must not reset to the Betfair 5% preset.
CREATE TABLE IF NOT EXISTS "desk_exchange_rates" (
	"clerk_user_id" text NOT NULL,
	"exchange_id" integer NOT NULL,
	"commission_pct" double precision NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "desk_exchange_rates_clerk_user_id_exchange_id_pk" PRIMARY KEY("clerk_user_id","exchange_id")
);
CREATE INDEX IF NOT EXISTS "desk_exchange_rates_user_idx" ON "desk_exchange_rates" ("clerk_user_id");
