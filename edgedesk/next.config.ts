import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: {
    position: "bottom-right",
  },
  /**
   * Phones on the LAN hit the dev server by IP or Bonjour name; without
   * these, Next blocks its own /_next dev resources cross-origin and the
   * app renders dead (static null-state HTML, no hydration). If your LAN
   * IP changes, add the new one here and restart the dev server.
   */
  allowedDevOrigins: ["192.168.50.71", "sams-mac-studio.local", "*.local", "*.ts.net"],
};

export default nextConfig;
