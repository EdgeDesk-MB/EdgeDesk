import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edgeways - Matched Betting Command Centre",
    short_name: "Edgeways",
    description:
      "Calculators, live events and real-time profit tracking for matched betting",
    start_url: process.env.SITE_SURFACE === "app" ? "/desk" : "/",
    display: "standalone",
    // Ink chrome — matches viewport themeColor / topbar stripe so Arc & PWAs
    // don’t tint from the yellow dark-mode header plate.
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // PWA Share Target: installed app appears in the OS share sheet; the
    // shared text lands on /share as query params for parsing into an offer.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
