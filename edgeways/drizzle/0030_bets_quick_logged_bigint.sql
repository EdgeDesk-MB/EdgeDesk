-- Quick-log stamps Date.now() (epoch ms). int4 overflows at ~2.1bn, so the
-- split-button tick 500s on Neon. Same widening as created_at / settled_at
-- in 0010_happy_khan — this column was missed.
ALTER TABLE "bets" ALTER COLUMN "quick_logged" SET DATA TYPE bigint;
