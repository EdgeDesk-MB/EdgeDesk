CREATE TABLE "acca_legs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"label" text NOT NULL,
	"event_id" integer,
	"sport" text,
	"market" text,
	"selection" text,
	"back_odds" double precision NOT NULL,
	"lay_odds" double precision,
	"lay_stake" double precision,
	"lay_bet_id" integer,
	"result" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" integer
);
--> statement-breakpoint
CREATE TABLE "acca_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer,
	"label" text NOT NULL,
	"method" text NOT NULL,
	"stake" double precision NOT NULL,
	"bookmaker" text,
	"commission" double precision DEFAULT 0 NOT NULL,
	"refund_amount" double precision,
	"back_bet_id" integer,
	"whole_lay_bet_id" integer,
	"whole_lay_stake" double precision,
	"whole_lay_odds" double precision,
	"boost_pct" double precision,
	"no_lay" integer DEFAULT 0 NOT NULL,
	"mute_alerts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"settled_at" integer
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"exchange_id" integer,
	"funded_by_account_id" integer,
	"brand_color" text,
	"owner" text DEFAULT 'me' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"access_status" text DEFAULT 'available' NOT NULL,
	"notes" text,
	"wr_remaining" double precision DEFAULT 0 NOT NULL,
	"wr_min_odds" double precision,
	"wr_type" text DEFAULT 'stake' NOT NULL,
	"health" text,
	"health_updated_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts_inbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"read_at" integer,
	CONSTRAINT "alerts_inbox_dedupe_unique" UNIQUE("dedupe")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"amount" double precision NOT NULL,
	"category" text NOT NULL,
	"bet_id" integer,
	"casino_offer_id" integer,
	"transfer_group_id" text,
	"pending" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" integer NOT NULL,
	"confirmed_at" integer,
	"affect_pnl" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_builder_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer,
	"label" text NOT NULL,
	"method" text NOT NULL,
	"stake" double precision NOT NULL,
	"bookmaker" text,
	"commission" double precision DEFAULT 0 NOT NULL,
	"back_odds" double precision NOT NULL,
	"back_bet_id" integer,
	"whole_lay_bet_id" integer,
	"whole_lay_stake" double precision,
	"whole_lay_odds" double precision,
	"event_label" text,
	"event_id" integer,
	"sport" text,
	"scheduled_at" integer,
	"mute_alerts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"settled_at" integer
);
--> statement-breakpoint
CREATE TABLE "bet_builder_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"label" text NOT NULL,
	"market" text,
	"selection" text,
	"result" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer,
	"label" text NOT NULL,
	"market" text DEFAULT 'match_odds' NOT NULL,
	"selection" text DEFAULT '' NOT NULL,
	"bet_type" text DEFAULT 'qualifying' NOT NULL,
	"bookmaker" text,
	"exchange_id" integer,
	"back_stake" double precision DEFAULT 0 NOT NULL,
	"back_odds" double precision DEFAULT 0 NOT NULL,
	"lay_stake" double precision DEFAULT 0 NOT NULL,
	"lay_odds" double precision DEFAULT 0 NOT NULL,
	"commission" double precision DEFAULT 0.02 NOT NULL,
	"early_payout" integer DEFAULT 0 NOT NULL,
	"refund_amount" double precision,
	"refund_retention" double precision,
	"legs" text,
	"trigger_text" text,
	"trigger_rule" text,
	"status" text DEFAULT 'open' NOT NULL,
	"expected_profit" double precision,
	"actual_profit" double precision,
	"notes" text,
	"balance_ledgered" integer DEFAULT 0 NOT NULL,
	"balance_settled" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"settled_at" integer,
	"offer_id" integer,
	"quick_logged" integer,
	"source" text,
	"purpose" text,
	"sport" text
);
--> statement-breakpoint
CREATE TABLE "boost_diary" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"bookmaker" text,
	"kind" text NOT NULL,
	"boosted_odds" double precision NOT NULL,
	"fair_odds" double precision NOT NULL,
	"stake" double precision NOT NULL,
	"ev_gbp" double precision NOT NULL,
	"basis" text DEFAULT 'estimated' NOT NULL,
	"bet_id" integer,
	"lay_stake" double precision,
	"lay_odds" double precision,
	"commission" double precision,
	"exchange_id" integer,
	"exchange_back" double precision,
	"outcome" text,
	"actual_profit" double precision,
	"created_at" integer NOT NULL,
	"settled_at" integer
);
--> statement-breakpoint
CREATE TABLE "casino_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"rtp" double precision NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "casino_games_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "casino_offer_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino_offer_id" integer NOT NULL,
	"component_type" text NOT NULL,
	"amount" double precision,
	"wagering_multiplier" double precision,
	"rtp" double precision,
	"contribution_pct" double precision,
	"spins" double precision,
	"spin_value" double precision,
	"chip_count" double precision,
	"chip_value" double precision,
	"house_edge_preset" text,
	"cashback_pct" double precision,
	"cashback_cap" double precision,
	"game" text,
	"expected_ev" double precision NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_offer_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"recurrence_enabled" integer DEFAULT 1 NOT NULL,
	"recurrence_stopped_from" text,
	"skipped_dates_json" text,
	"rule_json" text NOT NULL,
	"template_expires_at" integer,
	"horizon_days" integer DEFAULT 14 NOT NULL,
	"casino" text,
	"title" text NOT NULL,
	"notes" text,
	"offer_url" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_offer_series_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"series_id" integer NOT NULL,
	"component_type" text NOT NULL,
	"amount" double precision,
	"wagering_multiplier" double precision,
	"rtp" double precision,
	"contribution_pct" double precision,
	"spins" double precision,
	"spin_value" double precision,
	"chip_count" double precision,
	"chip_value" double precision,
	"house_edge_preset" text,
	"cashback_pct" double precision,
	"cashback_cap" double precision,
	"game" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casino_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"casino" text,
	"title" text NOT NULL,
	"bonus_amount" double precision NOT NULL,
	"wagering_multiplier" double precision NOT NULL,
	"rtp" double precision,
	"contribution_pct" double precision,
	"status" text DEFAULT 'planned' NOT NULL,
	"expected_ev" double precision NOT NULL,
	"actual_profit" double precision,
	"notes" text,
	"game" text,
	"expires_at" integer,
	"series_id" integer,
	"instance_date" text,
	"offer_url" text,
	"created_at" integer NOT NULL,
	"completed_at" integer
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport" text DEFAULT 'football' NOT NULL,
	"external_id" text,
	"competition" text,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"start_time" integer NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"minute" integer DEFAULT 0 NOT NULL,
	"home_led2" integer DEFAULT 0 NOT NULL,
	"away_led2" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"goals" text,
	"ft_home_score" integer,
	"ft_away_score" integer,
	"match_ending" text,
	"sim_script" text,
	"sim_started_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchanges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"commission_pct" double precision DEFAULT 0 NOT NULL,
	"brand_color" text DEFAULT '#3f3f46' NOT NULL,
	"back_color" text DEFAULT '#a6d8ff' NOT NULL,
	"lay_color" text DEFAULT '#fac9d1' NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"details" text NOT NULL,
	"reply_email" text,
	"diagnostics_json" text NOT NULL,
	"created_at" integer NOT NULL,
	"linear_issue_id" text
);
--> statement-breakpoint
CREATE TABLE "history" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe" text NOT NULL,
	"kind" text NOT NULL,
	"event_id" integer,
	"bet_id" integer,
	"minute" integer,
	"title" text NOT NULL,
	"detail" text,
	"note" text,
	"amount" double precision,
	"created_at" integer NOT NULL,
	CONSTRAINT "history_dedupe_unique" UNIQUE("dedupe")
);
--> statement-breakpoint
CREATE TABLE "mug_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"cadence_days" integer NOT NULL,
	"monthly_budget" double precision,
	"last_mug_at" integer,
	"notes" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_effort_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"action_kind" text NOT NULL,
	"started_at" integer NOT NULL,
	"ended_at" integer NOT NULL,
	"duration_min" double precision NOT NULL,
	"edited" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_ev_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"locked_at" integer NOT NULL,
	"expected_profit" double precision NOT NULL,
	"basis" text NOT NULL,
	"inputs_json" text,
	"realized_profit" double precision,
	"capture_pct" double precision,
	"commission_drag" double precision,
	"settled_at" integer,
	"mistake_tag" text
);
--> statement-breakpoint
CREATE TABLE "offer_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"recurrence_enabled" integer DEFAULT 1 NOT NULL,
	"recurrence_stopped_from" text,
	"skipped_dates_json" text,
	"rule_json" text NOT NULL,
	"template_expires_at" integer,
	"horizon_days" integer DEFAULT 14 NOT NULL,
	"bookmaker" text,
	"title" text NOT NULL,
	"description" text,
	"expected_profit" double precision,
	"sport" text,
	"offer_type" text,
	"scope_course" text,
	"scope_race_id" text,
	"scope_race_label" text,
	"rules" text,
	"offer_url" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookmaker" text,
	"title" text NOT NULL,
	"description" text,
	"expected_profit" double precision,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" integer,
	"created_at" integer NOT NULL,
	"completed_at" integer,
	"starts_on" text,
	"sport" text,
	"offer_type" text,
	"scope_course" text,
	"event_date" text,
	"scope_race_id" text,
	"scope_race_label" text,
	"rules" text,
	"series_id" integer,
	"instance_date" text,
	"source" text,
	"offer_url" text
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"label" text,
	"created_at" integer NOT NULL,
	"last_ok_at" integer,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "racing_odds_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_id" text NOT NULL,
	"horse_id" text NOT NULL,
	"bookie_decimal" double precision,
	"exchange_decimal" double precision,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "racing_odds_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_id" text NOT NULL,
	"horse_id" text NOT NULL,
	"horse" text NOT NULL,
	"sp_decimal" double precision NOT NULL,
	"kind" text DEFAULT 'bookie' NOT NULL,
	"captured_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_legs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"label" text NOT NULL,
	"event_id" integer,
	"sport" text,
	"market" text,
	"selection" text,
	"odds_decimal" double precision NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" integer
);
--> statement-breakpoint
CREATE TABLE "system_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer,
	"label" text NOT NULL,
	"structure" text NOT NULL,
	"unit_stake" double precision NOT NULL,
	"lines" integer NOT NULL,
	"total_stake" double precision NOT NULL,
	"each_way" integer DEFAULT 0 NOT NULL,
	"place_fraction" double precision,
	"bookmaker" text,
	"classification" text DEFAULT 'ev_play' NOT NULL,
	"back_bet_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"settled_at" integer
);
--> statement-breakpoint
CREATE TABLE "user_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"note" text NOT NULL,
	"remind_at" integer NOT NULL,
	"casino_offer_id" integer,
	"offer_id" integer,
	"context_title" text,
	"context_venue" text,
	"created_at" integer NOT NULL,
	"fired_at" integer,
	"cancelled_at" integer
);
