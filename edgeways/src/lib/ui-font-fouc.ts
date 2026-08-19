/**
 * Blocking FOUC script source for <head>. Sets `data-font` before first paint
 * so a stored Figtree choice does not flash Default (Noto).
 */

import { SKIP_STORED_APPEARANCE_FOUC } from "@/lib/appearance-fouc-skip";
import {
  DEFAULT_UI_FONT,
  UI_FONT_ATTR,
  UI_FONT_COOKIE_KEY,
  UI_FONT_IDS,
  UI_FONT_STORAGE_KEY,
} from "@/lib/ui-font-constants";

export const UI_FONT_FOUC_SCRIPT = `(function () {
  try {
    ${SKIP_STORED_APPEARANCE_FOUC}
    var sk = ${JSON.stringify(UI_FONT_STORAGE_KEY)};
    var ck = ${JSON.stringify(UI_FONT_COOKIE_KEY)};
    var attr = ${JSON.stringify(UI_FONT_ATTR)};
    var def = ${JSON.stringify(DEFAULT_UI_FONT)};
    var allowed = ${JSON.stringify(UI_FONT_IDS)};
    var id = "";
    try {
      id = localStorage.getItem(sk) || "";
    } catch (e) {}
    if (!id) {
      var parts = document.cookie.split(";");
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].trim();
        if (kv.indexOf(ck + "=") === 0) {
          id = decodeURIComponent(kv.slice(ck.length + 1));
          break;
        }
      }
    }
    if (allowed.indexOf(id) < 0) id = def;
    var root = document.documentElement;
    if (id === def) root.removeAttribute(attr);
    else root.setAttribute(attr, id);
  } catch (e) {}
})();`;
