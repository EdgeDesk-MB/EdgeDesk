-- Feed monitor: one durable daily counter per feed (football keeps its hard
-- cap; racing is counted for trend monitoring). Existing rows are football.
ALTER TABLE "feed_budget" ADD COLUMN IF NOT EXISTS "feed" text NOT NULL DEFAULT 'football';
ALTER TABLE "feed_budget" DROP CONSTRAINT IF EXISTS "feed_budget_pkey";
ALTER TABLE "feed_budget" ADD PRIMARY KEY ("feed", "day");
