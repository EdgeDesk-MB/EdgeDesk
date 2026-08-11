/**
 * Shared chamfered bolt mark for in-app logo + accent-tinted favicon.
 * Path traced from brand/masters/notification.png (7-point geometric mark).
 */

import {
  DEFAULT_BRAND_ACCENT_HEX,
  deriveBrandAccent,
  normalizeHex,
} from "@/lib/brand-accent";

export const BOLT_PATH =
  "M12.82 4.32 L12.86 10.3 L18.91 10.3 L11.25 19.61 L11.14 13.7 L5.13 13.67 L12.75 4.39 Z";

const FAVICON_LINK_ATTR = "data-edgeways-brand-favicon";

/** SVG favicon for the given brand plate hex (bolt contrast derived). */
export function buildAccentFaviconSvg(hex: string): string {
  const brand = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  const derived = deriveBrandAccent(brand);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5" fill="${derived.brand}"/>` +
    `<path d="${BOLT_PATH}" fill="${derived.brandOnTopbar}"/>` +
    `</svg>`
  );
}

export function accentFaviconDataUrl(hex: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildAccentFaviconSvg(hex))}`;
}

/**
 * Swap the tab favicon to the accent-tinted bolt.
 * Keeps apple-touch / PWA icons untouched (those stay the static brand PNGs).
 *
 * Never call `.remove()` on Next/React-managed `<link rel="icon">` nodes.
 * Those are HostHoistables (fiber tag 26); detaching them leaves
 * `stateNode.parentNode === null`, and React 19 crashes on cleanup with
 * `Cannot read properties of null (reading 'removeChild')`.
 */
export function setAccentFavicon(hex: string): void {
  if (typeof document === "undefined") return;
  const href = accentFaviconDataUrl(hex);
  let link = document.querySelector<HTMLLinkElement>(`link[${FAVICON_LINK_ATTR}]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.setAttribute(FAVICON_LINK_ATTR, "");
    document.head.appendChild(link);
  }
  link.href = href;
}
