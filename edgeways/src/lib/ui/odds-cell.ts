import type { CSSProperties } from "react";
import { darken, lighten } from "@/lib/brands/exchanges";

/**
 * Exchange-branded odds cell — same lighten/darken pattern as calculator
 * Back/Lay panels. Light mode: pastel tint. Dark mode: deep panel tint (0.72)
 * so cells match the calc, not washed mid-tones.
 */
export function oddsCellStyle(hex?: string): CSSProperties | undefined {
  if (!hex) return undefined;
  return {
    "--odds-cell": lighten(hex, 0.72),
    "--odds-cell-dark": darken(hex, 0.72),
  } as CSSProperties;
}

export const oddsCellClass =
  "bg-[var(--odds-cell)] text-black/85 dark:bg-[var(--odds-cell-dark)] dark:text-white/95";
