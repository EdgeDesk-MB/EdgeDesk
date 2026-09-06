import { APP_VERSION } from "@/lib/app-version";

/**
 * Identity of the JS this process is serving. Changes on every Vercel
 * deploy. Local stays on the display version so HMR does not nag.
 */
export function getAppBuildStamp(env: NodeJS.ProcessEnv = process.env): string {
  const deploy = env.VERCEL_DEPLOYMENT_ID?.trim();
  if (deploy) return deploy;
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) return sha;
  return `version:${APP_VERSION}`;
}
