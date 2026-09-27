/**
 * PostHog only records production traffic (EDGE-204). Dev and preview
 * events polluted funnels and error signals. `NEXT_PUBLIC_POSTHOG_FORCE_ENABLE=true`
 * is the escape hatch for testing analytics on any host.
 */
export const POSTHOG_PRODUCTION_HOSTS: readonly string[] = [
  "edgeways.app",
  "www.edgeways.app",
];

type GateEnv = Record<string, string | undefined>;

function isForceEnabled(env: GateEnv): boolean {
  return env.NEXT_PUBLIC_POSTHOG_FORCE_ENABLE?.trim().toLowerCase() === "true";
}

/** Browser: capture only on a production host, unless forced. */
export function shouldCapturePosthogOnHost(
  hostname: string,
  forceEnable: string | undefined
): boolean {
  if (isForceEnabled({ NEXT_PUBLIC_POSTHOG_FORCE_ENABLE: forceEnable })) {
    return true;
  }
  return POSTHOG_PRODUCTION_HOSTS.includes(hostname.trim().toLowerCase());
}

/** Server: capture only on the Vercel production deploy, unless forced. */
export function shouldCapturePosthogOnServer(env: GateEnv = process.env): boolean {
  if (isForceEnabled(env)) return true;
  return env.VERCEL_ENV?.trim() === "production";
}
