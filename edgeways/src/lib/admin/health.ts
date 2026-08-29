import "server-only";
import { smokeNeonConnection } from "@/lib/db/neon";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { stripeMode, type StripeMode } from "@/lib/billing/stripe-server";
import { getSiteSurface, type SiteSurface } from "@/lib/site-surface";
import { loadFeedStatus, type FeedStatus } from "@/lib/admin/feeds";
import { loadFeedMonitor, type FeedMonitor } from "@/lib/admin/feeds";
import { FEED_STATE_LABEL } from "@/lib/admin/feed-monitor";
import {
  SITE_BANNER_KIND_LABEL,
  type MaintenanceBanner,
} from "@/lib/admin/maintenance-banner-shared";
import { readMaintenanceBanner } from "@/lib/admin/operator-settings";

export type HealthStatus = "ok" | "warn" | "down";

export type HealthCheck = {
  key: string;
  label: string;
  status: HealthStatus;
  /** Short value, e.g. "Live" or "Connected". */
  value: string;
  /** Extra context shown muted under the value. */
  detail?: string;
};

export type HealthReport = {
  generatedAt: number;
  surface: SiteSurface;
  landingVariant: string;
  overall: HealthStatus;
  checks: HealthCheck[];
  deploy: {
    env: string;
    sha: string | null;
    url: string | null;
  };
  feeds: FeedStatus;
  feedMonitor: FeedMonitor;
  banner: MaintenanceBanner;
};

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

async function checkNeon(ping: boolean): Promise<HealthCheck> {
  if (!configured(process.env.DATABASE_URL)) {
    return {
      key: "neon",
      label: "Neon Postgres",
      status: "down",
      value: "Not configured",
      detail: "DATABASE_URL is not set.",
    };
  }
  if (!ping) {
    return {
      key: "neon",
      label: "Neon Postgres",
      status: "ok",
      value: "Configured",
      detail: isNeonDesk() ? "Hosted desk live" : "Desk still local SQLite",
    };
  }
  try {
    await smokeNeonConnection();
    return {
      key: "neon",
      label: "Neon Postgres",
      status: "ok",
      value: "Reachable",
      detail: isNeonDesk() ? "Hosted desk live" : "Desk still local SQLite",
    };
  } catch (error) {
    return {
      key: "neon",
      label: "Neon Postgres",
      status: "down",
      value: "Unreachable",
      detail: error instanceof Error ? error.message : "Connection failed.",
    };
  }
}

function checkStripe(): HealthCheck {
  const mode: StripeMode | null = stripeMode();
  if (!mode) {
    return {
      key: "stripe",
      label: "Stripe",
      status: "down",
      value: "Not configured",
      detail: "STRIPE_SECRET_KEY is not set.",
    };
  }
  return {
    key: "stripe",
    label: "Stripe",
    status: mode === "live" ? "ok" : "warn",
    value: mode === "live" ? "Live" : "Test mode",
    detail:
      mode === "live"
        ? "Real charges."
        : "sk_test key — no real money. Switch to sk_live at launch.",
  };
}

function checkClerk(): HealthCheck {
  const secret = configured(process.env.CLERK_SECRET_KEY);
  const publishable = configured(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const ok = secret && publishable;
  return {
    key: "clerk",
    label: "Clerk auth",
    status: ok ? "ok" : "down",
    value: ok ? "Configured" : "Missing keys",
    detail: ok
      ? undefined
      : "Need CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.",
  };
}

function checkPostHog(): HealthCheck {
  const token = configured(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
  const api = configured(process.env.POSTHOG_PERSONAL_API_KEY);
  const project = configured(process.env.POSTHOG_PROJECT_ID);
  if (!token) {
    return {
      key: "posthog",
      label: "PostHog",
      status: "warn",
      value: "No client token",
      detail: "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set — no analytics capture.",
    };
  }
  const flagsReady = api && project;
  return {
    key: "posthog",
    label: "PostHog",
    status: "ok",
    value: flagsReady ? "Capture + flags" : "Capture only",
    detail: flagsReady
      ? undefined
      : "Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID to toggle flags here.",
  };
}

function feedLaneCheck(
  key: string,
  label: string,
  configuredLane: boolean,
  state: "ok" | "warning" | "critical",
  used: number,
  cap: number
): HealthCheck {
  if (!configuredLane) {
    return { key, label, status: "warn", value: "Not configured", detail: "No API key." };
  }
  const status: HealthStatus =
    state === "critical" ? "down" : state === "warning" ? "warn" : "ok";
  return {
    key,
    label,
    status,
    value: FEED_STATE_LABEL[state],
    detail: `${used}/${cap} requests today`,
  };
}

function deployInfo(): HealthReport["deploy"] {
  const env =
    process.env.VERCEL_ENV?.trim() ||
    (process.env.NODE_ENV === "production" ? "production" : "development");
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const rawUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    null;
  const url = rawUrl
    ? rawUrl.startsWith("http")
      ? rawUrl
      : `https://${rawUrl}`
    : null;
  return { env, sha: sha ? sha.slice(0, 7) : null, url };
}

export async function loadHealthReport(options?: {
  pingNeon?: boolean;
}): Promise<HealthReport> {
  const pingNeon = options?.pingNeon !== false;
  const [neon, feeds, feedMonitor, banner] = await Promise.all([
    checkNeon(pingNeon),
    loadFeedStatus(),
    loadFeedMonitor(),
    readMaintenanceBanner(),
  ]);

  const surface = getSiteSurface();
  const checks: HealthCheck[] = [
    neon,
    checkStripe(),
    checkClerk(),
    checkPostHog(),
    feedLaneCheck(
      "football",
      "Football feed",
      feeds.football.configured,
      feedMonitor.football.state,
      feedMonitor.football.used,
      feedMonitor.football.cap
    ),
    feedLaneCheck(
      "racing",
      "Racing feed",
      feeds.racing.configured,
      feedMonitor.racing.state,
      feedMonitor.racing.used,
      feedMonitor.racing.cap
    ),
    {
      key: "banner",
      label: "Site banner",
      status: banner.enabled && banner.kind === "maintenance" ? "warn" : "ok",
      value: banner.enabled ? SITE_BANNER_KIND_LABEL[banner.kind] : "Off",
      detail: banner.enabled ? banner.message : undefined,
    },
  ];

  const overall: HealthStatus = checks.some((check) => check.status === "down")
    ? "down"
    : checks.some((check) => check.status === "warn")
      ? "warn"
      : "ok";

  return {
    generatedAt: Date.now(),
    surface,
    landingVariant: process.env.LANDING_VARIANT === "launch" ? "launch" : "waitlist",
    overall,
    checks,
    deploy: deployInfo(),
    feeds,
    feedMonitor,
    banner,
  };
}
