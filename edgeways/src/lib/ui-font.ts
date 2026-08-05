/**
 * App-wide UI font selection (Appearance).
 * Default = Noto Sans (current desk face). Figtree is the first alternate.
 */

import {
  DEFAULT_UI_FONT,
  UI_FONT_ATTR,
  UI_FONT_COOKIE_KEY,
  UI_FONT_IDS,
  UI_FONT_STORAGE_KEY,
  type UiFontId,
} from "@/lib/ui-font-constants";

export {
  DEFAULT_UI_FONT,
  UI_FONT_ATTR,
  UI_FONT_COOKIE_KEY,
  UI_FONT_IDS,
  UI_FONT_STORAGE_KEY,
  type UiFontId,
} from "@/lib/ui-font-constants";
export { UI_FONT_FOUC_SCRIPT } from "@/lib/ui-font-fouc";

export const UI_FONT_OPTIONS: ReadonlyArray<{ id: UiFontId; label: string }> = [
  { id: "default", label: "Noto Sans (default)" },
  { id: "figtree", label: "Figtree" },
];

export function isUiFontId(value: unknown): value is UiFontId {
  return typeof value === "string" && (UI_FONT_IDS as readonly string[]).includes(value);
}

export function normalizeUiFont(value: unknown): UiFontId {
  return isUiFontId(value) ? value : DEFAULT_UI_FONT;
}

/** Apply the chosen face on `<html>` (CSS switches `--font-sans` via `data-font`). */
export function applyUiFont(id: UiFontId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id === DEFAULT_UI_FONT) {
    root.removeAttribute(UI_FONT_ATTR);
  } else {
    root.setAttribute(UI_FONT_ATTR, id);
  }
}

export function readStoredUiFont(): UiFontId {
  if (typeof window === "undefined") return DEFAULT_UI_FONT;
  try {
    return normalizeUiFont(localStorage.getItem(UI_FONT_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_FONT;
  }
}

export function writeStoredUiFont(id: UiFontId): void {
  if (typeof window === "undefined") return;
  const resolved = normalizeUiFont(id);
  try {
    localStorage.setItem(UI_FONT_STORAGE_KEY, resolved);
  } catch {
    /* private mode / quota */
  }
  try {
    document.cookie =
      UI_FONT_COOKIE_KEY +
      "=" +
      encodeURIComponent(resolved) +
      ";path=/;max-age=31536000;SameSite=Lax";
  } catch {
    /* ignore */
  }
}
