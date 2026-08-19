/** Client helper for Stripe Customer Portal (EDGE-4 / EDGE-58). */

export async function requestBillingPortal(): Promise<string> {
  const response = await fetch("/api/billing/portal", { method: "POST" });
  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Could not open billing.");
  }
  return data.url;
}
