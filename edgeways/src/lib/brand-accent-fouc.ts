/**
 * Blocking FOUC script source for <head>. Kept as a plain string builder so
 * Turbopack never has to parse regex literals inside template soup.
 */

import { SKIP_STORED_APPEARANCE_FOUC } from "@/lib/appearance-fouc-skip";
import {
  BRAND_ACCENT_COOKIE_KEY,
  BRAND_ACCENT_STORAGE_KEY,
  BRAND_HIGHLIGHT_MAX_LUMINANCE,
  BRAND_LOGO_MIN_LUMINANCE,
  BRAND_LUMINANCE_THRESHOLD,
  BRAND_TEXT_MIN_LUMINANCE,
  DEFAULT_BRAND_ACCENT_HEX,
} from "@/lib/brand-accent-constants";

export const BRAND_ACCENT_FOUC_SCRIPT = `(function () {
  try {
    ${SKIP_STORED_APPEARANCE_FOUC}
    var sk = ${JSON.stringify(BRAND_ACCENT_STORAGE_KEY)};
    var ck = ${JSON.stringify(BRAND_ACCENT_COOKIE_KEY)};
    var presets = {
      amber: "#FFC71E",
      viridian: "#2BB673",
      coral: "#FF6B4A",
      azure: "#3B82F6",
      orchid: "#C084FC",
      citrine: "#EAB308",
      rose: "#F43F5E"
    };
    var h = "";
    var r = localStorage.getItem(sk);
    if (r) {
      var p = JSON.parse(r);
      h = typeof p.hex === "string" ? p.hex : "";
      if (!h && p.presetId && presets[p.presetId]) h = presets[p.presetId];
    }
    if (!h) {
      var parts = document.cookie.split(";");
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].trim();
        if (kv.indexOf(ck + "=") === 0) {
          h = decodeURIComponent(kv.slice(ck.length + 1));
          break;
        }
      }
    }
    var m = String(h).trim().match(new RegExp("^#?([0-9a-fA-F]{6})$"));
    if (!m) return;
    h = "#" + m[1].toUpperCase();
    function lin(c) {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function lum(hex) {
      var n = parseInt(hex.slice(1), 16);
      return (
        0.2126 * lin((n >> 16) & 255) +
        0.7152 * lin((n >> 8) & 255) +
        0.0722 * lin(n & 255)
      );
    }
    function rgbToHsl(R, G, B) {
      var r = R / 255,
        g = G / 255,
        b = B / 255,
        max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        l = (max + min) / 2,
        s = 0,
        hh = 0;
      if (max !== min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) hh = ((b - r) / d + 2) / 6;
        else hh = ((r - g) / d + 4) / 6;
      }
      return { h: hh, s: s, l: l };
    }
    function hue2(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    function hslToHex(hh, s, l) {
      var r, g, b;
      if (s === 0) {
        r = g = b = Math.round(l * 255);
      } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p2 = 2 * l - q;
        r = Math.round(hue2(p2, q, hh + 1 / 3) * 255);
        g = Math.round(hue2(p2, q, hh) * 255);
        b = Math.round(hue2(p2, q, hh - 1 / 3) * 255);
      }
      return (
        "#" +
        [r, g, b]
          .map(function (c) {
            return c.toString(16).padStart(2, "0");
          })
          .join("")
          .toUpperCase()
      );
    }
    var n = parseInt(h.slice(1), 16);
    var hsl = rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
    var logo = h;
    if (lum(h) < ${BRAND_LUMINANCE_THRESHOLD}) {
      var ll = hsl.l;
      for (var li = 0; li < 14; li++) {
        ll = Math.min(0.84, ll + 0.055);
        logo = hslToHex(hsl.h, hsl.s, ll);
        if (lum(logo) >= ${BRAND_LOGO_MIN_LUMINANCE}) break;
      }
    }
    var dark = lum(h) < ${BRAND_LUMINANCE_THRESHOLD};
    var on = dark ? "#FFFFFF" : "#111111";
    var logoDark = lum(logo) < ${BRAND_LUMINANCE_THRESHOLD};
    var onLogo = logoDark ? "#FFFFFF" : "#111111";
    var text = h;
    if (dark) {
      var ts = hsl.s;
      var tl = hsl.l;
      for (var j = 0; j < 14; j++) {
        tl = Math.min(0.84, tl + 0.055);
        text = hslToHex(hsl.h, ts, tl);
        if (lum(text) >= ${BRAND_TEXT_MIN_LUMINANCE}) break;
      }
    }
    var highlight = h;
    if (lum(h) > ${BRAND_HIGHLIGHT_MAX_LUMINANCE}) {
      var hs = hsl.s < 0.08 ? 0 : hsl.s;
      var hl = hsl.l;
      for (var k = 0; k < 14; k++) {
        hl = Math.max(0.12, hl - 0.055);
        highlight = hslToHex(hsl.h, hs, hl);
        if (lum(highlight) <= ${BRAND_HIGHLIGHT_MAX_LUMINANCE}) break;
      }
    }
    var root = document.documentElement;
    root.style.setProperty("--brand", h);
    root.style.setProperty("--brand-logo", logo);
    root.style.setProperty("--brand-logo-foreground", onLogo);
    root.style.setProperty("--brand-text", text);
    root.style.setProperty("--brand-highlight", highlight);
    root.style.setProperty("--brand-foreground", on);
    root.style.setProperty("--brand-on-topbar", on);
    root.style.setProperty("--topbar-muted-on-brand", on);
    root.style.setProperty(
      "--topbar-accent-face-shadow",
      logoDark ? "var(--ew-ink-plate-shadow)" : "var(--ew-btn-shadow)"
    );
    root.dataset.brandPlate = dark ? "dark" : "light";
    if (h === ${JSON.stringify(DEFAULT_BRAND_ACCENT_HEX)}) {
      document.cookie = ck + "=;path=/;max-age=0;SameSite=Lax";
    } else {
      document.cookie =
        ck + "=" + encodeURIComponent(h) + ";path=/;max-age=31536000;SameSite=Lax";
    }
  } catch (e) {}
})();`;
