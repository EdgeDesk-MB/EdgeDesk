import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "edgeways - Matched Betting Command Centre",
    short_name: "edgeways",
    description:
      "Calculators, live events and real-time profit tracking for matched betting",
    start_url: "/",
    display: "standalone",
    // Mirrors --topbar (oklch(0.14 0 0)) - manifests cannot reference CSS vars.
    background_color: "#0d0d0f",
    theme_color: "#0d0d0f",
    icons: [
      { src: "/edgeways-bolt.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
