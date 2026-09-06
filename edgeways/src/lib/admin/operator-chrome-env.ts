/**
 * Site chrome (banners, update prompt) is per environment.
 * Local /admin must not publish to the live desk, even when DATABASE_URL
 * points at Neon.
 */

export const OPERATOR_CHROME_ENVS = ["live", "preview", "local"] as const;
export type OperatorChromeEnv = (typeof OPERATOR_CHROME_ENVS)[number];

export const OPERATOR_CHROME_ENV_LABEL: Record<OperatorChromeEnv, string> = {
  live: "Live",
  preview: "Preview",
  local: "Local",
};

export function getOperatorChromeEnv(
  env: Record<string, string | undefined> = process.env
): OperatorChromeEnv {
  const vercel = env.VERCEL_ENV?.trim();
  if (vercel === "production") return "live";
  if (vercel === "preview") return "preview";
  return "local";
}

/** Production keeps the historic unscoped key so existing rows still apply. */
export function operatorChromeSettingKey(
  base: string,
  env: OperatorChromeEnv = getOperatorChromeEnv()
): string {
  return env === "live" ? base : `${base}:${env}`;
}

/** Neon only on Vercel production / preview. Localhost always uses SQLite. */
export function operatorChromeUsesNeon(
  env: Record<string, string | undefined> = process.env
): boolean {
  const vercel = env.VERCEL_ENV?.trim();
  return (
    (vercel === "production" || vercel === "preview") &&
    Boolean(env.DATABASE_URL?.trim())
  );
}
