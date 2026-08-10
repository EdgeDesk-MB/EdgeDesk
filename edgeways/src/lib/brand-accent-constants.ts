/** Shared brand-accent constants (no FOUC script — keeps the graph cycle-free). */

export const BRAND_ACCENT_STORAGE_KEY = "edgeways-brand-accent";

/** Cookie so the server can paint the chosen accent on first HTML (no amber flash). */
export const BRAND_ACCENT_COOKIE_KEY = "edgeways-brand-accent-hex";

/** Relative luminance below this → treat plate as dark (white ink on it). */
export const BRAND_LUMINANCE_THRESHOLD = 0.45;

/**
 * Target luminance for `--brand-text` when the raw brand is below the plate
 * threshold — keeps selected nav / counters readable on dark chrome.
 */
export const BRAND_TEXT_MIN_LUMINANCE = 0.55;

/**
 * Target luminance for `--brand-logo` on the light-mode ink `#111` topbar
 * (lockup + Beta plate + Login fill). Same floor as brand-text — a mild HSL
 * nudge is not enough for Viridian / Azure on ink.
 */
export const BRAND_LOGO_MIN_LUMINANCE = BRAND_TEXT_MIN_LUMINANCE;

/**
 * Ceiling luminance for `--brand-highlight` (tab underlines, light-surface
 * accent strokes). Light brands are darkened to this; mirrors the
 * {@link BRAND_TEXT_MIN_LUMINANCE} lift on dark surfaces. Same numeric value
 * as {@link BRAND_LUMINANCE_THRESHOLD} by design.
 */
export const BRAND_HIGHLIGHT_MAX_LUMINANCE = 0.45;

/** Settle time after apply — matches CSS `--brand` transition. */
export const BRAND_ACCENT_SETTLE_MS = 240;

export const DEFAULT_BRAND_ACCENT_HEX = "#FFC71E";
