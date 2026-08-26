-- EDGE-110: hosted web push + alerts inbox on Neon.
-- Applied to the edgeways project 2026-08-26 via the Neon MCP (run_sql).
-- Documented here so a fresh environment can be brought up by hand.

-- Push subscriptions become per-desk: the endpoint stays globally unique (it
-- identifies the device), the owner column scopes fan-out and management.
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS clerk_user_id text;

-- Alert dedupe keys (result_settled:12, offer_expiring:3:2026-08-26, ...) are
-- only unique within one desk, so the global unique on dedupe must move to a
-- (clerk_user_id, dedupe) composite - the same class of fix as EDGE-99 history.
ALTER TABLE alerts_inbox ADD COLUMN IF NOT EXISTS clerk_user_id text;
ALTER TABLE alerts_inbox DROP CONSTRAINT IF EXISTS alerts_inbox_dedupe_unique;
CREATE UNIQUE INDEX IF NOT EXISTS alerts_inbox_user_dedupe_unique
  ON alerts_inbox (clerk_user_id, dedupe);
