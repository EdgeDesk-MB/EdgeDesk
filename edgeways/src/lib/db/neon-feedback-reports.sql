-- Hosted feedback inbox (not desk-scoped). Safe to re-run.
-- created_at must be bigint: Postgres integer cannot hold Date.now() ms.
CREATE TABLE IF NOT EXISTS feedback_reports (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  reply_email TEXT,
  diagnostics_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  linear_issue_id TEXT
);
ALTER TABLE feedback_reports ALTER COLUMN created_at TYPE bigint;
