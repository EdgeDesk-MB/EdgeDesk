export const DIALOG_SAVE_ATTR = "data-dialog-save";

type SaveKeyEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

function eventKey(event: SaveKeyEvent): string {
  if (event.key === "Enter" || event.key === "NumpadEnter") return "enter";
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/**
 * Dialog confirm is ⌘Enter / Ctrl+Enter, including from a field.
 * Do not bind ⌘S: browsers often steal it for chrome.
 */
export function matchDialogSave(event: SaveKeyEvent): boolean {
  if (event.altKey || event.shiftKey) return false;
  const withMod = event.metaKey || event.ctrlKey;
  return withMod && eventKey(event) === "enter";
}

/** Stable button chrome. Mac is ⌘↵, Windows/Linux is Ctrl ↵. */
export function dialogSaveHintKeys(isMac: boolean): string[] {
  return [isMac ? "⌘" : "Ctrl", "↵"];
}

export function isSaveControlDisabled(el: HTMLElement): boolean {
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el.hasAttribute("disabled")) return true;
  if (el instanceof HTMLButtonElement && el.disabled) return true;
  const inner = el.querySelector("button");
  return Boolean(inner?.disabled || inner?.getAttribute("aria-disabled") === "true");
}

export function findDialogSaveButton(root: ParentNode): HTMLElement | null {
  const nodes = root.querySelectorAll<HTMLElement>(`[${DIALOG_SAVE_ATTR}]`);
  for (const el of nodes) {
    if (isSaveControlDisabled(el)) continue;
    return el;
  }
  return null;
}

export function shouldCommitDialogSave(
  event: SaveKeyEvent,
  root: ParentNode
): HTMLElement | null {
  if (!matchDialogSave(event)) return null;
  return findDialogSaveButton(root);
}
