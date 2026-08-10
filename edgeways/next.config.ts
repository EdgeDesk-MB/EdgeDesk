import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Fully hidden - the on-screen Rendering/Compiling badge is dev-only
  // chrome, not a performance signal. Errors still surface regardless.
  devIndicators: false,
  /**
   * Phones on the LAN hit the dev server by IP or Bonjour name; without
   * these, Next blocks its own /_next dev resources cross-origin and the
   * app renders dead (static null-state HTML, no hydration). If your LAN
   * IP changes, add the new one here and restart the dev server.
   */
  // Note: wildcards match ONE label only - "*.ts.net" does NOT cover
  // "sams-mac-studio.tail975520.ts.net", hence the explicit entries.
  allowedDevOrigins: [
    "192.168.50.71",
    "sams-mac-studio.local",
    "*.local",
    "sams-mac-studio.tail975520.ts.net",
    "*.tail975520.ts.net",
  ],
  // Strip Referer on navigations away from Edgeways (bookie/casino offer links).
  // Complements metadata.referrer + per-link rel="noreferrer".
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  // PostHog reverse proxy (EDGE-35): ad blockers drop direct posthog.com
  // calls, so events proxy through our own origin. EU hosts throughout.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog ingest endpoints must not be trailing-slash redirected.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
