import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/lib/marketing/share-metadata";

/** Crawlers must get a real robots.txt. Waitlist used to send this path home. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
    host: PUBLIC_SITE_ORIGIN,
  };
}
