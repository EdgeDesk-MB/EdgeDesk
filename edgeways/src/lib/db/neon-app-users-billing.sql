-- EDGE-5: billing columns on hosted app_users. Safe to re-run.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'none';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS trial_ends_at bigint;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS founding integer NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS onboarding_profile text;

-- EDGE-105: server-recorded ToS/Privacy acceptance. Applied 26 Aug 2026.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS legal_accepted_at bigint;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS legal_version text;
