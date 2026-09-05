-- Offer inbox (email forwarding) hosted tables.
-- Apply to the edgeways Neon project via the Neon MCP (run_sql) when the
-- feature ships to the hosted desk. Documented in-tree so a fresh
-- environment can be brought up by hand, same pattern as
-- neon-alerts-push.sql.

-- One active forwarding address per desk. The token is the bearer
-- credential in offers+<token>@<inbox-domain>, so it is globally unique;
-- clerk_user_id is unique so rotation replaces rather than stacks.
CREATE TABLE IF NOT EXISTS offer_inbox_addresses (
  id serial PRIMARY KEY,
  token text NOT NULL,
  clerk_user_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS offer_inbox_addresses_token_unique
  ON offer_inbox_addresses (token);
CREATE UNIQUE INDEX IF NOT EXISTS offer_inbox_addresses_user_unique
  ON offer_inbox_addresses (clerk_user_id);

-- Inbound ledger: dedup by provider message id (nulls never conflict in
-- Postgres unique indexes) and by content fingerprint in app code.
CREATE TABLE IF NOT EXISTS offer_inbound_messages (
  id serial PRIMARY KEY,
  clerk_user_id text NOT NULL,
  message_id text,
  fingerprint text NOT NULL,
  status text NOT NULL,
  offer_id integer,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS offer_inbound_messages_user_message_unique
  ON offer_inbound_messages (clerk_user_id, message_id);
CREATE INDEX IF NOT EXISTS offer_inbound_messages_user_created_idx
  ON offer_inbound_messages (clerk_user_id, created_at);
