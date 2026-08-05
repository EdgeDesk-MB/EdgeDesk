/**
 * Blocking FOUC script source for <head>. Sets `data-header-pattern` before
 * first paint so a stored choice does not flash Diagonal lines.
 */

import {
  DEFAULT_HEADER_PATTERN,
  HEADER_PATTERN_ATTR,
  HEADER_PATTERN_COOKIE_KEY,
  HEADER_PATTERN_IDS,
  HEADER_PATTERN_STORAGE_KEY,
} from "@/lib/header-pattern-constants";

export const HEADER_PATTERN_FOUC_SCRIPT = `(function () {
  try {
    var sk = ${JSON.stringify(HEADER_PATTERN_STORAGE_KEY)};
    var ck = ${JSON.stringify(HEADER_PATTERN_COOKIE_KEY)};
    var attr = ${JSON.stringify(HEADER_PATTERN_ATTR)};
    var def = ${JSON.stringify(DEFAULT_HEADER_PATTERN)};
    var allowed = ${JSON.stringify(HEADER_PATTERN_IDS)};
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
