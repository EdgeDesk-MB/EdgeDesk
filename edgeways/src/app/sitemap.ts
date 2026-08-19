import type { MetadataRoute } from "next";
import { LEGAL_NAV } from "@/lib/legal/public";
import { PUBLIC_SITE_ORIGIN } from "@/lib/marketing/share-metadata";

/** Public marketing URLs only. Desk routes stay off the map. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/demo", ...LEGAL_NAV.map((item) => item.href)];
  return paths.map((path) => ({
    url: path === "/" ? `${PUBLIC_SITE_ORIGIN}/` : `${PUBLIC_SITE_ORIGIN}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
