/**
 * Which inbox /api/alerts should read. The public demo is a canned desk;
 * hosted Neon desks have a real per-user inbox (EDGE-110).
 */
export type AlertsInboxMode = "demo" | "hosted" | "desk";

export function resolveAlertsInboxMode(input: {
  publicDemo: boolean;
  neonDesk: boolean;
}): AlertsInboxMode {
  if (input.publicDemo) return "demo";
  if (input.neonDesk) return "hosted";
  return "desk";
}
