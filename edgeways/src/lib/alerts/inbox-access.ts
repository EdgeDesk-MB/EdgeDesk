/**
 * Which inbox /api/alerts should read. The public demo is a canned desk;
 * the hosted Neon stand-in is a shared in-memory SQLite file and must never
 * be treated as a per-login record.
 */
export type AlertsInboxMode = "demo" | "hosted_empty" | "desk";

export function resolveAlertsInboxMode(input: {
  publicDemo: boolean;
  neonDesk: boolean;
}): AlertsInboxMode {
  if (input.publicDemo) return "demo";
  if (input.neonDesk) return "hosted_empty";
  return "desk";
}
