import posthog from "posthog-js";

/**
 * Product analytics + error tracking (EDGE-35). Privacy posture per
 * docs/legal/privacy-policy.draft.md: cookieless (no cookies, no local
 * storage) and no autocapture — pageviews, unhandled exceptions and explicit
 * capture() calls only. Events proxy through /ingest (see next.config.ts
 * rewrites) so ad blockers don't drop them and EU data stays on EU hosts.
 * No token (fresh clone, CI) = analytics silently disabled.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
    defaults: "2026-05-30",
    cookieless_mode: "always",
    autocapture: false,
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}
