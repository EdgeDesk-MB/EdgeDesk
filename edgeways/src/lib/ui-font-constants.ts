/** Shared UI font constants (no FOUC script — keeps the graph cycle-free). */

export const UI_FONT_STORAGE_KEY = "edgeways-ui-font";

/** Cookie so the server can paint the chosen font on first HTML. */
export const UI_FONT_COOKIE_KEY = "edgeways-ui-font";

/** `html` attribute that selects the active UI face. */
export const UI_FONT_ATTR = "data-font";

export const UI_FONT_IDS = ["default", "figtree"] as const;
export type UiFontId = (typeof UI_FONT_IDS)[number];

export const DEFAULT_UI_FONT: UiFontId = "default";
