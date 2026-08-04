import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edgeways - Matched Betting Command Centre",
    short_name: "Edgeways",
    description:
      "Calculators, live events and real-time profit tracking for matched betting",
    start_url: "/",
    display: "standalone",
    // Mirrors --topbar (#111111 brand ink) - manifests cannot reference CSS vars.
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
