/** Selectors for UI portaled to `document.body` that must stay interactive inside modals. */
export const DIALOG_PORTAL_SELECTORS = [
  "[data-bookmaker-select-menu]",
  '[data-slot="select-content"]',
  '[data-slot="popover-content"]',
] as const;

export function isDialogPortalTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return DIALOG_PORTAL_SELECTORS.some((sel) => target.closest(sel));
}

export function preventDialogDismissOnPortaledContent(e: Event) {
  const detail = (e as CustomEvent<{ originalEvent?: Event }>).detail;
  const target = detail?.originalEvent?.target ?? e.target;
  if (isDialogPortalTarget(target)) {
    e.preventDefault();
  }
}
