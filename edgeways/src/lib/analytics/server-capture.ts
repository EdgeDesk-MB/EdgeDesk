/**
 * Server-side PostHog capture via the ingestion HTTP API — no posthog-node
 * dependency. Used by webhooks (e.g. referral_credited) where no browser
 * session exists. Analytics are best-effort and never block the caller.
 * Targets the EU ingestion host directly (the browser uses the /ingest
 * proxy; NEXT_PUBLIC_POSTHOG_HOST is the app UI host, not ingestion).
 */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean | null> = {}
): void {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  if (!token || !distinctId) return;
  const host = (
    process.env.POSTHOG_INGEST_HOST ?? "https://eu.i.posthog.com"
  ).replace(/\/$/, "");
  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: token,
      event,
      distinct_id: distinctId,
      properties,
    }),
  }).catch(() => {
    /* analytics optional */
  });
}
