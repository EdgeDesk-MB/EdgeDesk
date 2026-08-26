import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/lib/marketing/share-metadata";

/** Crawlers must get a real robots.txt. Waitlist used to send this path home. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Desk shells (the (app) group) and operator pages are private
      // (EDGE-107). The group layout also serves noindex, so a missed
      // prefix here still cannot be indexed.
      disallow: [
        "/api/",
        "/admin/",
        "/acca",
        "/accounts",
        "/alerts",
        "/balances",
        "/bet-builder",
        "/boosts",
        "/calculators",
        "/casino",
        "/desk",
        "/events",
        "/feedback",
        "/fixtures",
        "/help",
        "/history",
        "/match-checker",
        "/offers",
        "/racing",
        "/release-notes",
        "/report",
        "/roadmap",
        "/settings",
        "/support",
        "/systems",
        "/tracked-events",
        "/tracker",
      ],
    },
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
    host: PUBLIC_SITE_ORIGIN,
  };
}
