const REVEAL = new Set(["app-scroll", "app-scroll-nested", "app-scroll-float"]);
const NEVER = new Set(["app-scroll-overlay", "app-scroll-always"]);

/** Hide the thumb this long after the last scroll event on that scroller. */
export const SCROLL_BAR_REVEAL_IDLE_MS = 700;

/** True when this scroller should flash a thumb while it moves. */
export function scrollBarRevealsOnScroll(className: string): boolean {
  const classes = className.split(/\s+/).filter(Boolean);
  if (classes.some((name) => NEVER.has(name))) return false;
  return classes.some((name) => REVEAL.has(name));
}

/** Scroll events target the scroller itself, not a descendant. */
export function scrollBarRevealTarget(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null;
  if (!scrollBarRevealsOnScroll(node.getAttribute("class") ?? "")) return null;
  return node;
}
