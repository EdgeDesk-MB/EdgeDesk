/**
 * Self-hosted UI faces. next/font/google goes through Turbopack's Google
 * Fonts fetch (`@vercel/turbopack-next/internal/font/google/font`), which
 * fails the compile when that fetch misses. Local files keep `--font-sans`
 * / `--font-figtree` / `--font-geist-mono` available offline.
 */
import localFont from "next/font/local";

export const notoSans = localFont({
  src: "./noto-sans-latin-wght-normal.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400 700",
});

export const figtree = localFont({
  src: "./figtree-latin-wght-normal.woff2",
  variable: "--font-figtree",
  display: "swap",
  weight: "400 700",
});

export const geistMono = localFont({
  src: "./geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "400 700",
});
