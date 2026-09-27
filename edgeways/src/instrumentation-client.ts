import posthog from "posthog-js";
import { shouldDropPosthogException } from "@/lib/analytics/exception-noise";
import { shouldCapturePosthogOnHost } from "@/lib/analytics/posthog-gate";

/**
 * Product analytics + error tracking (EDGE-35 / EDGE-49). Privacy posture:
 * cookieless, no autocapture, no session replay, no heatmaps, no console
 * capture. Pageviews, unhandled exceptions and explicit capture() only.
 * Events proxy through /ingest (see next.config.ts) so the browser talks to
 * our origin, not posthog.com. No token (fresh clone, CI) = silently off.
 * Non-production hosts skip init entirely, so no PostHog requests at all
 * (EDGE-204). opt_out_capturing() would still fetch remote config.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (
  token &&
  shouldCapturePosthogOnHost(
    window.location.hostname,
    process.env.NEXT_PUBLIC_POSTHOG_FORCE_ENABLE
  )
) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
    defaults: "2026-05-30",
    cookieless_mode: "always",
    autocapture: false,
    capture_exceptions: true,
    before_send: (event) => {
      if (shouldDropPosthogException(event)) return null;
      return event;
    },
    disable_session_recording: true,
    enable_heatmaps: false,
    disable_surveys: true,
    debug: process.env.NODE_ENV === "development",
  });
}
