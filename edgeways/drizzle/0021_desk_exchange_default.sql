-- Per-desk default exchange. Catalog is_default stays Betfair for new desks.
ALTER TABLE "desk_exchange_rates" ADD COLUMN IF NOT EXISTS "is_default" integer NOT NULL DEFAULT 0;
