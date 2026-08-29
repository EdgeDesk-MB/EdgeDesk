/**
 * N0 feature flags (docs/roadmap/implementation-briefs.md, brief N0). One id per
 * gated surface, matching the §7.5 tier matrix. Desk chrome uses `canDesk`
 * (EDGE-22). Provider routes 403 via `lockedFeedResponse` (EDGE-83). Never
 * check these inside src/lib/calc/**.
 */

export const FEATURES = [
  "calculators",
  "demo_data",
  "offers_pipeline",
  "do_next",
  "acca_desk",
  "bet_builder_desk",
  "systems_desk",
  "offer_edge",
  "racing_live_feeds",
  "push_alerts",
  "exchange_lay",
] as const;

export type FeatureFlag = (typeof FEATURES)[number];

/** Human-facing label per flag, used for lock copy and Settings display. */
export const FEATURE_LABELS: Record<FeatureFlag, string> = {
  calculators: "Calculators, bet log, wallets, and basic P&L",
  demo_data: "Demo Racing Desk / demo data",
  offers_pipeline: "Offers pipeline and free-bet lots",
  do_next: "Do Next / Daily Plan / Edge Report / EV analytics",
  acca_desk: "Acca Desk + offer to Acca qualifier routing",
  bet_builder_desk: "Bet Builder Desk",
  systems_desk: "Systems Desk",
  offer_edge: "Offer Edge model + Race picks + recommended desk chrome",
  racing_live_feeds: "Live/delayed Racing Desk feeds",
  push_alerts: "2UP sentinel + web push",
  exchange_lay: "Exchange lay integration on desk",
};
