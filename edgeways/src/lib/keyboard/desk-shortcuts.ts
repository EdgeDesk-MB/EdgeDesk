/**
 * Daily desk chords (EDGE-78). Palette (⌘/Ctrl+K) stays in CommandPalette.
 * Chords never fire while typing or while a dialog/sheet is open.
 */

export type DeskShortcutId =
  | "add-bet"
  | "new-offer"
  | "matched-calculator"
  | "keyboard-help";

export type DeskJumpId = "jump-home" | "jump-racing" | "jump-offers";

export type DeskResolvedAction = DeskShortcutId | DeskJumpId;

export const DESK_GO_PREFIX_MS = 1000;

export const DESK_JUMPS: ReadonlyArray<{
  id: DeskJumpId;
  key: string;
  href: string;
  label: string;
}> = [
  { id: "jump-home", key: "h", href: "/desk", label: "Home" },
  { id: "jump-racing", key: "r", href: "/racing", label: "Racing" },
  { id: "jump-offers", key: "o", href: "/offers/calendar", label: "Offers" },
];

export const DESK_SHORTCUTS: ReadonlyArray<{
  id: DeskShortcutId;
  key: string;
  label: string;
}> = [
  { id: "add-bet", key: "n", label: "Add bet" },
  { id: "new-offer", key: "o", label: "New offer" },
  { id: "matched-calculator", key: "m", label: "Matched calculator" },
  { id: "keyboard-help", key: "?", label: "Keyboard help" },
];

export const KEYBOARD_HELP_HREF = "/help?guide=keyboard";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "file",
  "range",
  "color",
  "image",
]);

const TYPING_ROLES = new Set([
  "combobox",
  "searchbox",
  "textbox",
  "listbox",
  "option",
  "menu",
]);

const OPEN_OVERLAY_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
].join(", ");

export function targetAttrsAreTyping(attrs: {
  tagName: string;
  type?: string;
  contentEditable?: string | null;
  role?: string | null;
}): boolean {
  const tag = attrs.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    return !NON_TEXT_INPUT_TYPES.has((attrs.type ?? "text").toLowerCase());
  }
  if (attrs.contentEditable && attrs.contentEditable !== "false") return true;
  return Boolean(attrs.role && TYPING_ROLES.has(attrs.role));
}

export function overlayAttrsBlockShortcuts(attrs: {
  role: string | null;
  dataState: string | null;
}): boolean {
  if (attrs.dataState !== "open") return false;
  return attrs.role === "dialog" || attrs.role === "alertdialog" || attrs.role === "menu";
}

function elementToTypingAttrs(el: Element) {
  return {
    tagName: el.tagName,
    type: el instanceof HTMLInputElement ? el.type : undefined,
    contentEditable: el.getAttribute("contenteditable"),
    role: el.getAttribute("role"),
  };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined") return false;
  let el: Element | null = target instanceof Element ? target : null;
  while (el) {
    if (targetAttrsAreTyping(elementToTypingAttrs(el))) return true;
    el = el.parentElement;
  }
  return false;
}

export function isBlockingOverlayOpen(root: ParentNode = document): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(root.querySelector(OPEN_OVERLAY_SELECTOR));
}

export function shouldIgnoreDeskShortcut(
  event: { target: EventTarget | null; defaultPrevented?: boolean },
  root?: ParentNode
): boolean {
  if (event.defaultPrevented) return true;
  if (isTypingTarget(event.target)) return true;
  if (root && isBlockingOverlayOpen(root)) return true;
  return false;
}

type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function matchDeskShortcut(event: ShortcutKeyEvent): DeskShortcutId | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
    return "keyboard-help";
  }
  if (event.shiftKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === "n") return "add-bet";
  if (key === "o") return "new-offer";
  if (key === "m") return "matched-calculator";
  return null;
}

export function resolveDeskKey(
  event: ShortcutKeyEvent,
  prefixArmedAt: number | null,
  now: number
): {
  action: DeskResolvedAction | null;
  nextPrefixArmedAt: number | null;
  consume: boolean;
} {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return { action: null, nextPrefixArmedAt: null, consume: false };
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const prefixLive =
    prefixArmedAt !== null && now - prefixArmedAt <= DESK_GO_PREFIX_MS;

  if (prefixLive) {
    if (key === "g" && !event.shiftKey) {
      return { action: null, nextPrefixArmedAt: now, consume: true };
    }
    if (key === "h" && !event.shiftKey) {
      return { action: "jump-home", nextPrefixArmedAt: null, consume: true };
    }
    if (key === "r" && !event.shiftKey) {
      return { action: "jump-racing", nextPrefixArmedAt: null, consume: true };
    }
    if (key === "o" && !event.shiftKey) {
      return { action: "jump-offers", nextPrefixArmedAt: null, consume: true };
    }
    const fallback = matchDeskShortcut(event);
    return { action: fallback, nextPrefixArmedAt: null, consume: Boolean(fallback) };
  }

  if (key === "g" && !event.shiftKey) {
    return { action: null, nextPrefixArmedAt: now, consume: true };
  }
  const action = matchDeskShortcut(event);
  return { action, nextPrefixArmedAt: null, consume: Boolean(action) };
}
