import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EdgeDesk - Matched Betting Command Centre",
    short_name: "EdgeDesk",
    description:
      "Calculators, live events and real-time profit tracking for matched betting",
    start_url: "/",
    display: "standalone",
    // Mirrors --topbar (oklch(0.14 0 0)) - manifests cannot reference CSS vars.
    background_color: "#0d0d0f",
    theme_color: "#0d0d0f",
    icons: [
      { src: "/chart-line.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
