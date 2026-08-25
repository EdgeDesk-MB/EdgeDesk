-- EDGE-68: platform profit import (Oddsmonkey) needs idempotent re-import on
-- the hosted desk. SQLite bets already has both columns.
ALTER TABLE "bets" ADD COLUMN IF NOT EXISTS "import_fingerprint" text;
ALTER TABLE "bets" ADD COLUMN IF NOT EXISTS "import_meta" text;
