/**
 * Shared FOUC guard: public demo always paints product defaults (Amber, Noto,
 * diagonal lines). Desk appearance cookies/localStorage must not leak in.
 */

import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";

/** Inline at the top of each appearance FOUC IIFE `try` block. */
export const SKIP_STORED_APPEARANCE_FOUC = `var _ewDemo = ${JSON.stringify(PUBLIC_DEMO_COOKIE)} + "=";
    var _ewParts = document.cookie.split(";");
    for (var _i = 0; _i < _ewParts.length; _i++) {
      var _ewPart = _ewParts[_i].trim();
      if (_ewPart.indexOf(_ewDemo) === 0 && _ewPart.length > _ewDemo.length) return;
    }`;
