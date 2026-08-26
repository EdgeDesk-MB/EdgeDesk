/**
 * Line tabs are page section nav (Settings, Tracker, Racing).
 * Radix only puts the active tab in the Tab order. Tab/Shift+Tab should
 * still walk the row, then leave into the page at either end.
 */

export function nextLineTabIndex(
  current: number,
  count: number,
  shiftKey: boolean
): number | null {
  if (count <= 0 || current < 0 || current >= count) return null;
  const next = shiftKey ? current - 1 : current + 1;
  if (next < 0 || next >= count) return null;
  return next;
}

export function lineTabTriggers(list: ParentNode): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(
    '[data-slot="tabs-trigger"]:not([disabled])'
  )];
}
